import gsap from "gsap";
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
import type { ReelId } from "../data";
import { HEIGHT as GAME_HEIGHT, WIDTH as GAME_WIDTH } from "../lobby/config";
import { paintReelStill } from "../lobby/still";
import { buildBeam, buildRoomDust, type Beam } from "./beam";
import { buildBoard, type Board, type BoardPhoto } from "./board";
import { COUNT_STEP, Film } from "./film";
import { createFilmPass } from "./filmPass";
import { BOARD, COUCH, IMAGE, PROGRAM, PROJECTOR, REEL_VIEW, SCREEN, reelRect } from "./layout";
import { palette } from "./palette";
import { buildProgram, PAPER, type ProgramPaper } from "./program";
import type { RegionAction } from "./programPages";
import { buildProjector, type Projector } from "./projector";
import { clamp, lerp } from "./random";
import { buildRoom, type Room } from "./room";
import { ScenePass } from "./scenePass";
import { ProjectorSound } from "./sound";
import { FONT_BODY, FONT_DISPLAY, FONT_MONO, setMaxAnisotropy } from "./textures";

/**
 * - idle: the room, lamp on, waiting for the projector to be started
 * - program: the program is picked up and held in front of the camera
 * - board: the camera has gone over to the pin board and faces it
 * - photo: a photo is off the pin board and held in front of the camera
 * - playing: the start sequence is running
 * - entering: the camera has reached the screen and the reel is fading in over it
 * - reel: a reel is playing on the screen, drawn into the room as the screen's picture
 * - ending: the ending sequence is running
 */
export type Mode = "idle" | "program" | "board" | "photo" | "playing" | "entering" | "reel" | "ending";

/** In the room, not watching the film: the room's own pace, and the radio at full volume. */
const onTheCouch = (mode: Mode) => mode === "idle" || mode === "program" || mode === "board" || mode === "photo";

export type HoverTarget = "projector" | "program" | "fixture" | null;

/**
 * Something in the room a click from the couch does something to, besides the program and the
 * projector: the room extras in project.md. Nothing points at one; the cursor changes and it
 * brightens a little under the pointer, and a tap works the same as a click.
 */
interface Fixture {
  /** What a click has to land on. */
  targets: THREE.Object3D[];
  /** Show how far the pointer's highlight has eased in, 0 to 1. */
  highlight(level: number): void;
  click(): void;
  /** The highlight's current level, eased every frame. */
  hover: number;
}

/** What a click lands on while the program is held up. */
export interface ProgramHit {
  /** A printed reel or link under the pointer. */
  action: RegionAction | null;
  /** Which half of the paper: -1 left, 1 right. */
  side: -1 | 1;
}

/** One step through the held program: its fold, which side is up, and which inside page is centered. */
interface ProgramView {
  name: string;
  open: number;
  flip: number;
  /** -1 centers the inside-left page, 1 the inside-right page, 0 the whole spread. */
  focus: number;
}

/** Wide screens see the inside as a spread. */
const WIDE_VIEWS: ProgramView[] = [
  { name: "Cover", open: 0, flip: 0, focus: 0 },
  { name: "Inside", open: 1, flip: 0, focus: 0 },
  { name: "Back", open: 0, flip: 1, focus: 0 },
];

/** Tall screens (phones) are too narrow for the spread, so the inside comes one page at a time. */
const TALL_VIEWS: ProgramView[] = [
  { name: "Cover", open: 0, flip: 0, focus: 0 },
  { name: "Inside left", open: 1, flip: 0, focus: -1 },
  { name: "Inside right", open: 1, flip: 0, focus: 1 },
  { name: "Back", open: 0, flip: 1, focus: 0 },
];

/** Everything the sequences animate. The render loop reads it every frame. */
interface SceneState {
  /** The house lights: the film dims them. */
  lamp: number;
  /** Each lamp's own switch, 1 on and 0 off. The visitor flips these; the film leaves them be. */
  tableLamp: number;
  poleLamp: number;
  /** The radio's dial light: 0 off, 1 lit. */
  radio: number;
  running: number;
  reels: number;
  beam: number;
  screen: number;
  cam: number;
  grain: number;
  flicker: number;
  weave: number;
  fade: number;
  /** 0 standing on the table, 1 held up to the camera. */
  paper: number;
  /** The program's fold: 0 closed, 1 opened flat. */
  open: number;
  /** 1 turns the closed program over to its back. */
  flip: number;
  /** Which inside page is centered while it's open (see ProgramView). */
  focus: number;
  /** The live reel on the screen: 0 hidden, 1 showing. */
  reel: number;
  /** The camera: 0 on the couch, 1 in front of the pin board. */
  board: number;
}

const UP = new THREE.Vector3(0, 1, 0);
const tablePos = new THREE.Vector3();
const tableQuat = new THREE.Quaternion();
const heldPos = new THREE.Vector3();
const toPhoto = new THREE.Vector3();
const forward = new THREE.Vector3();
const up = new THREE.Vector3();
const right = new THREE.Vector3();

const IDLE_LOOK = { grain: 0.045, flicker: 0.0, weave: 0.0 };
const FILM_LOOK = { grain: 0.1, flicker: 0.1, weave: 1.4 };
/** While a reel plays: no gate weave, so the room's screen stays lined up with the reel drawn over it. */
const REEL_LOOK = { grain: 0.05, flicker: 0.02, weave: 0 };
/** The lamps while a reel plays: house lights at a low glow, so the room stays visible around the screen. */
const REEL_LAMP = 0.28;

