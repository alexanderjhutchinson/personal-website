import { cover, pages, type ProgramSection } from "../data/program";
import type { ReelId } from "../data";
import { rng } from "./random";
import { FONT_BODY, FONT_DISPLAY, FONT_MONO } from "./textures";

// Paints the program's four pages (cover, inside left, inside right, back) on
// canvases for the paper on the coffee table. Drawn large enough to read when
// the paper is held up to the camera.

/** Page size in canvas units. The paper is half-letter, so the same 0.647 ratio. */
export const PAGE_W = 1100;
export const PAGE_H = 1700;

export type RegionAction = { reel: ReelId } | { href: string };

/** A clickable part of a page, in page units. */
export interface Region {
  x: number;
  y: number;
  w: number;
  h: number;
  action: RegionAction;
}

export interface PaintedPage {
  canvas: HTMLCanvasElement;
  regions: Region[];
}

const PAPER = "#efe4c8";
const INK = "#2b1a10";
const DIM = "#6b5240";
const FAINT = "#9c8668";
const ACCENT = "#a8481f";
const MARGIN = 110;

/** A blank page: cream stock with fibers, darker edges, and a double rule inside the edge. */
function blank(scale: number, seed: number) {
  const c = document.createElement("canvas");
  c.width = Math.round(PAGE_W * scale);
  c.height = Math.round(PAGE_H * scale);
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("2D canvas is unavailable");
  ctx.scale(scale, scale);

  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, PAGE_W, PAGE_H);
  const r = rng(seed);
  for (let i = 0; i < 2200; i++) {
    ctx.fillStyle = r() < 0.5 ? "rgba(120, 90, 50, 0.06)" : "rgba(255, 255, 240, 0.08)";
    ctx.fillRect(r() * PAGE_W, r() * PAGE_H, 2 + r() * 6, 1 + r() * 1.5);
  }
  const edge = ctx.createRadialGradient(PAGE_W / 2, PAGE_H / 2, PAGE_H * 0.35, PAGE_W / 2, PAGE_H / 2, PAGE_H * 0.75);
  edge.addColorStop(0, "rgba(120, 90, 50, 0)");
  edge.addColorStop(1, "rgba(120, 90, 50, 0.22)");
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, PAGE_W, PAGE_H);

  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  ctx.strokeRect(40, 40, PAGE_W - 80, PAGE_H - 80);
  ctx.strokeStyle = FAINT;
  ctx.lineWidth = 2;
  ctx.strokeRect(54, 54, PAGE_W - 108, PAGE_H - 108);
  for (const [x, y] of [
    [40, 40],
    [PAGE_W - 40, 40],
    [40, PAGE_H - 40],
    [PAGE_W - 40, PAGE_H - 40],
  ]) {
    diamond(ctx, x, y, 11, ACCENT);
  }
  return { c, ctx };
}

function diamond(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r, y);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r, y);
  ctx.closePath();
  ctx.fill();
}

/** Letter-spaced text, drawn a character at a time so it works in every browser. */
function spaced(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number, align: "left" | "center" | "right") {
  const chars = [...text];
  const width = chars.reduce((w, ch) => w + ctx.measureText(ch).width, 0) + spacing * (chars.length - 1);
  let cx = align === "center" ? x - width / 2 : align === "right" ? x - width : x;
  ctx.textAlign = "left";
  for (const ch of chars) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + spacing;
  }
  return width;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Type size on the inside and back pages, sized to fill them. */
const T = 1.1;

/** A centered heading between two rules. */
function heading(ctx: CanvasRenderingContext2D, text: string, y: number) {
  ctx.font = `500 ${68 * T}px ${FONT_DISPLAY}`;
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.fillText(text, PAGE_W / 2, y);
  const half = ctx.measureText(text).width / 2;
  ctx.fillStyle = FAINT;
  ctx.fillRect(MARGIN, y - 22, PAGE_W / 2 - half - 28 - MARGIN, 2);
  ctx.fillRect(PAGE_W / 2 + half + 28, y - 22, PAGE_W / 2 - half - 28 - MARGIN, 2);
}

