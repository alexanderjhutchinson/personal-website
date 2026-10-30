import * as THREE from "three";
import { person } from "../data/resume";
import { SCREEN } from "./layout";
import { FONT_BODY, FONT_DISPLAY, FONT_MONO } from "./textures";

/** What the projector is showing. */
export type FilmScene = "dark" | "leader" | "countdown" | "title" | "end" | "runout";

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
      case "title":
        this.drawTitleCard(person.name, `${person.program} · ${person.school}`, "Reel one");
        break;
      case "end":
        this.drawTitleCard("The End", "Thanks for watching", "Fin");
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

  private drawTitleCard(heading: string, sub: string, eyebrow: string) {
    const { ctx } = this;
    const fadeIn = Math.min(1, this.elapsed / 0.25);
    ctx.fillStyle = "#130e0b";
    ctx.fillRect(-4, -4, W + 8, H + 8);
    ctx.globalAlpha = fadeIn;

    const ink = "#efe4cc";
    const amber = "#e0a33a";
    const inset = 70;
    const x0 = B + inset;
    const y0 = B + inset * 0.75;
    const x1 = W - B - inset;
    const y1 = H - B - inset * 0.75;

    ctx.strokeStyle = ink;
    ctx.lineWidth = 3;
    ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
    ctx.lineWidth = 1.2;
    ctx.strokeRect(x0 + 11, y0 + 11, x1 - x0 - 22, y1 - y0 - 22);
    // Corner ornaments.
    for (const [x, y, sx, sy] of [
      [x0, y0, 1, 1],
      [x1, y0, -1, 1],
      [x0, y1, 1, -1],
      [x1, y1, -1, -1],
    ]) {
      ctx.fillStyle = amber;
      ctx.beginPath();
      ctx.moveTo(x, y - 9);
      ctx.lineTo(x + 9, y);
      ctx.lineTo(x, y + 9);
      ctx.lineTo(x - 9, y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(x + sx * 22, y + sy * 22, 12, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    const cx = W / 2;
    const cy = H / 2;
    ctx.fillStyle = amber;
    ctx.font = `500 17px ${FONT_MONO}`;
    if ("letterSpacing" in ctx) ctx.letterSpacing = "6px";
    ctx.fillText(eyebrow.toUpperCase(), cx, cy - 78);
    if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";

    ctx.fillStyle = ink;
    let size = 80;
    ctx.font = `600 ${size}px ${FONT_DISPLAY}`;
    while (ctx.measureText(heading).width > x1 - x0 - 120 && size > 40) {
      size -= 4;
      ctx.font = `600 ${size}px ${FONT_DISPLAY}`;
    }
    ctx.fillText(heading, cx, cy + 14);

    // Rule with a diamond.
    ctx.strokeStyle = amber;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - 110, cy + 44);
    ctx.lineTo(cx - 14, cy + 44);
    ctx.moveTo(cx + 14, cy + 44);
    ctx.lineTo(cx + 110, cy + 44);
    ctx.stroke();
    ctx.fillStyle = amber;
    ctx.beginPath();
    ctx.moveTo(cx, cy + 37);
    ctx.lineTo(cx + 7, cy + 44);
    ctx.lineTo(cx, cy + 51);
    ctx.lineTo(cx - 7, cy + 44);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#c9b99b";
    ctx.font = `500 23px ${FONT_BODY}`;
    ctx.fillText(sub, cx, cy + 92);
    ctx.globalAlpha = 1;
    this.brightness = 0.16 * fadeIn * this.flicker;
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