/** How far the lamps' switches are on, 0 to 1. Most of the room's light is the table lamp's. */
const switchedOn = (s: SceneState) => 0.8 * s.tableLamp + 0.2 * s.poleLamp;
/** The room's fill light with its lamps switched off: moonlight, like a night scene on film. */
const NIGHT_SKY = new THREE.Color(palette.moonLight).multiplyScalar(0.55);
const NIGHT_GROUND = new THREE.Color("#0b0f1a");

/**
 * Frames per second the room is drawn at: smooth while anything moves, half that while it sits
 * still on the couch or in hand. Screens refresh at 60 to 144 times a second or more, and drawing
 * every one of them kept the GPU busy the whole time the page was open.
 */
const MOVING_RATE = 60;
const STILL_RATE = 30;
/** How long after the pointer last moved the room still counts as moving (the parallax eases in). */
const SETTLE_MS = 1500;
/** Drawn frames sampled before deciding whether the machine keeps up. */
const PACE_SAMPLES = 45;

export interface TheaterOptions {
  reducedMotion: boolean;
  /** Return true when the visitor has already seen the full opening. */
  seenIntro: () => boolean;
  onMode: (mode: Mode) => void;
  onHover: (target: HoverTarget) => void;
  /** The visitor switched the radio on or off. It only plays with sound on, so switching it on should turn sound on. */
  onRadio?: (on: boolean) => void;
  /** The held program turned to another view; first and last say whether it can turn further. */
  onProgramPage: (name: string, first: boolean, last: boolean) => void;
  /** A photo came off the pin board: where it is in the board's order. */
  onPhoto: (index: number, count: number) => void;
  /** Called after every rendered frame. */
  onFrame?: () => void;
}

export class Theater {
  mode: Mode = "idle";
  readonly sound = new ProjectorSound();

  private opts: TheaterOptions;
  private canvas: HTMLCanvasElement;
  private renderer!: THREE.WebGLRenderer;
  private camera!: THREE.PerspectiveCamera;
  private composer!: EffectComposer;
  private scenePass!: ScenePass;
  private bloom!: UnrealBloomPass;
  private filmPass!: ReturnType<typeof createFilmPass>;
  private room!: Room;
  private projector!: Projector;
  private beam!: Beam;
  private roomDust!: ReturnType<typeof buildRoomDust>;
  private film!: Film;
  private program!: ProgramPaper;
  private board!: Board;
  private veil!: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private picture: { mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>; texture: THREE.CanvasTexture } | null =
    null;
  private screenLight!: THREE.RectAreaLight;
  private spot!: THREE.SpotLight;
  private ventLight!: THREE.PointLight;
  private raycaster = new THREE.Raycaster();

  private state: SceneState = {
    lamp: 1,
    tableLamp: 1,
    poleLamp: 1,
    radio: 0,
    running: 0,
    reels: 0,
    beam: 0,
    screen: 0,
    cam: 0,
    ...IDLE_LOOK,
    fade: 1,
    paper: 0,
    open: PROGRAM.open,
    flip: 0,
    focus: 0,
    reel: 0,
    board: 0,
  };
  private tl: gsap.core.Timeline | null = null;
  private paperTl: gsap.core.Timeline | null = null;
  /** The photo off the pin board, while the mode is "photo", and the timeline moving photos on or off it. */
  private heldPhoto: BoardPhoto | null = null;
  private photoTl: gsap.core.Timeline | null = null;
  /** How far the program or a photo is held up, 0 to 1: the camera settles and the room dims behind it. */
  private inHand = 0;
  private view = 0;
  private paperHover = 0;
  private glint = 0;
  private raf = 0;
  private last = 0;
  /** When the last frame was drawn, and the display time owed toward the next one. */
  private drawn = 0;
  private owed = 0;
  private lastInput = 0;
  /** Something covers the whole room, so there's nothing to draw. */
  private held = false;
  /** How far drawing has been cut back for a machine that can't keep up (see lowerQuality). */
  private quality = 0;
  private pace: number[] = [];
  private time = 0;
  private hover = 0;
  private hovering: HoverTarget = null;
  private fixtures: Fixture[] = [];
  /** The pin board's photos, which can be clicked once the camera is at the board. */
  private photoFixtures: Fixture[] = [];
  /** The fixture under the pointer, while hovering is "fixture". */
  private fixture: Fixture | null = null;
  /** Which way each lamp's switch was last flipped (its light may still be fading). */
  private lampsOn = { tableLamp: true, poleLamp: true };
  private radioOn = false;
  /** The fill light's own colors, with the lamps on. */
  private warmFill!: { sky: THREE.Color; ground: THREE.Color };
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
    this.camera = new THREE.PerspectiveCamera(46, 1, 0.03, 30);

    this.film = new Film();
    this.room = buildRoom(this.film.texture);
    scene.add(this.room.group);
    const { lamp, accent, fill, radio } = this.room;
    this.warmFill = { sky: fill.color.clone(), ground: fill.groundColor.clone() };
    this.board = buildBoard();
    scene.add(this.board.group);
    this.fixtures = [
      this.lampSwitch("tableLamp", lamp.hitTargets, (level) => (lamp.base.emissiveIntensity = level * 0.18)),
      this.lampSwitch("poleLamp", accent.hitTargets, (level) => (accent.shades.emissiveIntensity = level * 0.25)),
      {
        targets: radio.hitTargets,
        highlight: (level) => radio.body.forEach((m) => (m.emissiveIntensity = level * 0.22)),
        hover: 0,
        click: () => {
          const on = !this.radioOn;
          this.opts.onRadio?.(on);
          this.sound.knob();
          this.setRadio(on);
        },
      },
      // From the couch the board is one thing: a click goes over to it.
      {
        targets: this.board.hitTargets,
        highlight: (level) => this.board.highlight(level),
        hover: 0,
        click: () => void this.lookAtBoard(),
      },
    ];
    this.photoFixtures = this.board.photos.map((photo, i) => ({
      targets: [photo.mesh],
      highlight: (level) => (photo.hover = level),
      hover: 0,
      click: () => this.holdPhoto(i),
    }));

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

