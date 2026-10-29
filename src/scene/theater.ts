import gsap from "gsap";
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
import { buildBeam, buildRoomDust, type Beam } from "./beam";
import { COUNT_STEP, Film } from "./film";
import { createFilmPass } from "./filmPass";
import { COUCH, IMAGE, PROJECTOR, SCREEN } from "./layout";
import { palette } from "./palette";
import { buildProjector, type Projector } from "./projector";
import { clamp, lerp } from "./random";
import { buildRoom, type Room } from "./room";
import { ProjectorSound } from "./sound";
import { FONT_BODY, FONT_DISPLAY, FONT_MONO, setMaxAnisotropy } from "./textures";

/**
 * - idle: the room, lamp on, waiting for the projector to be started
 * - playing: the start sequence is running
 * - entering: the camera has reached the screen and the page is crossfading to the resume
 * - entered: the resume is showing; the 3D scene is paused
 * - ending: the ending sequence is running
 */
export type Mode = "idle" | "playing" | "entering" | "entered" | "ending";

/** Everything the sequences animate. The render loop reads it every frame. */
interface SceneState {
  lamp: number;
  running: number;
  reels: number;
  beam: number;
  screen: number;
  cam: number;
  grain: number;
  flicker: number;
  weave: number;
  fade: number;
}

const IDLE_LOOK = { grain: 0.045, flicker: 0.0, weave: 0.0 };
const FILM_LOOK = { grain: 0.1, flicker: 0.1, weave: 1.4 };

export interface TheaterOptions {
  reducedMotion: boolean;
  /** Return true when the visitor has already seen the full opening. */
  seenIntro: () => boolean;
  onMode: (mode: Mode, detail: { afterEnding?: boolean }) => void;
  onHover: (hovering: boolean) => void;
}

export class Theater {
  mode: Mode = "idle";
  readonly sound = new ProjectorSound();

  private opts: TheaterOptions;
  private canvas: HTMLCanvasElement;
  renderer!: THREE.WebGLRenderer;
  scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private composer!: EffectComposer;
  private bloom!: UnrealBloomPass;
  private filmPass!: ReturnType<typeof createFilmPass>;
  private room!: Room;
  private projector!: Projector;
  private beam!: Beam;
  private roomDust!: ReturnType<typeof buildRoomDust>;
  private film!: Film;
  private screenLight!: THREE.RectAreaLight;
  private spot!: THREE.SpotLight;
  private ventLight!: THREE.PointLight;
  private raycaster = new THREE.Raycaster();

  private state: SceneState = {
    lamp: 1,
    running: 0,
    reels: 0,
    beam: 0,
    screen: 0,
    cam: 0,
    ...IDLE_LOOK,
    fade: 1,
  };
  private tl: gsap.core.Timeline | null = null;
  private raf = 0;
  private last = 0;
  private time = 0;
  private hover = 0;
  private hovering = false;
  private pointer = new THREE.Vector2(0, 0);
  private parallax = new THREE.Vector2(0, 0);
  private size = { w: 1, h: 1 };

  constructor(canvas: HTMLCanvasElement, opts: TheaterOptions) {
    this.canvas = canvas;
    this.opts = opts;
  }

