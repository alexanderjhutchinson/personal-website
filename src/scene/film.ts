import * as THREE from "three";
import { SCREEN } from "./layout";
import { FONT_BODY } from "./textures";

/** What the projector is showing. */
/** "reel" is a still of one of the feature's reels, set with show(). */
export type FilmScene = "dark" | "leader" | "countdown" | "reel" | "runout";

/** Seconds each countdown number stays on screen. */
export const COUNT_STEP = 0.6;

const FPS = 18; // Super 8 runs at 18 frames per second.
const W = 1024;
const H = Math.round((W * SCREEN.height) / SCREEN.width);
const B = Math.round(SCREEN.border * W);

interface Scratch {
  x: number;
  width: number;
  alpha: number;
  life: number;
}

/**
 * The picture on the screen, drawn into a canvas every frame and used as the
 * screen's emissive texture. Includes film grain, gate weave, flicker,
 * scratches, and dust so it reads as old film even before post-processing.
 */
export class Film {
  readonly canvas: HTMLCanvasElement;
  readonly texture: THREE.CanvasTexture;
  /** Rough average brightness of the current frame (0 to 1). Drives the beam and the light the screen throws on the room. */
  brightness = 0;
  scene: FilmScene = "dark";

  private ctx: CanvasRenderingContext2D;
  private time = 0;
  private sceneStart = 0;
  private frame = -1;
  private flicker = 1;
  private weave = { x: 0, y: 0 };
  private scratches: Scratch[] = [];
  private specks: { x: number; y: number; r: number; hair: boolean; a: number }[] = [];
  private grain: CanvasPattern[] = [];
  private picture: HTMLCanvasElement | null = null;
  private pictureLight = 0;

  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = W;
    this.canvas.height = H;
    const ctx = this.canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas is unavailable");
    this.ctx = ctx;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;