    this.program = buildProgram(small ? 0.6 : 1, Math.min(8, renderer.capabilities.getMaxAnisotropy()));
    scene.add(this.program.group);
    // Dims the room behind the program while it's held up.
    this.veil = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ color: "#000000", transparent: true, opacity: 0, depthWrite: false }),
    );
    this.veil.visible = false;
    scene.add(this.veil);

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

    // Only the scene pass anti-aliases; the passes after it work on plain buffers.
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
    this.composer = new EffectComposer(renderer, target);
    this.scenePass = new ScenePass(scene, this.camera, 4);
    this.composer.addPass(this.scenePass);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.55, 0.85);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.filmPass = createFilmPass();
    this.composer.addPass(this.filmPass);

    this.resize();
    window.addEventListener("resize", () => this.resize());
    this.canvas.addEventListener("pointermove", (e) => this.onPointerMove(e));
    this.canvas.addEventListener("pointerleave", () => this.setHovering(null));

    renderer.shadowMap.needsUpdate = true;
    this.applyState(0);
    this.composer.render();
    this.startLoop();
    gsap.to(this.state, { fade: 0, duration: this.opts.reducedMotion ? 0.01 : 1.4, ease: "power1.out" });
  }

  private raycast(clientX: number, clientY: number, targets: THREE.Object3D[]) {
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    return this.raycaster.intersectObjects(targets, true);
  }

  /** Whether a click at this client position lands on the projector. */
  hitsProjector(clientX: number, clientY: number) {
    return this.raycast(clientX, clientY, this.projector.hitTargets).length > 0;
  }

  /** Whether a click at this client position lands on the program. */
  hitsProgram(clientX: number, clientY: number) {
    return this.raycast(clientX, clientY, this.program.meshes).length > 0;
  }

  /** What a click does while the program is held up. Null means it missed the paper. */
  programHit(clientX: number, clientY: number): ProgramHit | null {
    const hit = this.raycast(clientX, clientY, this.program.meshes)[0];
    if (!hit) return null;
    // The held paper is always centered, so the halves of the screen are the halves of the paper.
    const rect = this.canvas.getBoundingClientRect();
    return { action: this.program.actionAt(hit), side: clientX < rect.left + rect.width / 2 ? -1 : 1 };
  }

  /** Which half of the held photo a click lands on (-1 left, 1 right), or null if it misses the photo. */
  photoHit(clientX: number, clientY: number): -1 | 1 | null {
    if (!this.heldPhoto || !this.raycast(clientX, clientY, [this.heldPhoto.mesh]).length) return null;
    const rect = this.canvas.getBoundingClientRect();
    return clientX < rect.left + rect.width / 2 ? -1 : 1;
  }

  /** Click the fixture at this client position, if there is one. */
  clickFixture(clientX: number, clientY: number) {
    this.fixtureAt(clientX, clientY)?.click();
  }

  /** A click while at the pin board: a photo comes off it, and a click off the board goes back to the couch. */
  clickBoard(clientX: number, clientY: number) {
    if (this.mode !== "board") return;
    const photo = this.fixtureAt(clientX, clientY, this.photoFixtures);
    if (photo) photo.click();
    else if (!this.raycast(clientX, clientY, this.board.hitTargets).length) void this.leaveBoard();
  }

  /** The nearest fixture under this client position. */
  private fixtureAt(clientX: number, clientY: number, fixtures = this.fixtures) {
    let nearest: Fixture | null = null;
    let distance = Infinity;
    for (const f of fixtures) {
      const hit = this.raycast(clientX, clientY, f.targets)[0];
      if (hit && hit.distance < distance) {
        nearest = f;
        distance = hit.distance;
      }
    }
    return nearest;
  }

  /** Switch the radio on or off: its record plays (radio.ts) and its dial lights up. */
  setRadio(on: boolean) {
    if (on === this.radioOn) return;
    this.radioOn = on;
    this.sound.setRadio(on);
    gsap.to(this.state, { radio: on ? 1 : 0, duration: on ? 0.9 : 0.3, ease: "power1.out", overwrite: "auto" });
  }

  /** A lamp that clicks off and on. Its light, and the room's, follow its switch. */
  private lampSwitch(key: "tableLamp" | "poleLamp", targets: THREE.Object3D[], highlight: (level: number) => void): Fixture {
    return {
      targets,
      highlight,
      hover: 0,
      click: () => {
        const on = (this.lampsOn[key] = !this.lampsOn[key]);
        this.sound.snap();
        // A filament lights almost at once and takes a moment to go dark.
        gsap.to(this.state, {
          [key]: on ? 1 : 0,
          duration: on ? 0.12 : 0.35,
          ease: on ? "power2.out" : "power1.out",
          overwrite: "auto",
        });
      },
    };
  }

  /** Where the top of the program is on screen while it stands on the table, for the pick-up prompt. */
  programAnchor() {
    if (this.state.paper > 0.01) return null;
    const p = PROGRAM.position.clone();
    p.y += PAPER.h + 0.035;
    p.project(this.camera);
    if (p.z > 1 || Math.abs(p.x) > 1 || Math.abs(p.y) > 1) return null;
    const rect = this.canvas.getBoundingClientRect();
    return { x: rect.left + ((p.x + 1) / 2) * rect.width, y: rect.top + ((1 - p.y) / 2) * rect.height };
  }

  /** Make the program shimmer on the table, like an item a game wants you to pick up. */
  setGlint(on: boolean) {
    gsap.to(this, { glint: on ? 1 : 0, duration: 0.6 });
  }

  private quick(seconds: number) {
    return this.opts.reducedMotion ? 0.01 : seconds;
  }

  private get views() {
    return this.size.w / this.size.h < 0.9 ? TALL_VIEWS : WIDE_VIEWS;
  }

  private showView() {
    const views = this.views;
    this.opts.onProgramPage(views[this.view].name, this.view === 0, this.view === views.length - 1);
  }

  /** Pick the program up off the table and hold it up to the camera, cover first. */
  pickUp() {
    if (this.mode !== "idle") return;
    this.setMode("program");
    this.setHovering(null);
    this.view = 0;
    this.showView();
    this.sound.rustle();
    this.paperTl?.kill();
    this.paperTl = gsap.timeline({ onComplete: () => (this.paperTl = null) });
    this.paperTl.to(this.state, { paper: 1, open: 0, flip: 0, focus: 0, duration: this.quick(0.75), ease: "power2.inOut" });
  }

  /** Stand the program back on the table. Resolves once it's down. */
  putDown(): Promise<void> {
    if (this.mode !== "program") return Promise.resolve();
    this.sound.rustle(0.6);
    this.paperTl?.kill();
    return new Promise((resolve) => {
      this.paperTl = gsap.timeline({
        onComplete: () => {
          this.paperTl = null;
          this.setMode("idle");
          resolve();
        },
      });
      this.paperTl.to(this.state, {
        paper: 0,
        open: PROGRAM.open,
        flip: 0,
        focus: 0,
        duration: this.quick(0.7),
        ease: "power2.inOut",
      });
    });
  }

  /** Turn the held program: open it to the inside, slide between inside pages, or close it and turn it over. */
  turn(dir: -1 | 1) {
    if (this.mode !== "program" || this.paperTl) return;
    const views = this.views;
    const next = clamp(this.view + dir, 0, views.length - 1);
    if (next === this.view) return;
    const from = views[this.view];
    const to = views[next];
    this.view = next;
    this.showView();
    this.sound.rustle(0.8);
    const s = this.state;
    const tl = gsap.timeline({ onComplete: () => (this.paperTl = null) });
    this.paperTl = tl;
    const ease = "power2.inOut";
    // Turning it over needs it closed first.
    if (from.flip !== to.flip) {
      if (from.open) tl.to(s, { open: 0, focus: 0, duration: this.quick(0.45), ease });
      tl.to(s, { flip: to.flip, duration: this.quick(0.55), ease });
      if (to.open) tl.to(s, { open: to.open, focus: to.focus, duration: this.quick(0.45), ease });
    } else {
      tl.to(s, { open: to.open, focus: to.focus, duration: this.quick(0.6), ease });
    }
  }

  /**
   * Go over to the pin board: the camera leaves the couch and comes to face it, close enough to
   * pick out a photo. Resolves once it's there.
   */
  lookAtBoard(): Promise<void> {
    if (this.mode !== "idle") return Promise.resolve();
    this.setMode("board");
    this.setHovering(null);
    return new Promise((resolve) => {
      gsap.to(this.state, {
        board: 1,
        duration: this.quick(1.1),
        ease: "power2.inOut",
        overwrite: "auto",
        onComplete: resolve,
        onInterrupt: resolve,
      });
    });
  }

  /** Back to the couch from the pin board. The room is the couch's again at once; resolves once the camera is back. */
  leaveBoard(): Promise<void> {
    if (this.mode !== "board") return Promise.resolve();
    this.setMode("idle");
    this.setHovering(null);
    return new Promise((resolve) => {
      gsap.to(this.state, {
        board: 0,
        duration: this.quick(1),
        ease: "power2.inOut",
        overwrite: "auto",
        onComplete: resolve,
        onInterrupt: resolve,
      });
    });
  }

  /** Back to the couch from wherever the pin board has taken the visitor: the photo goes back up, then the camera comes away. */
  async toCouch() {
    await this.pinBack();
    await this.leaveBoard();
  }

  /** At the pin board, take a photo off it and hold it up to the camera: the board's first, or this one (from the end if negative). */
  holdPhoto(index = 0) {
    const photo = this.board.photos.at(index);
    if (this.mode !== "board" || !photo) return;
    this.setMode("photo");
    this.setHovering(null);
    this.liftPhoto(photo, null);
  }

  /** The next or previous photo on the board: the one in hand goes back on its pin as that one comes off. */
  browse(dir: -1 | 1) {
    if (this.mode !== "photo" || !this.heldPhoto || this.photoTl) return;
    const photos = this.board.photos;
    this.liftPhoto(photos[(photos.indexOf(this.heldPhoto) + dir + photos.length) % photos.length], this.heldPhoto);
  }

  private liftPhoto(photo: BoardPhoto, from: BoardPhoto | null) {
    const photos = this.board.photos;
    this.heldPhoto = photo;
    this.board.sharpen(photo, true);
    this.opts.onPhoto(photos.indexOf(photo), photos.length);
    this.sound.pin();
    this.sound.rustle(0.4);
    this.photoTl?.kill();
    const tl = gsap.timeline({
      onComplete: () => {
        this.photoTl = null;
        for (const p of photos) if (p !== photo) this.board.sharpen(p, false);
      },
    });
    this.photoTl = tl;
    const ease = "power2.inOut";
    if (from) tl.to(from, { lift: 0, duration: this.quick(0.7), ease }, 0);
    tl.to(photo, { lift: 1, duration: this.quick(0.8), ease }, from ? this.quick(0.12) : 0);
  }

  /** Pin the photo in hand back on the board, and look at the board again. Resolves once it's back. */
  pinBack(): Promise<void> {
    if (this.mode !== "photo") return Promise.resolve();
    this.photoTl?.kill();
    const photos = this.board.photos;
    this.sound.rustle(0.3);
    return new Promise((resolve) => {
      const tl = gsap.timeline({
        onComplete: () => {
          this.photoTl = null;
          this.heldPhoto = null;
          for (const p of photos) this.board.sharpen(p, false);
          this.sound.pin();
          this.setMode("board");
          resolve();
        },
      });
      this.photoTl = tl;
      // Any photo still on its way back from browsing goes back too.
      for (const p of photos) if (p.lift > 0) tl.to(p, { lift: 0, duration: this.quick(0.7), ease: "power2.inOut" }, 0);
    });
  }

  /**
   * Run the opening: full on a first visit, short after that. After the countdown the
   * screen goes back to bare projector light and the camera moves into it; what's
   * playing stays a surprise until the reel loads.
   */
  start() {
    if (this.mode !== "idle") return;
    if (this.opts.reducedMotion) {
      this.enterQuick();
      return;
    }
    const full = !this.opts.seenIntro();
    this.setMode("playing");
    this.setHovering(null);
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
      tl.call(() => this.film.set("leader"), [], 0.95 + COUNT_STEP * 3);
      tl.to(s, { cam: 1, duration: 1.25, ease: "power2.inOut" }, 2.95);
      tl.to(s, { ...REEL_LOOK, duration: 1.0 }, 3.0);
      tl.call(() => this.beginCrossfade(), [], 4.2);
      tl.to({}, { duration: 0.45 }, 4.2);
    } else {
      tl.call(() => this.sound.startMotor(0.5), [], 0);
      tl.to(s, { lamp: 0.035, duration: 0.4, ease: "power2.inOut" }, 0);
      tl.to(s, { reels: 1, duration: 0.5, ease: "power1.in" }, 0);
      tl.to(s, { running: 1, duration: 0.15 }, 0.1);
      tl.call(() => this.film.set("leader"), [], 0.15);
      tl.to(s, { beam: 1, screen: 1, duration: 0.2 }, 0.15);
      tl.to(s, { ...FILM_LOOK, duration: 0.3 }, 0.15);
      tl.to(s, { cam: 1, duration: 1.05, ease: "power2.inOut" }, 0.55);
      tl.to(s, { ...REEL_LOOK, duration: 0.8 }, 0.6);
      tl.call(() => this.beginCrossfade(), [], 1.6);
      tl.to({}, { duration: 0.45 }, 1.6);
    }
  }

  /**
   * The reels' picture (the game, with its interface drawn in). It plays on the screen as the
   * screen's own image, so things in front of the screen stay in front of it.
   */
  setPicture(canvas: HTMLCanvasElement) {
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0, depthWrite: false });
    // A touch brighter than the texture, to read like light on the screen after tone mapping.
    material.color.setScalar(1.2);
    const width = IMAGE.width;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, (width * GAME_HEIGHT) / GAME_WIDTH), material);
    mesh.position.copy(SCREEN.center);
    mesh.position.z += 0.002;
    mesh.visible = false;
    this.room.group.add(mesh);
    this.picture = { mesh, texture };
  }

  /** Where this point of the window lands on the reel's picture, in game pixels, or null if it misses. */
  pictureAt(clientX: number, clientY: number) {
    if (!this.picture?.mesh.visible) return null;
    const uv = this.raycast(clientX, clientY, [this.picture.mesh])[0]?.uv;
    return uv ? { x: uv.x * GAME_WIDTH, y: (1 - uv.y) * GAME_HEIGHT } : null;
  }

  /** The page opened on a reel: the film is already running and the camera is at the screen. */
  enterReel(reel: ReelId) {
    if (this.mode !== "idle") return;
    Object.assign(this.state, { cam: 1, lamp: REEL_LAMP, beam: 1, screen: 1, running: 1, reels: 1, reel: 1, ...REEL_LOOK });
    this.showReel(reel);
    this.setMode("reel");
  }

  /** Put a still of this reel on the screen, under the live reel, so the light it throws on the room is right. */
  showReel(reel: ReelId) {
    this.film.show(paintReelStill(reel));
    this.film.set("reel");
  }

  /** Cut the opening short. */
  skip() {
    if (this.mode !== "playing") return;
    this.tl?.kill();
    this.tl = null;
    this.film.set("leader");
    gsap.to(this.state, { beam: 1, screen: 1, lamp: 0.035, running: 1, cam: 1, ...REEL_LOOK, duration: 0.3 });
    window.setTimeout(() => this.beginCrossfade(), 300);
    window.setTimeout(() => this.finishEnter(), 750);
  }

  /** Straight to the reel without the camera move (reduced motion). */
  enterQuick() {
    if (this.mode === "reel" || this.mode === "entering") return;
    this.tl?.kill();
    this.tl = null;
    Object.assign(this.state, { cam: 1, lamp: REEL_LAMP, beam: 1, screen: 1, running: 1, reels: 1, ...REEL_LOOK });
    this.film.set("leader");
    this.beginCrossfade();
    window.setTimeout(() => this.finishEnter(), 450);
  }

  /** Stop the opening partway: the projector winds down and the camera settles back on the couch, lights up. */
  abort() {
    if (this.mode !== "playing") return;
    this.tl?.kill();
    this.tl = null;
    this.sound.stopMotor(0.5);
    this.setMode("ending");
    gsap.to(this.state, {
      cam: 0,
      beam: 0,
      screen: 0,
      running: 0,
      reels: 0,
      reel: 0,
      lamp: 1,
      ...IDLE_LOOK,
      duration: this.quick(0.8),
      ease: "power2.inOut",
      onComplete: () => {
        this.film.set("dark");
        this.setMode("idle");
      },
    });
  }

  /** Run the ending: the reel holds on its last frame, the film runs out, the camera pulls back, the lights come up. */
  end() {
    if (this.mode !== "reel" && this.mode !== "entering") return;
    const s = this.state;
    this.tl?.kill();
    Object.assign(s, { cam: 1, beam: 1, screen: 1, running: 1, reels: 1, reel: 1, ...FILM_LOOK, fade: 0 });
    this.setMode("ending");

    if (this.opts.reducedMotion) {
      Object.assign(s, { cam: 0, lamp: 1, beam: 0, screen: 0, running: 0, reels: 0, reel: 0, ...IDLE_LOOK });
      this.film.set("dark");
      window.setTimeout(() => this.setMode("idle"), 450);
      return;
    }

    this.sound.startMotor(0.3);
    const tl = gsap.timeline({ onComplete: () => this.setMode("idle") });
    this.tl = tl;
    tl.call(() => {
      this.film.set("runout");
      this.sound.runout(1.2);
    }, [], 0.7);
    tl.to(s, { reel: 0, duration: 0.2 }, 0.7);
    tl.to(s, { cam: 0, duration: 1.4, ease: "power2.inOut" }, 0.8);
    tl.to(s, { beam: 0, screen: 0, running: 0, duration: 0.35, ease: "power1.in" }, 1.65);
    tl.call(() => this.film.set("dark"), [], 2.0);
    tl.call(() => this.sound.stopMotor(1.1), [], 1.65);
    tl.to(s, { reels: 0, duration: 1.1, ease: "power2.out" }, 1.65);
    tl.to(s, { lamp: 1, duration: 0.9, ease: "power1.inOut" }, 2.0);
    tl.to(s, { ...IDLE_LOOK, duration: 0.8 }, 2.0);
  }

  /** The camera has reached the screen: the reel fades in on it. */
  private beginCrossfade() {
    gsap.to(this.state, { reel: 1, duration: this.quick(0.45), ease: "power1.out" });
    this.setMode("entering");
  }

  private finishEnter() {
    // Only from the fade-in: not if the film was ended or stopped meanwhile.
    if (this.mode !== "entering") return;
    this.tl = null;
    this.sound.stopMotor(0.9);
    Object.assign(this.state, { running: 1, reels: 1, beam: 1, screen: 1, cam: 1, ...REEL_LOOK });
    // House lights come up a little once the reel is on.
    gsap.to(this.state, { lamp: REEL_LAMP, duration: this.quick(1.2), ease: "power1.inOut" });
    this.setMode("reel");
  }

  private setMode(mode: Mode) {
    this.mode = mode;
    // The radio turns down while the film runs.
    this.sound.duckRadio(!onTheCouch(mode));
    this.opts.onMode(mode);
  }

  private setHovering(target: HoverTarget, fixture: Fixture | null = null) {
    this.fixture = fixture;
    if (target === this.hovering) return;
    this.hovering = target;
    this.canvas.style.cursor = target ? "pointer" : "";
    this.opts.onHover(target);
  }

  private onPointerMove(e: PointerEvent) {
    this.lastInput = performance.now();
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    if (e.pointerType !== "mouse") return;
    if (this.mode === "idle") {
      const x = e.clientX;
      const y = e.clientY;
      if (this.hitsProgram(x, y)) this.setHovering("program");
      else if (this.hitsProjector(x, y)) this.setHovering("projector");
      else {
        const fixture = this.fixtureAt(x, y);
        this.setHovering(fixture ? "fixture" : null, fixture);
      }
    } else if (this.mode === "program") {
      // The pointer shows over the paper (turn the page, follow a reel or link); off it, a click puts it down.
      this.canvas.style.cursor = this.hitsProgram(e.clientX, e.clientY) ? "pointer" : "";
    } else if (this.mode === "board") {
      // At the board, each photo brightens under the pointer.
      const photo = this.fixtureAt(e.clientX, e.clientY, this.photoFixtures);
      this.setHovering(photo ? "fixture" : null, photo);
    } else if (this.mode === "photo") {
      // Over the photo, a click goes to the next or previous one; off it, a click pins it back.
      this.canvas.style.cursor = this.photoHit(e.clientX, e.clientY) !== null ? "pointer" : "";
    }
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    const before = this.views;
    this.size = { w, h };
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    const pr = this.renderer.getPixelRatio();
    this.bloom.setSize((w * pr) / 2, (h * pr) / 2);
    this.filmPass.uniforms.uResolution.value.set(w * pr, h * pr);
    this.beam.setPixelRatio(pr);
    this.roomDust.setPixelRatio(pr);
    this.camera.aspect = w / h;
    this.applyCamera();
    // Turning a phone between tall and wide while holding the program: keep showing the same part of it.
    const views = this.views;
    if (views !== before && this.mode === "program") {
      const current = before[this.view];
      this.view = Math.max(0, views.findIndex((v) => v.open === current.open && v.flip === current.flip));
      this.paperTl?.kill();
      this.paperTl = null;
      const { open, flip, focus } = views[this.view];
      Object.assign(this.state, { open, flip, focus });
      this.showView();
    }
  }

  /** Stop drawing while something covers the whole room, and pick up again once it's gone. */
  hold(on: boolean) {
    if (on === this.held) return;
    this.held = on;
    if (on) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    } else {
      this.startLoop();
    }
  }

  private get frameRate() {
    if (!onTheCouch(this.mode)) return MOVING_RATE;
    const moving = gsap.isTweening(this.state) || !!this.photoTl || performance.now() - this.lastInput < SETTLE_MS;
    return moving ? MOVING_RATE : STILL_RATE;
  }

  private startLoop() {
    if (this.raf || this.held) return;
    this.last = this.drawn = performance.now();
    this.owed = 0;
    const tick = (now: number) => {
      this.raf = requestAnimationFrame(tick);
      // Draw only as often as the frame rate asks, however fast the screen refreshes.
      const interval = 1000 / this.frameRate;
      this.owed = Math.min(this.owed + now - this.last, interval * 1.5);
      this.last = now;
      if (this.owed < interval - 1) return;
      this.owed = Math.max(0, this.owed - interval);
      const gap = now - this.drawn;
      this.drawn = now;
      this.watchPace(gap, interval);
      const dt = Math.min(0.05, gap / 1000);
      this.time += dt;
      this.applyState(dt);
      this.composer.render(dt);
      this.opts.onFrame?.();
    };
    this.raf = requestAnimationFrame(tick);
  }

  /**
   * If frames keep coming late, the machine can't keep up: cut back what each frame draws, a step at
   * a time. Gaps over a quarter second are a tab in the background, not a slow machine.
   */
  private watchPace(gap: number, interval: number) {
    if (this.quality >= 3 || gap > 250) return;
    this.pace.push(gap / interval);
    if (this.pace.length < PACE_SAMPLES) return;
    const late = this.pace.sort((a, b) => a - b)[this.pace.length >> 1];
    this.pace = [];
    if (late > 1.4) this.lowerQuality();
  }

  /** First without anti-aliasing, then at one pixel per screen pixel, then without bloom. */
  private lowerQuality() {
    this.quality++;
    if (this.quality === 1) this.scenePass.samples = 0;
    if (this.quality === 2) {
      if (this.renderer.getPixelRatio() > 1) {
        this.renderer.setPixelRatio(1);
        this.resize();
      } else {
        this.quality++;
      }
    }
    if (this.quality === 3) this.bloom.enabled = false;
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

  /**
   * Where the camera ends up while a reel plays: square on to the screen, with the picture filling
   * the part of the view reelRect() gives, so the reel drawn over it lines up exactly.
   */
  private reelPose(aspect: number) {
    const rect = reelRect(aspect, 1);
    const fov = THREE.MathUtils.radToDeg(2 * Math.atan(IMAGE.height / rect.h / (2 * REEL_VIEW.distance)));
    const look = SCREEN.center.clone();
    const eye = look.clone().add(new THREE.Vector3(0, 0, REEL_VIEW.distance));
    return { eye, look, fov };
  }

  /** In front of the pin board, square on, close enough that it fills most of the view, at the couch's field of view. */
  private boardPose(aspect: number, fov: number) {
    const tan = Math.tan(THREE.MathUtils.degToRad(fov / 2));
    const d = Math.max(BOARD.height / (0.78 * 2 * tan), BOARD.width / (0.86 * 2 * tan * aspect));
    const look = BOARD.center.clone();
    const eye = look.clone().add(new THREE.Vector3(0, 0, d));
    return { eye, look };
  }

  private applyCamera() {
    const aspect = this.size.w / this.size.h;
    const a = this.couchPose(aspect);
    const b = this.reelPose(aspect);
    const p = this.boardPose(aspect, a.fov);
    const c = this.state.cam;
    const at = this.state.board;
    const eye = a.eye.clone().lerp(b.eye, c).lerp(p.eye, at);
    const look = a.look.clone().lerp(b.look, c).lerp(p.look, at);
    // Small parallax and breathing while sitting on the couch, calmer at the board or while holding the
    // program or a photo.
    const still = this.opts.reducedMotion ? 0 : (1 - c) * (1 - 0.85 * Math.max(this.inHand, at));
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
    const ease = 1 - Math.exp(-dt * 10);
    this.hover += ((this.hovering === "projector" ? 1 : 0) - this.hover) * ease;
    this.paperHover += ((this.hovering === "program" ? 1 : 0) - this.paperHover) * ease;
    this.inHand = Math.max(s.paper, ...this.board.photos.map((p) => p.lift));

    // Lamps: the house lights, times each lamp's own switch.
    const table = s.lamp * s.tableLamp;
    const pole = s.lamp * s.poleLamp;
    const lamp = this.room.lamp;
    lamp.light.intensity = 12 * table;
    lamp.shade.emissiveIntensity = 0.02 + 0.95 * table;
    lamp.bulb.color.set(palette.lampLight).multiplyScalar(0.2 + 2.8 * table);
    this.room.accent.light.intensity = 3 * pole;
    this.room.accent.glow.emissiveIntensity = 0.04 + 0.7 * pole;
    // The fill is mostly lamp light bouncing around. With the lamps switched off it turns to
    // moonlight, so the room keeps its shapes; the film's dark (house lights down) stays dark.
    const lit = switchedOn(s);
    const fill = this.room.fill;
    fill.color.copy(this.warmFill.sky).lerp(NIGHT_SKY, 1 - lit);
    fill.groundColor.copy(this.warmFill.ground).lerp(NIGHT_GROUND, 1 - lit);
    fill.intensity = 0.15 + s.lamp * (0.35 + 0.4 * lit);
    for (const f of [...this.fixtures, ...this.photoFixtures]) {
      f.hover += ((this.fixture === f ? 1 : 0) - f.hover) * ease;
      f.highlight(f.hover);
    }
    this.room.radio.dial.emissiveIntensity = 0.85 * s.radio;
    // Reduced motion freezes the drifting dust and smoke in place.
    const drift = this.opts.reducedMotion ? 0 : this.time;
    this.roomDust.update(drift, table);

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
    // Bloom would blur the print, so it drops while the program or a photo is held up, and most of
    // the way at the pin board, where the pole lamp is close enough to make the prints glow.
    this.bloom.strength = lerp(lerp(0.55, 0.22, s.cam), 0.05, Math.max(this.inHand, 0.7 * s.board));
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
    const paperAt = this.placeProgram();
    const photoAt = this.placePhotos();
    this.placeVeil(paperAt ?? photoAt, this.inHand);

    // The live reel on the screen, refreshed every frame while it shows.
    if (this.picture) {
      const { mesh, texture } = this.picture;
      mesh.visible = s.reel > 0.001;
      mesh.material.opacity = s.reel;
      if (mesh.visible) texture.needsUpdate = true;
    }
  }

  /**
   * Stand the program on the table, or hold it in front of the camera, or somewhere in between.
   * Returns how far in front of the camera it's held, or null while it stands on the table.
   */
  private placeProgram(): number | null {
    const s = this.state;
    const cam = this.camera;
    const { group } = this.program;
    this.program.pose(s.open, s.flip, s.paper);
    // On the table it catches a little lamp light; held up, it's lit to read.
    const pulse = this.glint * (0.5 + 0.5 * Math.sin(this.time * 2.6)) * (1 - s.paper);
    this.program.setGlow(
      lerp(0.03 + 0.07 * s.lamp * switchedOn(s) + 0.12 * this.paperHover + 0.3 * pulse, 0.92, s.paper),
    );

    tablePos.copy(PROGRAM.position);
    tablePos.y += PAPER.h / 2 + 0.012 * this.paperHover;
    tableQuat.setFromAxisAngle(UP, PROGRAM.yaw);
    if (s.paper <= 0) {
      group.position.copy(tablePos);
      group.quaternion.copy(tableQuat);
      return null;
    }

    // Held close enough to fill most of the view: one page by its height (or width, on a phone), the open
    // spread by its width. With an inside page in focus, that page is what fills the view.
    const tan = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const across = cam.aspect < 0.9 ? 0.95 : 0.9;
    const fit = (w: number, h: number) => Math.max(h / (0.78 * 2 * tan), w / (across * 2 * tan * cam.aspect));
    const page = fit(PAPER.w, PAPER.h);
    const open = clamp(s.open, 0, 1);
    // Drawn back a little while the cover swings toward the camera or the sheet turns over, so neither
    // comes at the viewer.
    const swing = Math.sin(Math.PI * open) * PAPER.w * 0.8 + Math.sin(Math.PI * clamp(s.flip, 0, 1)) * PAPER.w * 0.5;
    const d = lerp(page, lerp(fit(PAPER.w * 2, PAPER.h), page, Math.abs(s.focus)), open) + swing;
    forward.set(0, 0, -1).applyQuaternion(cam.quaternion);
    up.set(0, 1, 0).applyQuaternion(cam.quaternion);
    right.set(1, 0, 0).applyQuaternion(cam.quaternion);
    heldPos
      .copy(cam.position)
      .addScaledVector(forward, d)
      .addScaledVector(up, 2 * d * tan * 0.04)
      .addScaledVector(right, -s.focus * (PAPER.w / 2) * open);
    // A little lift on the way up, so it's picked up rather than slid.
    group.position.lerpVectors(tablePos, heldPos, s.paper).addScaledVector(UP, Math.sin(Math.PI * s.paper) * 0.06);
    group.quaternion.slerpQuaternions(tableQuat, cam.quaternion, s.paper);
    return d;
  }

  /**
   * Pin each photo to the board, or hold it in front of the camera, or somewhere in between.
   * Returns how far in front of the camera the photos off the board are held, or null with none off it.
   */
  private placePhotos(): number | null {
    const cam = this.camera;
    const tan = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    forward.set(0, 0, -1).applyQuaternion(cam.quaternion);
    up.set(0, 1, 0).applyQuaternion(cam.quaternion);
    let heldAt: number | null = null;
    for (const p of this.board.photos) {
      const { mesh, home } = p;
      // On the board it brightens a little under the pointer, or with the whole board from the couch;
      // held up, it's lit to see.
      mesh.material.emissiveIntensity = lerp(0.22 * Math.max(p.hover, this.board.hover), 0.92, p.lift);
      if (p.lift <= 0) {
        mesh.position.copy(home.position);
        mesh.position.z += 0.008 * p.hover;
        mesh.quaternion.copy(home.quaternion);
        continue;
      }
      // Held close enough to fill most of the view, a little above the controls.
      const d = Math.max(p.height / (0.72 * 2 * tan), p.width / (0.86 * 2 * tan * cam.aspect));
      heldPos.copy(cam.position).addScaledVector(forward, d).addScaledVector(up, 2 * d * tan * 0.04);
      // Come in so its size on screen grows evenly, rather than all at the end: lerp the
      // inverse of its depth, then find how far along the way that depth is.
      const far = toPhoto.copy(home.position).sub(cam.position).dot(forward);
      const depth = 1 / lerp(1 / far, 1 / d, p.lift);
      mesh.position.lerpVectors(home.position, heldPos, (far - depth) / (far - d));
      mesh.quaternion.slerpQuaternions(home.quaternion, cam.quaternion, p.lift);
      // While one goes back as the next comes off, the veil stays behind both.
      heldAt = Math.max(heldAt ?? 0, d);
    }
    return heldAt;
  }

  /** Dim the room just behind whatever is held up, as far as it's held up. */
  private placeVeil(d: number | null, level: number) {
    this.veil.visible = d !== null && level > 0;
    if (d === null) return;
    const cam = this.camera;
    const tan = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const vd = d + 0.04;
    const vh = 2 * vd * tan * 1.3;
    forward.set(0, 0, -1).applyQuaternion(cam.quaternion);
    this.veil.position.copy(cam.position).addScaledVector(forward, vd);
    this.veil.quaternion.copy(cam.quaternion);
    this.veil.scale.set(vh * cam.aspect, vh, 1);
    this.veil.material.opacity = 0.62 * level;
  }
}