function paintSections(ctx: CanvasRenderingContext2D, sections: ProgramSection[], regions: Region[]) {
  const width = PAGE_W - MARGIN * 2;
  let y = 200;
  for (const section of sections) {
    heading(ctx, section.heading, y);
    y += 104 * T;
    ctx.textAlign = "left";
    for (const entry of section.entries ?? []) {
      if (entry.kicker) {
        ctx.font = `500 ${25 * T}px ${FONT_MONO}`;
        ctx.fillStyle = ACCENT;
        spaced(ctx, entry.kicker.toUpperCase(), MARGIN, y, 3, "left");
        y += 46 * T;
      }
      if (entry.title) {
        ctx.font = `600 ${39 * T}px ${FONT_BODY}`;
        ctx.fillStyle = INK;
        ctx.fillText(entry.title, MARGIN, y);
        y += 48 * T;
      }
      ctx.font = `400 ${31 * T}px ${FONT_BODY}`;
      ctx.fillStyle = DIM;
      for (const line of entry.lines) {
        for (const part of wrap(ctx, line, width)) {
          ctx.fillText(part, MARGIN, y);
          y += 42 * T;
        }
      }
      y += 32 * T;
    }
    for (const link of section.links ?? []) {
      ctx.font = `500 ${25 * T}px ${FONT_MONO}`;
      ctx.fillStyle = ACCENT;
      spaced(ctx, link.label.toUpperCase(), MARGIN, y, 3, "left");
      y += 52 * T;
      ctx.font = `500 ${37 * T}px ${FONT_BODY}`;
      ctx.fillStyle = INK;
      ctx.textAlign = "left";
      ctx.fillText(link.display, MARGIN, y);
      const w = ctx.measureText(link.display).width;
      ctx.fillStyle = ACCENT;
      ctx.fillRect(MARGIN, y + 10, w, 3);
      regions.push({ x: MARGIN - 10, y: y - 50, w: w + 20, h: 72, action: { href: link.href } });
      y += 72 * T;
    }
    y += 46 * T;
  }
  // The last line's baseline, less the gap after the last section, has to clear the inner rule.
  if (import.meta.env.DEV && y - 46 * T > PAGE_H - 130) console.warn(`The program's ${sections[0].heading} page runs off the paper.`);
  return y;
}

function paintCover(scale: number): PaintedPage {
  const { c, ctx } = blank(scale, 11);
  const regions: Region[] = [];
  const mid = PAGE_W / 2;

  ctx.font = `500 27px ${FONT_MONO}`;
  ctx.fillStyle = ACCENT;
  const kickerWidth = spaced(ctx, cover.kicker.toUpperCase(), mid, 200, 6, "center");
  diamond(ctx, mid - kickerWidth / 2 - 34, 191, 9, ACCENT);
  diamond(ctx, mid + kickerWidth / 2 + 34, 191, 9, ACCENT);

  const [first, ...rest] = cover.name.split(" ");
  ctx.font = `600 138px ${FONT_DISPLAY}`;
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.fillText(first, mid, 370);
  ctx.fillText(rest.join(" "), mid, 505);

  ctx.fillStyle = INK;
  ctx.fillRect(mid - 170, 584, 140, 2);
  ctx.fillRect(mid + 30, 584, 140, 2);
  diamond(ctx, mid, 585, 10, ACCENT);

  ctx.font = `500 38px ${FONT_BODY}`;
  ctx.fillStyle = DIM;
  cover.standfirst.forEach((line, i) => ctx.fillText(line, mid, 690 + i * 54));

  ctx.font = `500 27px ${FONT_MONO}`;
  ctx.fillStyle = ACCENT;
  spaced(ctx, cover.featureLabel.toUpperCase(), mid, 950, 6, "center");

  cover.reels.forEach((reel, i) => {
    const y = 1060 + i * 118;
    const left = 190;
    const right = PAGE_W - 190;
    ctx.font = `500 27px ${FONT_MONO}`;
    ctx.fillStyle = DIM;
    const noWidth = spaced(ctx, `REEL ${reel.number}`, left, y, 4, "left");
    ctx.font = `500 62px ${FONT_DISPLAY}`;
    ctx.fillStyle = INK;
    ctx.textAlign = "right";
    ctx.fillText(reel.title, right, y);
    const titleWidth = ctx.measureText(reel.title).width;
    // Dotted leader between the number and the title.
    ctx.fillStyle = FAINT;
    for (let x = left + noWidth + 24; x < right - titleWidth - 22; x += 16) ctx.fillRect(x, y - 6, 5, 5);
    regions.push({ x: left - 30, y: y - 72, w: right - left + 60, h: 100, action: { reel: reel.id } });
  });

  ctx.font = `italic 400 31px ${FONT_BODY}`;
  ctx.fillStyle = DIM;
  ctx.textAlign = "center";
  ctx.fillText(cover.note, mid, 1470);

  for (const dx of [-40, 0, 40]) diamond(ctx, mid + dx, 1580, dx ? 6 : 9, dx ? FAINT : ACCENT);
  return { canvas: c, regions };
}

/** All four pages, in order: cover, inside left, inside right, back. */
export function paintProgram(scale: number): PaintedPage[] {
  return [
    paintCover(scale),
    ...pages.map((sections, i) => {
      const { c, ctx } = blank(scale, 23 + i * 7);
      const regions: Region[] = [];
      paintSections(ctx, sections, regions);
      return { canvas: c, regions };
    }),
  ];
}