  /** Build the scene and draw the first frame. Throws if WebGL is unavailable. */
  async init() {
    await Promise.race([
      Promise.all([
        document.fonts.load(`600 80px ${FONT_DISPLAY}`),
        document.fonts.load(`500 23px ${FONT_BODY}`),
        document.fonts.load(`700 120px ${FONT_BODY}`),
        document.fonts.load(`500 17px ${FONT_MONO}`),
      ]),
      new Promise((resolve) => setTimeout(resolve, 2500)),
    ]);

    const small = Math.min(window.innerWidth, window.innerHeight) < 700;
    const renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, small ? 1.5 : 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.shadowMap.autoUpdate = false;
    this.renderer = renderer;
    setMaxAnisotropy(Math.min(8, renderer.capabilities.getMaxAnisotropy()));
    RectAreaLightUniformsLib.init();

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#050302");
    this.scene = scene;
    this.camera = new THREE.PerspectiveCamera(46, 1, 0.03, 30);

    this.film = new Film();
    this.room = buildRoom(this.film.texture);
    scene.add(this.room.group);

    this.projector = buildProjector(PROJECTOR.position, SCREEN.center);
    scene.add(this.projector.group);

    const z = SCREEN.center.z + 0.003;
    const hw = IMAGE.width / 2;
    const hh = IMAGE.height / 2;
    const { x, y } = SCREEN.center;
    const corners = [
      new THREE.Vector3(x - hw, y - hh, z),
      new THREE.Vector3(x + hw, y - hh, z),
      new THREE.Vector3(x + hw, y + hh, z),
      new THREE.Vector3(x - hw, y + hh, z),
    ];
    this.beam = buildBeam(this.projector.lensWorld, corners);
    scene.add(this.beam.group);

    this.roomDust = buildRoomDust(this.room.lamp.position.clone().add(new THREE.Vector3(0.5, 0.05, 0.5)), 0.9);
    scene.add(this.roomDust.points);

    // Light the picture throws back into the room.
    this.screenLight = new THREE.RectAreaLight(palette.projectorLight, 0, IMAGE.width, IMAGE.height);
    this.screenLight.position.set(x, y, SCREEN.center.z + 0.02);
    this.screenLight.lookAt(x, y, 3);
    scene.add(this.screenLight);

    // Light from the lens, spilling past the picture onto the wall and sideboard.
    const dist = this.projector.lensWorld.distanceTo(SCREEN.center);
    this.spot = new THREE.SpotLight(palette.projectorLight, 0, 0, Math.atan((SCREEN.width * 0.62) / dist), 0.6, 2);
    this.spot.position.copy(this.projector.lensWorld);
    this.spot.target.position.copy(SCREEN.center);
    scene.add(this.spot, this.spot.target);

    // Lamp glow leaking from the projector's vents.
    this.ventLight = new THREE.PointLight(palette.lampLight, 0, 1.4, 2);
    this.ventLight.position.copy(PROJECTOR.position).add(new THREE.Vector3(-0.12, 0.1, 0));
    scene.add(this.ventLight);

    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(renderer, target);
    this.composer.addPass(new RenderPass(scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.55, 0.85);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.filmPass = createFilmPass();
    this.composer.addPass(this.filmPass);

    this.resize();
    window.addEventListener("resize", () => this.resize());
    this.canvas.addEventListener("pointermove", (e) => this.onPointerMove(e));
    this.canvas.addEventListener("pointerleave", () => this.setHovering(false));

    renderer.shadowMap.needsUpdate = true;
    this.applyState(0);
    this.composer.render();
    this.startLoop();
    gsap.to(this.state, { fade: 0, duration: this.opts.reducedMotion ? 0.01 : 1.4, ease: "power1.out" });
  }

  /** Whether a click at this client position lands on the projector. */
  hitsProjector(clientX: number, clientY: number) {
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    return this.raycaster.intersectObjects(this.projector.hitTargets, true).length > 0;
  }

  /** Run the opening: full on a first visit, short after that. */
  start() {
    if (this.mode !== "idle") return;
    if (this.opts.reducedMotion) {
      this.enterQuick();
      return;
    }
    const full = !this.opts.seenIntro();
    this.setMode("playing");
    this.setHovering(false);
    this.sound.clunk();
    const s = this.state;
    const tl = gsap.timeline({ onComplete: () => this.finishEnter() });
    this.tl = tl;

    if (full) {
      tl.call(() => this.sound.startMotor(1.0), [], 0.05);
      tl.to(s, { lamp: 0.035, duration: 0.6, ease: "power2.inOut" }, 0);
      tl.to(s, { reels: 1, duration: 1.0, ease: "power1.in" }, 0.05);
      tl.to(s, { running: 1, duration: 0.2 }, 0.3);
      tl.call(() => this.film.set("leader"), [], 0.35);
      tl.to(
        s,
        {
          keyframes: [
            { beam: 0.7, screen: 0.7, duration: 0.05 },
            { beam: 0.12, screen: 0.12, duration: 0.07 },
            { beam: 1, screen: 1, duration: 0.18 },
          ],
        },
        0.35,
      );
      tl.to(s, { ...FILM_LOOK, duration: 0.4 }, 0.35);
      tl.call(() => this.film.set("countdown"), [], 0.95);
      tl.call(() => this.sound.pop(), [], 0.95 + COUNT_STEP);
      tl.call(() => this.film.set("title"), [], 0.95 + COUNT_STEP * 3);
      tl.to(s, { cam: 1, duration: 1.25, ease: "power2.inOut" }, 2.95);
      tl.to(s, { grain: 0.06, flicker: 0.04, weave: 0.6, duration: 1.0 }, 3.0);
      tl.call(() => this.beginCrossfade(), [], 3.8);
      tl.to({}, { duration: 0.45 }, 3.8);
    } else {
      tl.call(() => this.sound.startMotor(0.5), [], 0);
      tl.to(s, { lamp: 0.035, duration: 0.4, ease: "power2.inOut" }, 0);
      tl.to(s, { reels: 1, duration: 0.5, ease: "power1.in" }, 0);
      tl.to(s, { running: 1, duration: 0.15 }, 0.1);
      tl.call(() => this.film.set("leader"), [], 0.15);
      tl.to(s, { beam: 1, screen: 1, duration: 0.2 }, 0.15);
      tl.to(s, { ...FILM_LOOK, duration: 0.3 }, 0.15);
      tl.call(() => this.film.set("title"), [], 0.5);
      tl.to(s, { cam: 1, duration: 1.05, ease: "power2.inOut" }, 0.55);
      tl.to(s, { grain: 0.06, flicker: 0.04, weave: 0.6, duration: 0.8 }, 0.6);
      tl.call(() => this.beginCrossfade(), [], 1.35);
      tl.to({}, { duration: 0.45 }, 1.35);
    }
  }

  /** The page opened straight on the resume: treat the film as already running so the ending can play. */
  assumeEntered() {
    if (this.mode !== "idle") return;
    this.mode = "entered";
    Object.assign(this.state, { cam: 1, lamp: 0.035, beam: 1, screen: 1, running: 1, reels: 1, fade: 0 });
    this.stopLoop();
  }

  /** Cut the opening short. */
  skip() {
    if (this.mode !== "playing") return;
    this.tl?.kill();
    this.tl = null;
    this.film.set("title");
    gsap.to(this.state, { beam: 1, screen: 1, lamp: 0.035, running: 1, duration: 0.2 });
    this.beginCrossfade();
    window.setTimeout(() => this.finishEnter(), 450);
  }

  /** Straight to the resume without the camera move (reduced motion, or "skip to the resume"). */
  enterQuick() {
    if (this.mode === "entered" || this.mode === "entering") return;
    this.tl?.kill();
    this.tl = null;
    this.beginCrossfade();
    window.setTimeout(() => this.finishEnter(), 450);
  }

  /** Run the ending: "The End", the film runs out, the camera pulls back, the lights come up. */
  end() {
    if (this.mode !== "entered") return;
    const s = this.state;
    this.tl?.kill();
    Object.assign(s, { cam: 1, lamp: 0.035, beam: 1, screen: 1, running: 1, reels: 1, ...FILM_LOOK, fade: 0 });
    this.film.set("end");
    this.setMode("ending");
    this.startLoop();

    if (this.opts.reducedMotion) {
      Object.assign(s, { cam: 0, lamp: 1, beam: 0, screen: 0, running: 0, reels: 0, ...IDLE_LOOK });
      this.film.set("dark");
      window.setTimeout(() => this.setMode("idle", { afterEnding: true }), 450);
      return;
    }

    this.sound.startMotor(0.3);
    const tl = gsap.timeline({ onComplete: () => this.setMode("idle", { afterEnding: true }) });
    this.tl = tl;
    tl.call(() => {
      this.film.set("runout");
      this.sound.runout(1.2);
    }, [], 1.5);
    tl.to(s, { cam: 0, duration: 1.4, ease: "power2.inOut" }, 1.6);
    tl.to(s, { beam: 0, screen: 0, running: 0, duration: 0.35, ease: "power1.in" }, 2.45);
    tl.call(() => this.film.set("dark"), [], 2.8);
    tl.call(() => this.sound.stopMotor(1.1), [], 2.45);
    tl.to(s, { reels: 0, duration: 1.1, ease: "power2.out" }, 2.45);
    tl.to(s, { lamp: 1, duration: 0.9, ease: "power1.inOut" }, 2.8);
    tl.to(s, { ...IDLE_LOOK, duration: 0.8 }, 2.8);
  }

  private beginCrossfade() {
    this.setMode("entering");
  }

  private finishEnter() {
    if (this.mode === "entered") return;
    this.tl = null;
    this.sound.stopMotor(0.9);
    this.setMode("entered");
    this.stopLoop();
    // Reset to the room so the scene is ready if the visitor comes back.
    Object.assign(this.state, {
      lamp: 0.035,
      running: 1,
      reels: 1,
      beam: 1,
      screen: 1,
      cam: 1,
    });
  }

  private setMode(mode: Mode, detail: { afterEnding?: boolean } = {}) {
    this.mode = mode;
    this.opts.onMode(mode, detail);
  }

  private setHovering(on: boolean) {
    if (on === this.hovering) return;
    this.hovering = on;
    this.canvas.style.cursor = on ? "pointer" : "";
    this.opts.onHover(on);
  }

  private onPointerMove(e: PointerEvent) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    if (this.mode === "idle" && e.pointerType === "mouse") {
      this.setHovering(this.hitsProjector(e.clientX, e.clientY));
    }
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.size = { w, h };
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    const pr = this.renderer.getPixelRatio();
    this.bloom.setSize((w * pr) / 2, (h * pr) / 2);
    this.filmPass.uniforms.uResolution.value.set(w * pr, h * pr);
    this.camera.aspect = w / h;
    this.applyCamera();
    if (this.mode === "entered") this.composer.render();
  }

