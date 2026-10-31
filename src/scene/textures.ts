import * as THREE from "three";
import { palette } from "./palette";
import { rng } from "./random";

// Every surface in the room is painted on a canvas at load time, so the scene
// ships with no image files, except the photos on the pin board (drawn into their prints here).

export const FONT_DISPLAY = '"Fraunces Variable", Georgia, serif';
export const FONT_BODY = '"Instrument Sans Variable", "Helvetica Neue", Arial, sans-serif';
export const FONT_MONO = '"IBM Plex Mono", "Courier New", monospace';

let maxAnisotropy = 4;
export function setMaxAnisotropy(value: number) {
  maxAnisotropy = value;
}

function canvas(width: number, height: number) {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("2D canvas is unavailable");
  return { c, ctx };
}

function texture(c: HTMLCanvasElement, opts: { repeat?: [number, number]; color?: boolean } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = opts.color === false ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (opts.repeat) t.repeat.set(...opts.repeat);
  t.anisotropy = maxAnisotropy;
  return t;
}

function jitter(hex: string, amount: number, r: () => number) {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h + (r() - 0.5) * amount * 0.1, hsl.s, Math.max(0, hsl.l + (r() - 0.5) * amount));
  return `#${c.getHexString()}`;
}

/** Vertical tongue-and-groove wood paneling. */
export function woodPaneling(repeat: [number, number]) {
  const W = 1024;
  const H = 1024;
  const boards = 6;
  const bw = W / boards;
  const r = rng(11);
  const { c, ctx } = canvas(W, H);
  const tones = ["#6a4126", "#5c3820", "#74482a", "#633c22"];

  for (let i = 0; i < boards; i++) {
    const x0 = i * bw;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, 0, bw, H);
    ctx.clip();
    ctx.fillStyle = jitter(tones[i % tones.length], 0.05, r);
    ctx.fillRect(x0, 0, bw, H);

    for (let k = 0; k < 90; k++) {
      const x = x0 + r() * bw;
      const amp = 2 + r() * 7;
      const freq = 0.004 + r() * 0.01;
      const phase = r() * Math.PI * 2;
      const dark = r() < 0.75;
      ctx.strokeStyle = dark
        ? `rgba(30, 14, 6, ${0.05 + r() * 0.14})`
        : `rgba(255, 205, 150, ${0.03 + r() * 0.05})`;
      ctx.lineWidth = 0.6 + r() * 2.4;
      ctx.beginPath();
      for (let y = -20; y <= H + 20; y += 24) {
        const px = x + Math.sin(y * freq + phase) * amp + Math.sin(y * 0.031 + phase) * 0.8;
        if (y === -20) ctx.moveTo(px, y);
        else ctx.lineTo(px, y);
      }
      ctx.stroke();
    }

    // An occasional knot.
    if (r() < 0.6) {
      const kx = x0 + bw * (0.3 + r() * 0.4);
      const ky = r() * H;
      for (let ring = 0; ring < 7; ring++) {
        ctx.strokeStyle = `rgba(35, 16, 6, ${0.25 - ring * 0.03})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(kx, ky, 4 + ring * 4, 10 + ring * 9, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();

    // Groove between boards.
    ctx.fillStyle = "rgba(14, 7, 3, 0.9)";
    ctx.fillRect(x0 - 3, 0, 6, H);
    ctx.fillStyle = "rgba(255, 210, 160, 0.08)";
    ctx.fillRect(x0 + 3, 0, 2, H);
  }
  return texture(c, { repeat });
}

/** Low-pile wall-to-wall carpet. */
export function carpet(base: string, repeat: [number, number], seed = 3) {
  const S = 512;
  const r = rng(seed);
  const { c, ctx } = canvas(S, S);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 60000; i++) {
    ctx.fillStyle = jitter(base, 0.12, r);
    ctx.globalAlpha = 0.35 + r() * 0.5;
    ctx.fillRect(r() * S, r() * S, 1 + r() * 1.5, 1 + r() * 1.5);
  }
  ctx.globalAlpha = 1;
  return texture(c, { repeat });
}

/** Long-pile shag rug: short strands in a few oranges. */
export function shag(repeat: [number, number]) {
  const S = 512;
  const r = rng(7);
  const { c, ctx } = canvas(S, S);
  ctx.fillStyle = "#8f3d17";
  ctx.fillRect(0, 0, S, S);
  const strands = ["#c4622d", "#a84a1c", "#d9773a", "#8f3d17", "#b8571f", "#e08a45"];
  ctx.lineCap = "round";
  for (let i = 0; i < 26000; i++) {
    const x = r() * S;
    const y = r() * S;
    const a = r() * Math.PI * 2;
    const len = 3 + r() * 7;
    ctx.strokeStyle = strands[Math.floor(r() * strands.length)];
    ctx.globalAlpha = 0.55 + r() * 0.45;
    ctx.lineWidth = 1 + r() * 1.8;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  return texture(c, { repeat });
}

/** Interlocking quarter-circle rainbow arcs, the classic 1970s wallpaper. */
export function wallpaper(repeat: [number, number]) {
  const S = 512;
  const cell = S / 2;
  const { c, ctx } = canvas(S, S);
  ctx.fillStyle = "#d9c49b";
  ctx.fillRect(0, 0, S, S);
  const bands = [palette.walnut, palette.burntOrange, palette.mustard, "#d9c49b", palette.walnut, palette.burntOrange];
  const corners: [number, number][] = [
    [0, 0],
    [1, 1],
    [1, 0],
    [0, 1],
  ];
  for (let gx = 0; gx < 2; gx++) {
    for (let gy = 0; gy < 2; gy++) {
      const [cx, cy] = corners[(gx + gy * 2) % 4];
      const ox = gx * cell + cx * cell;
      const oy = gy * cell + cy * cell;
      ctx.save();
      ctx.beginPath();
      ctx.rect(gx * cell, gy * cell, cell, cell);
      ctx.clip();
      for (let b = 0; b < bands.length; b++) {
        ctx.strokeStyle = bands[b];
        ctx.lineWidth = 19;
        ctx.beginPath();
        ctx.arc(ox, oy, cell - 14 - b * 21, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
  // Paper texture.
  const r = rng(5);
  for (let i = 0; i < 9000; i++) {
    ctx.fillStyle = r() < 0.5 ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.05)";
    ctx.fillRect(r() * S, r() * S, 2, 2);
  }
  return texture(c, { repeat });
}

/** Woven speaker-grille fabric for the radio. */
export function grilleCloth() {
  const S = 128;
  const { c, ctx } = canvas(S, S);
  ctx.fillStyle = "#7a5a2c";
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < S; i += 4) {
    ctx.fillStyle = "rgba(230, 190, 110, 0.35)";
    ctx.fillRect(i, 0, 2, S);
    ctx.fillStyle = "rgba(40, 24, 10, 0.4)";
    ctx.fillRect(0, i, S, 2);
  }
  return texture(c, { repeat: [3, 2] });
}

/** Original placeholder film posters. Real picks replace these later. */
export function poster(kind: "late-show" | "double-feature") {
  const W = 512;
  const H = 768;
  const { c, ctx } = canvas(W, H);
  if (kind === "late-show") {
    ctx.fillStyle = "#24160f";
    ctx.fillRect(0, 0, W, H);
    // Striped setting sun.
    const sunBands = [palette.mustard, palette.harvestGold, palette.burntOrange, palette.rust];
    ctx.save();
    ctx.beginPath();
    ctx.arc(W / 2, 420, 170, 0, Math.PI * 2);
    ctx.clip();
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = sunBands[Math.min(sunBands.length - 1, Math.floor(i / 2.6))];
      const y = 250 + i * 34;
      ctx.fillRect(0, y, W, 34 - Math.min(14, i * 1.6));
    }
    ctx.restore();
    // Horizon.
    ctx.fillStyle = palette.walnut;
    ctx.fillRect(0, 520, W, 248);
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i % 2 ? palette.rust : palette.burntOrange;
      ctx.fillRect(0, 540 + i * 18, W, 6);
    }
    ctx.fillStyle = palette.cream;
    ctx.textAlign = "center";
    ctx.font = `600 66px ${FONT_DISPLAY}`;
    ctx.fillText("The Late Show", W / 2, 120);
    ctx.font = `500 20px ${FONT_MONO}`;
    ctx.fillStyle = palette.mustard;
    ctx.fillText("FRIDAY · 11 PM · ADMIT ONE", W / 2, 690);
  } else {
    ctx.fillStyle = palette.avocado;
    ctx.fillRect(0, 0, W, H);
    const reel = (x: number, y: number, rad: number, color: string) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = palette.avocado;
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * rad * 0.55, y + Math.sin(a) * rad * 0.55, rad * 0.22, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(x, y, rad * 0.1, 0, Math.PI * 2);
      ctx.fill();
    };
    reel(200, 300, 150, palette.cream);
    reel(330, 430, 120, palette.burntOrange);
    ctx.fillStyle = palette.cream;
    ctx.textAlign = "center";
    ctx.font = `700 58px ${FONT_DISPLAY}`;
    ctx.fillText("Double", W / 2, 630);
    ctx.fillText("Feature", W / 2, 690);
    ctx.font = `500 18px ${FONT_MONO}`;
    ctx.fillStyle = palette.mustard;
    ctx.fillText("TWO REELS · ONE NIGHT", W / 2, 90);
  }
  return texture(c);
}

/** Lid of a film can, with a paper label naming what's on the reel. */
export function canLid(label: string, accent: string) {
  const S = 256;
  const { c, ctx } = canvas(S, S);
  const mid = S / 2;
  ctx.fillStyle = "#8f8a80";
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 12; i++) {
    ctx.strokeStyle = i % 2 ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.18)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(mid, mid, 124 - i * 4, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = palette.cream;
  ctx.beginPath();
  ctx.arc(mid, mid, 78, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(mid, mid, 70, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = palette.chocolate;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `600 ${label.length > 8 ? 17 : 21}px ${FONT_MONO}`;
  ctx.fillText(label.toUpperCase(), mid, mid);
  return texture(c);
}

/** Plastic projector reel with three cut-out windows (uses alpha). */
export function reelFace(color: string) {
  const S = 256;
  const { c, ctx } = canvas(S, S);
  const mid = S / 2;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(mid, mid, 127, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(mid, mid, 122, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalCompositeOperation = "destination-out";
  for (let k = 0; k < 3; k++) {
    const a0 = (k / 3) * Math.PI * 2 + 0.25;
    const a1 = a0 + Math.PI * 2 * 0.24;
    ctx.beginPath();
    ctx.arc(mid, mid, 104, a0, a1);
    ctx.arc(mid, mid, 42, a1, a0, true);
    ctx.closePath();
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(mid, mid, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";
  const t = texture(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/** Matte screen fabric with the black masking border. */
export function screenFabric(width: number, height: number, border: number) {
  const W = 1024;
  const H = Math.round((W * height) / width);
  const { c, ctx } = canvas(W, H);
  ctx.fillStyle = "#14110f";
  ctx.fillRect(0, 0, W, H);
  const b = Math.round(border * W);
  ctx.fillStyle = "#ebe6da";
  ctx.fillRect(b, b, W - b * 2, H - b * 2);
  const r = rng(19);
  for (let i = 0; i < 20000; i++) {
    ctx.fillStyle = r() < 0.5 ? "rgba(0,0,0,0.035)" : "rgba(255,255,255,0.05)";
    ctx.fillRect(b + r() * (W - b * 2), b + r() * (H - b * 2), 1.5, 1.5);
  }
  const t = texture(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/** Night sky seen through the window. */
export function nightSky() {
  const W = 256;
  const H = 384;
  const { c, ctx } = canvas(W, H);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#0b1430");
  g.addColorStop(0.7, "#1c2a52");
  g.addColorStop(1, "#2a3358");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const r = rng(23);
  for (let i = 0; i < 70; i++) {
    ctx.fillStyle = `rgba(230, 236, 255, ${0.3 + r() * 0.7})`;
    const s = r() < 0.1 ? 2 : 1;
    ctx.fillRect(r() * W, r() * H * 0.75, s, s);
  }
  const moon = ctx.createRadialGradient(190, 80, 4, 190, 80, 60);
  moon.addColorStop(0, "rgba(240, 240, 255, 1)");
  moon.addColorStop(0.18, "rgba(220, 228, 255, 0.9)");
  moon.addColorStop(0.3, "rgba(160, 180, 240, 0.25)");
  moon.addColorStop(1, "rgba(120, 140, 220, 0)");
  ctx.fillStyle = moon;
  ctx.fillRect(0, 0, W, H);
  // Distant treeline.
  ctx.fillStyle = "#070b18";
  ctx.beginPath();
  ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 8) ctx.lineTo(x, H - 40 - Math.abs(Math.sin(x * 0.07)) * 30 - r() * 14);
  ctx.lineTo(W, H);
  ctx.fill();
  const t = texture(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/** Snake plant leaf: dark green with banding and yellow edges. */
export function snakeLeaf() {
  const W = 64;
  const H = 256;
  const { c, ctx } = canvas(W, H);
  ctx.fillStyle = "#c9b54a";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#2f4a22";
  ctx.fillRect(7, 0, W - 14, H);
  const r = rng(29);
  for (let y = 0; y < H; y += 6 + r() * 6) {
    ctx.strokeStyle = `rgba(150, 175, 110, ${0.2 + r() * 0.25})`;
    ctx.lineWidth = 2 + r() * 2;
    ctx.beginPath();
    ctx.moveTo(7, y);
    for (let x = 7; x <= W - 7; x += 6) ctx.lineTo(x, y + Math.sin(x * 0.3 + y) * 3);
    ctx.stroke();
  }
  const t = texture(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/** Cork for the pin board: tan, with darker and lighter granules. */
export function cork(repeat: [number, number]) {
  const S = 512;
  const r = rng(61);
  const { c, ctx } = canvas(S, S);
  ctx.fillStyle = "#b07f4a";
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 16000; i++) {
    const dark = r() < 0.55;
    ctx.fillStyle = dark ? `rgba(84, 50, 22, ${0.12 + r() * 0.35})` : `rgba(228, 190, 132, ${0.1 + r() * 0.3})`;
    const s = 1 + r() * 3;
    ctx.fillRect(r() * S, r() * S, s, s * (0.5 + r() * 0.6));
  }
  return texture(c, { repeat });
}

/** A cinema ticket stub, pinned to the board. */
export function ticket() {
  const W = 256;
  const H = 112;
  const { c, ctx } = canvas(W, H);
  ctx.fillStyle = "#d77a3e";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = palette.cream;
  ctx.lineWidth = 2;
  ctx.strokeRect(10, 10, W - 20, H - 20);
  ctx.setLineDash([4, 5]);
  ctx.beginPath();
  ctx.moveTo(56, 10);
  ctx.lineTo(56, H - 10);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = palette.cream;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `600 26px ${FONT_MONO}`;
  ctx.fillText("ADMIT ONE", 152, 48);
  ctx.font = `500 13px ${FONT_MONO}`;
  ctx.fillText("THE LATE SHOW", 152, 78);
  ctx.save();
  ctx.translate(33, H / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.font = `500 14px ${FONT_MONO}`;
  ctx.fillText("No 0418", 0, 0);
  ctx.restore();
  const t = texture(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/** A print's shape: its width over its height, and where the picture sits on it as fractions from the top left. */
export interface PrintLayout {
  aspect: number;
  picture: { x: number; y: number; w: number; h: number };
}

/** Faded, warm and soft, like a print back from the drugstore lab: lifted blacks, a vignette, and grain. */
function fadePrint(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.globalCompositeOperation = "screen";
  ctx.fillStyle = "rgba(72, 46, 26, 0.38)";
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = "#ffe7c4";
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = "source-over";
  const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.6);
  v.addColorStop(0, "rgba(30, 15, 5, 0)");
  v.addColorStop(1, "rgba(30, 15, 5, 0.32)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
  const r = rng(71);
  const dot = Math.max(1, w / 500);
  for (let i = 0; i < (w * h) / 24; i++) {
    ctx.fillStyle = r() < 0.5 ? "rgba(0, 0, 0, 0.07)" : "rgba(255, 240, 220, 0.06)";
    ctx.fillRect(r() * w, r() * h, dot, dot);
  }
}

/**
 * A photo print: the picture inside a white border. longSide is the print's long side in pixels, so the
 * same print can be painted small for the board and sharp for holding up. Until the photo has loaded,
 * the picture's place is dark.
 */
export function print(photo: HTMLImageElement | null, layout: PrintLayout, longSide: number) {
  const W = Math.round(layout.aspect >= 1 ? longSide : longSide * layout.aspect);
  const H = Math.round(layout.aspect >= 1 ? longSide / layout.aspect : longSide);
  const { c, ctx } = canvas(W, H);
  const paper = ctx.createLinearGradient(0, 0, 0, H);
  paper.addColorStop(0, "#f2ecdd");
  paper.addColorStop(1, "#e6dcc6");
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, W, H);
  const { x, y, w, h } = layout.picture;
  const pw = w * W;
  const ph = h * H;
  ctx.save();
  ctx.translate(Math.round(x * W), Math.round(y * H));
  ctx.beginPath();
  ctx.rect(0, 0, Math.round(pw), Math.round(ph));
  ctx.clip();
  if (photo) {
    // Fill the picture's place, trimming a sliver off the photo if their shapes differ a hair.
    const scale = Math.max(pw / photo.naturalWidth, ph / photo.naturalHeight);
    const dw = photo.naturalWidth * scale;
    const dh = photo.naturalHeight * scale;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(photo, (pw - dw) / 2, (ph - dh) / 2, dw, dh);
  } else {
    ctx.fillStyle = "#2a231e";
    ctx.fillRect(0, 0, pw, ph);
  }
  fadePrint(ctx, pw, ph);
  ctx.restore();
  const t = texture(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}
