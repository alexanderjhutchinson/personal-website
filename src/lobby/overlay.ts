import { WIDTH } from "./config";
import { contentIcon } from "./content";
import { HOTBAR_SIZE, type Inventory } from "./inventory";
import { ITEMS, itemIcon } from "./items";
import { ITEM_TYPES, reelItems, type Reel } from "../data";

// The reel's interface, drawn into the picture with the scene so it's projected
// onto the room's screen with it: the hotbar, the selected item's name, item
// tooltips, the reel's item panel, and the reel's title card. Everything here
// is laid out in game pixels; the picture is drawn at SCALE times that, so text
// stays sharp.

/** How many picture pixels make one game pixel. */
export const SCALE = 3;

const PIXEL = '"Pixelify Sans", monospace';
const DISPLAY = '"Fraunces Variable", Georgia, serif';
const BODY = '"Instrument Sans Variable", "Helvetica Neue", Arial, sans-serif';
const MONO = '"IBM Plex Mono", "Courier New", monospace';
const INK = "#ece1c9";
const INK_DIM = "#b9aa8d";
const AMBER = "#e0a33a";
const PANEL_BG = "rgba(15, 11, 8, 0.86)";

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Something on the interface that a click acts on. */
export type Target = { kind: "slot"; index: number } | { kind: "item"; key: string };

const within = (b: Box, x: number, y: number) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h;

const SLOT = 20;
const slotBox = (i: number): Box => ({ x: 4 + i * (SLOT + 1), y: 4, w: SLOT, h: SLOT });

const PANEL_W = 132;
const PANEL_X = WIDTH - 4 - PANEL_W;
const PANEL_PAD = 5;
const ENTRY_ICON = 14;

function spaced(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number, align: "left" | "center") {
  const chars = [...text];
  const width = chars.reduce((w, ch) => w + ctx.measureText(ch).width, 0) + spacing * (chars.length - 1);
  let cx = align === "center" ? x - width / 2 : x;
  ctx.textAlign = "left";
  for (const ch of chars) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + spacing;
  }
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

export class Overlay {
  /** What the pointer is over, for highlights and tooltips. */
  hover: Target | null = null;

  private inv: Inventory;
  private entries: { box: Box; key: string }[] = [];
  private panel: Box | null = null;
  private title: { reel: Reel; start: number } | null = null;

  constructor(inv: Inventory) {
    this.inv = inv;
  }

  /** Show the reel's title card, starting now. */
  showTitle(reel: Reel, now: number) {
    this.title = { reel, start: now };
  }

  /** What's at this point of the picture, in game pixels. */
  at(x: number, y: number): Target | null {
    for (let i = 0; i < HOTBAR_SIZE; i++) if (within(slotBox(i), x, y)) return { kind: "slot", index: i };
    const entry = this.entries.find((e) => within(e.box, x, y));
    return entry ? { kind: "item", key: entry.key } : null;
  }

  /** Whether this point is on the interface rather than the world, so a click there doesn't dig. */
  covers(x: number, y: number) {
    return !!this.at(x, y) || (!!this.panel && within(this.panel, x, y));
  }

  /** Draw onto a picture SCALE times the game's size. */
  draw(ctx: CanvasRenderingContext2D, reel: Reel, now: number) {
    ctx.save();
    ctx.scale(SCALE, SCALE);
    ctx.textBaseline = "alphabetic";
    this.drawPanel(ctx, reel);
    this.drawHotbar(ctx);
    this.drawTooltip(ctx);
    this.drawTitle(ctx, now);
    ctx.restore();
  }