  private startLoop() {
    if (this.raf) return;
    this.last = performance.now();
    const tick = (now: number) => {
      this.raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.time += dt;
      this.applyState(dt);
      this.composer.render(dt);
    };
    this.raf = requestAnimationFrame(tick);
  }

  private stopLoop() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  /** Where the camera sits on the couch, framed for the current aspect ratio. */
  private couchPose(aspect: number) {
    const t = clamp((1.3 - aspect) / (1.3 - 0.5), 0, 1);
    const eye = COUCH.eye.clone();
    eye.z += 0.4 * t;
    eye.y += 0.06 * t;
    const look = COUCH.look.clone();
    look.x -= 0.1 * t;
    look.y -= 0.22 * t;
    const hfov = lerp(57.8, 56, t);
    const vfov = clamp((2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(hfov / 2)) / aspect) * 180) / Math.PI, 46, 82);
    return { eye, look, fov: vfov };
  }

  /** Where the camera ends up: close enough that the picture fills the view (or fits it, on portrait screens). */
  private screenPose(aspect: number) {
    const fov = 38;
    const tan = Math.tan(THREE.MathUtils.degToRad(fov / 2));
    const byHeight = IMAGE.height / (2 * tan);
    const byWidth = IMAGE.width / (2 * tan * aspect);
    const d = aspect >= 1 ? Math.min(byHeight, byWidth) * 0.97 : Math.max(byHeight, byWidth) * 1.06;
    const look = SCREEN.center.clone();
    const eye = look.clone().add(new THREE.Vector3(0, 0, d));
    return { eye, look, fov };
  }

  private applyCamera() {
    const aspect = this.size.w / this.size.h;
    const a = this.couchPose(aspect);
    const b = this.screenPose(aspect);
    const c = this.state.cam;
    const eye = a.eye.clone().lerp(b.eye, c);
    const look = a.look.clone().lerp(b.look, c);
    // Small parallax and breathing while sitting on the couch.
    const still = this.opts.reducedMotion ? 0 : 1 - c;
    eye.x += this.parallax.x * 0.08 * still + Math.sin(this.time * 0.35) * 0.006 * still;
    eye.y += this.parallax.y * 0.04 * still + Math.sin(this.time * 0.5) * 0.004 * still;
    this.camera.position.copy(eye);
    this.camera.fov = lerp(a.fov, b.fov, c);
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(look);
  }

  private applyState(dt: number) {
    const s = this.state;
    if (!this.opts.reducedMotion) {
      this.parallax.lerp(this.pointer, 1 - Math.exp(-dt * 2.5));
    }
    this.hover += ((this.hovering ? 1 : 0) - this.hover) * (1 - Math.exp(-dt * 10));

    // Lamp.
    const lamp = this.room.lamp;
    lamp.light.intensity = 12 * s.lamp;
    lamp.shade.emissiveIntensity = 0.02 + 0.95 * s.lamp;
    lamp.bulb.color.set(palette.lampLight).multiplyScalar(0.2 + 2.8 * s.lamp);
    this.room.fill.intensity = 0.15 + 0.75 * s.lamp;
    // Reduced motion freezes the drifting dust and smoke in place.
    const drift = this.opts.reducedMotion ? 0 : this.time;
    this.roomDust.update(drift, s.lamp);

    // Projector.
    this.projector.setRunning(s.running);
    this.projector.setHover(this.hover);
    this.projector.update(dt, s.reels);
    this.ventLight.intensity = s.running * 0.35;

    // Picture and the light it throws.
    if (this.film.scene !== "dark" || s.screen > 0) this.film.update(dt);
    const b = this.film.brightness;
    // While the projector runs, the picture is the screen's only light: darken the fabric so
    // the lamp and the lens spill don't wash out the dark parts of the image.
    this.room.screen.material.color.setScalar(1 - 0.94 * s.screen);
    this.room.screen.material.emissiveIntensity = s.screen * lerp(1.2, 0.85, s.cam);
    this.bloom.strength = lerp(0.55, 0.22, s.cam);
    this.screenLight.intensity = s.screen * (0.15 + b) * 4.5;
    this.spot.intensity = s.screen * (0.3 + 0.7 * b) * 18;
    this.beam.update(drift, s.beam, b);

    // Film look.
    const u = this.filmPass.uniforms;
    u.uTime.value = this.time;
    u.uGrain.value = s.grain;
    u.uFlicker.value = s.flicker;
    u.uWeave.value = s.weave;
    u.uFade.value = s.fade;
    u.uVignette.value = lerp(0.42, 0.2, s.cam);

    this.applyCamera();
  }
}