    for (let i = 0; i < 3; i++) {
      const tile = document.createElement("canvas");
      tile.width = tile.height = 192;
      const t = tile.getContext("2d");
      if (!t) continue;
      const img = t.createImageData(192, 192);
      for (let p = 0; p < img.data.length; p += 4) {
        const v = Math.random() * 255;
        img.data[p] = img.data[p + 1] = img.data[p + 2] = v;
        img.data[p + 3] = 40;
      }
      t.putImageData(img, 0, 0);
      const pattern = ctx.createPattern(tile, "repeat");
      if (pattern) this.grain.push(pattern);
    }
    this.clear();
  }

  set(scene: FilmScene) {
    this.scene = scene;
    this.sceneStart = this.time;
  }

  /** The picture the "reel" scene shows. */
  show(picture: HTMLCanvasElement) {
    this.picture = picture;
    // Its average brightness, for the beam and the light it throws on the room.
    const sample = document.createElement("canvas");
    sample.width = 16;
    sample.height = 9;
    const s = sample.getContext("2d");
    if (!s) return;
    s.drawImage(picture, 0, 0, 16, 9);
    const data = s.getImageData(0, 0, 16, 9).data;
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) sum += (data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11) / 255;
    this.pictureLight = sum / (data.length / 4);
  }

  /** Seconds since the current scene started. */
  get elapsed() {
    return this.time - this.sceneStart;
  }

  update(dt: number) {
    this.time += dt;
    const frame = Math.floor(this.time * FPS);
    if (frame !== this.frame) {
      this.frame = frame;
      this.newFilmFrame();
    }
    this.draw();
    this.texture.needsUpdate = true;
  }

  private clear() {
    this.ctx.fillStyle = "#000";
    this.ctx.fillRect(0, 0, W, H);
    this.texture.needsUpdate = true;
  }

  /** Randomness changes once per film frame, not once per display frame, so the flicker steps like real film. */
  private newFilmFrame() {
    this.flicker = 0.9 + Math.random() * 0.12;
    this.weave.x = Math.sin(this.time * 1.7) * 1.4 + (Math.random() - 0.5) * 0.8;
    this.weave.y = Math.sin(this.time * 2.3) * 1.8 + (Math.random() - 0.5) * 1.2;

    const heavy = this.scene === "leader" || this.scene === "runout";
    this.scratches = this.scratches
      .map((s) => ({ ...s, x: s.x + (Math.random() - 0.5) * 3, life: s.life - 1 }))
      .filter((s) => s.life > 0);
    if (Math.random() < (heavy ? 0.5 : 0.12)) {
      this.scratches.push({
        x: B + Math.random() * (W - 2 * B),
        width: 0.8 + Math.random() * 1.6,
        alpha: 0.25 + Math.random() * 0.45,
        life: 2 + Math.floor(Math.random() * (heavy ? 14 : 6)),
      });
    }
    this.specks = [];
    const count = heavy ? 4 : Math.random() < 0.35 ? 1 : 0;
    for (let i = 0; i < count; i++) {
      this.specks.push({
        x: B + Math.random() * (W - 2 * B),
        y: B + Math.random() * (H - 2 * B),
        r: 1.5 + Math.random() * 4,
        hair: Math.random() < 0.2,
        a: 0.35 + Math.random() * 0.5,
      });
    }
  }

  private draw() {
    const { ctx } = this;
    ctx.save();
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    ctx.beginPath();
    ctx.rect(B, B, W - 2 * B, H - 2 * B);
    ctx.clip();
    ctx.translate(this.weave.x, this.weave.y);

    let light = false;
    switch (this.scene) {
      case "dark":
        this.brightness = 0;
        break;
      case "leader":
        this.drawLeader();
        light = true;
        break;
      case "countdown":
        this.drawCountdown();
        light = true;
        break;
      case "reel":
        this.drawPicture();
        break;
      case "runout":
        this.drawRunout();
        light = true;
        break;
    }

    if (this.scene !== "dark") {
      this.drawDamage(light);
      // Grain.
      const pattern = this.grain[this.frame % this.grain.length];
      if (pattern) {
        pattern.setTransform(new DOMMatrix().translate(Math.random() * 192, Math.random() * 192));
        ctx.fillStyle = pattern;
        ctx.globalCompositeOperation = light ? "multiply" : "screen";
        ctx.fillRect(-4, -4, W + 8, H + 8);
        ctx.globalCompositeOperation = "source-over";
      }
      // Hot spot in the middle, falling off toward the corners.
      const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, W * 0.62);
      v.addColorStop(0, "rgba(0,0,0,0)");
      v.addColorStop(1, `rgba(0,0,0,${light ? 0.38 : 0.5})`);
      ctx.fillStyle = v;
      ctx.fillRect(-4, -4, W + 8, H + 8);
      // Per-frame flicker.
      ctx.fillStyle = `rgba(0,0,0,${Math.max(0, 1 - this.flicker)})`;
      ctx.fillRect(-4, -4, W + 8, H + 8);
    }
    ctx.restore();
  }

  private drawLeader() {
    const { ctx } = this;
    const e = this.elapsed;
    const level = Math.min(1, e / 0.12);
    ctx.fillStyle = `rgb(${Math.round(244 * level)}, ${Math.round(236 * level)}, ${Math.round(214 * level)})`;
    ctx.fillRect(-4, -4, W + 8, H + 8);
    // A frame line rolls through once as the film settles into the gate.
    if (e < 0.35) {
      const y = ((e / 0.35) * (H + 120)) - 60;
      ctx.fillStyle = "rgba(20, 14, 10, 0.85)";
      ctx.fillRect(-4, y, W + 8, 26);
    }
    this.brightness = 0.95 * level * this.flicker;
  }

  private drawCountdown() {
    const { ctx } = this;
    const e = this.elapsed;
    const step = Math.floor(e / COUNT_STEP);
    const n = Math.max(1, 3 - step);
    const frac = Math.min(1, (e - step * COUNT_STEP) / COUNT_STEP);
    const cx = W / 2;
    const cy = H / 2;
    const R = H * 0.36;

    ctx.fillStyle = "#b3ab98";
    ctx.fillRect(-4, -4, W + 8, H + 8);
    // Sweep.
    ctx.fillStyle = "#6e675a";
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, W, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
    ctx.closePath();
    ctx.fill();
    // Crosshair.
    ctx.strokeStyle = "#1c1814";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(W, cy);
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, H);
    ctx.stroke();
    // Rings.
    ctx.strokeStyle = "#f4efe2";
    ctx.lineWidth = 7;
    for (const r of [R, R * 0.82]) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Number.
    ctx.fillStyle = "#14110e";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 ${Math.round(R * 1.15)}px ${FONT_BODY}`;
    ctx.fillText(String(n), cx, cy + R * 0.06);
    this.brightness = 0.6 * this.flicker;
  }

  /** The reel's still, as large as fits inside the masking. */
  private drawPicture() {
    const { ctx, picture } = this;
    if (!picture) return;
    const iw = W - 2 * B;
    const ih = H - 2 * B;
    const scale = Math.min(iw / picture.width, ih / picture.height);
    const w = picture.width * scale;
    const h = picture.height * scale;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(picture, B + (iw - w) / 2, B + (ih - h) / 2, w, h);
    ctx.imageSmoothingEnabled = true;
    this.brightness = this.pictureLight * this.flicker;
  }

  private drawRunout() {
    const { ctx } = this;
    const strobe = Math.random() < 0.3 ? 0.75 : 1;
    const g = Math.round(250 * strobe);
    ctx.fillStyle = `rgb(${g}, ${g - 6}, ${g - 22})`;
    ctx.fillRect(-4, -4, W + 8, H + 8);
    this.brightness = strobe * this.flicker;
  }

  private drawDamage(light: boolean) {
    const { ctx } = this;
    for (const s of this.scratches) {
      ctx.fillStyle = light ? `rgba(60, 44, 30, ${s.alpha})` : `rgba(255, 248, 230, ${s.alpha * 0.6})`;
      ctx.fillRect(s.x, -4, s.width, H + 8);
    }
    for (const d of this.specks) {
      ctx.fillStyle = light ? `rgba(30, 22, 14, ${d.a})` : `rgba(250, 240, 220, ${d.a * 0.7})`;
      ctx.strokeStyle = ctx.fillStyle;
      if (d.hair) {
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.bezierCurveTo(d.x + 18, d.y - 10, d.x + 6, d.y + 26, d.x + 30, d.y + 30);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.ellipse(d.x, d.y, d.r, d.r * (0.5 + Math.random() * 0.5), Math.random() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}