  private drawHotbar(ctx: CanvasRenderingContext2D) {
    const { inv } = this;
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const b = slotBox(i);
      const slot = inv.slots[i];
      const selected = i === inv.selected;
      const hovered = this.hover?.kind === "slot" && this.hover.index === i;
      ctx.fillStyle = selected ? "rgba(70, 48, 20, 0.84)" : "rgba(30, 21, 14, 0.72)";
      ctx.beginPath();
      ctx.roundRect(b.x, b.y, b.w, b.h, 1.5);
      ctx.fill();
      ctx.strokeStyle = selected ? AMBER : hovered ? INK : "rgba(185, 170, 141, 0.55)";
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.roundRect(b.x + 0.45, b.y + 0.45, b.w - 0.9, b.h - 0.9, 1.2);
      ctx.stroke();
      if (slot) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(itemIcon(slot.item), b.x + 2, b.y + 2, 16, 16);
      }
      ctx.font = `500 4.3px ${PIXEL}`;
      ctx.textAlign = "left";
      ctx.fillStyle = "rgba(244, 238, 223, 0.7)";
      ctx.fillText(String((i + 1) % 10), b.x + 1.8, b.y + 5);
      if (slot && ITEMS[slot.item].stackable) {
        ctx.font = `500 4.6px ${PIXEL}`;
        ctx.textAlign = "right";
        ctx.fillStyle = "#000";
        ctx.fillText(String(slot.count), b.x + b.w - 1.3, b.y + b.h - 1.2);
        ctx.fillStyle = "#f4eedf";
        ctx.fillText(String(slot.count), b.x + b.w - 1.6, b.y + b.h - 1.5);
      }
    }
    // The selected item's name under the hotbar.
    const current = inv.current;
    if (current) {
      ctx.font = `500 6px ${PIXEL}`;
      ctx.textAlign = "left";
      ctx.fillStyle = "#000";
      ctx.fillText(ITEMS[current.item].name, 4.4, 31.4);
      ctx.fillStyle = "#f4eedf";
      ctx.fillText(ITEMS[current.item].name, 4, 31);
    }
  }

  private drawTooltip(ctx: CanvasRenderingContext2D) {
    if (this.hover?.kind !== "slot") return;
    const slot = this.inv.slots[this.hover.index];
    if (!slot) return;
    const def = ITEMS[slot.item];
    const b = slotBox(this.hover.index);
    const name = def.stackable && slot.count > 1 ? `${def.name} (${slot.count})` : def.name;
    ctx.font = `600 4.6px ${BODY}`;
    let w = ctx.measureText(name).width;
    ctx.font = `400 4px ${BODY}`;
    for (const line of def.lines) w = Math.max(w, ctx.measureText(line).width);
    const box = { x: b.x, y: b.y + b.h + 9, w: w + 8, h: 9 + def.lines.length * 5.5 };
    ctx.fillStyle = "rgba(15, 11, 8, 0.92)";
    ctx.fillRect(box.x, box.y, box.w, box.h);
    ctx.strokeStyle = "rgba(236, 225, 201, 0.4)";
    ctx.lineWidth = 0.35;
    ctx.strokeRect(box.x + 0.2, box.y + 0.2, box.w - 0.4, box.h - 0.4);
    ctx.textAlign = "left";
    ctx.font = `600 4.6px ${BODY}`;
    ctx.fillStyle = def.color;
    ctx.fillText(name, box.x + 4, box.y + 7);
    ctx.font = `400 4px ${BODY}`;
    ctx.fillStyle = INK;
    def.lines.forEach((line, i) => ctx.fillText(line, box.x + 4, box.y + 12.5 + i * 5.5));
  }

  /** The reel's items, in the room's style: a dark card with a double rule, a title-card heading, and the items. */
  private drawPanel(ctx: CanvasRenderingContext2D, reel: Reel) {
    const items = reelItems[reel.id];
    const textX = PANEL_X + PANEL_PAD + ENTRY_ICON + 4;
    const textW = PANEL_X + PANEL_W - PANEL_PAD - textX;

    // Lay out first, to know the height.
    ctx.font = `600 4.8px ${BODY}`;
    const rows = items.map((item) => {
      ctx.font = `600 4.8px ${BODY}`;
      const name = wrap(ctx, item.name, textW);
      ctx.font = `400 3.6px ${MONO}`;
      const sub = wrap(ctx, item.sub, textW);
      const h = Math.max(ENTRY_ICON + 2, name.length * 5.6 + sub.length * 4.6 + 3);
      return { item, name, sub, h };
    });
    const top = 4;
    const headH = 18;
    const height = PANEL_PAD + headH + rows.reduce((n, r) => n + r.h + 1.5, 0) + PANEL_PAD - 1.5;
    this.panel = { x: PANEL_X, y: top, w: PANEL_W, h: height };

    ctx.fillStyle = PANEL_BG;
    ctx.fillRect(PANEL_X, top, PANEL_W, height);
    ctx.lineWidth = 0.35;
    ctx.strokeStyle = "rgba(236, 225, 201, 0.45)";
    ctx.strokeRect(PANEL_X + 0.2, top + 0.2, PANEL_W - 0.4, height - 0.4);
    ctx.strokeStyle = "rgba(224, 163, 58, 0.3)";
    ctx.strokeRect(PANEL_X + 1.6, top + 1.6, PANEL_W - 3.2, height - 3.2);

    ctx.fillStyle = AMBER;
    ctx.font = `500 3.4px ${MONO}`;
    spaced(ctx, `REEL ${reel.number}`, PANEL_X + PANEL_PAD, top + PANEL_PAD + 3.6, 0.8, "left");
    ctx.fillStyle = INK;
    ctx.font = `500 7.5px ${DISPLAY}`;
    ctx.textAlign = "left";
    ctx.fillText(reel.title, PANEL_X + PANEL_PAD, top + PANEL_PAD + 12.5);

    this.entries = [];
    let y = top + PANEL_PAD + headH;
    for (const row of rows) {
      const key = `${reel.id}/${row.item.id}`;
      const box = { x: PANEL_X + PANEL_PAD - 1.5, y: y - 1, w: PANEL_W - 2 * PANEL_PAD + 3, h: row.h + 1 };
      this.entries.push({ box, key });
      if (this.hover?.kind === "item" && this.hover.key === key) {
        ctx.fillStyle = "rgba(224, 163, 58, 0.12)";
        ctx.fillRect(box.x, box.y, box.w, box.h);
        ctx.strokeStyle = "rgba(224, 163, 58, 0.55)";
        ctx.strokeRect(box.x + 0.2, box.y + 0.2, box.w - 0.4, box.h - 0.4);
      }
      const iconY = y + (row.h - ENTRY_ICON) / 2;
      ctx.fillStyle = "rgba(30, 21, 14, 0.72)";
      ctx.fillRect(PANEL_X + PANEL_PAD, iconY, ENTRY_ICON, ENTRY_ICON);
      ctx.strokeStyle = "rgba(185, 170, 141, 0.5)";
      ctx.strokeRect(PANEL_X + PANEL_PAD + 0.2, iconY + 0.2, ENTRY_ICON - 0.4, ENTRY_ICON - 0.4);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(contentIcon(row.item.icon), PANEL_X + PANEL_PAD + 1, iconY + 1, 12, 12);

      let ty = y + (row.h - (row.name.length * 5.6 + row.sub.length * 4.6)) / 2 + 4.2;
      ctx.font = `600 4.8px ${BODY}`;
      ctx.fillStyle = ITEM_TYPES[row.item.type].color;
      for (const line of row.name) {
        ctx.fillText(line, textX, ty);
        ty += 5.6;
      }
      ctx.font = `400 3.6px ${MONO}`;
      ctx.fillStyle = INK_DIM;
      for (const line of row.sub) {
        ctx.fillText(line, textX, ty - 0.6);
        ty += 4.6;
      }
      y += row.h + 1.5;
    }
  }

  /** The reel's name as a title card: fades in, holds, fades out. */
  private drawTitle(ctx: CanvasRenderingContext2D, now: number) {
    if (!this.title) return;
    const t = now - this.title.start;
    const alpha = t < 0.3 ? t / 0.3 : t < 1.55 ? 1 : t < 2.2 ? 1 - (t - 1.55) / 0.65 : 0;
    if (alpha <= 0) return;
    const { reel } = this.title;
    const cx = WIDTH / 2;
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
    ctx.shadowBlur = 5 * SCALE;
    ctx.fillStyle = AMBER;
    ctx.font = `500 4.4px ${MONO}`;
    spaced(ctx, `REEL ${reel.number}`, cx, 98, 1.4, "center");
    ctx.fillStyle = INK;
    ctx.font = `600 17px ${DISPLAY}`;
    ctx.textAlign = "center";
    ctx.fillText(reel.title, cx, 118);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }
}
