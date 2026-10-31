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

// The reel's item panel: as wide as it can be beside the hotbar, so the content is hard to miss.
const PANEL_W = 166;
const PANEL_X = WIDTH - 4 - PANEL_W;
const PANEL_PAD = 6.5;
const ENTRY_ICON = 18;
const NAME_LINE = 7.2;
const SUB_LINE = 5.6;
/** Seconds the panel glows after a new reel starts, to point out that the content changed. */
const GLOW_TIME = 3.5;
/** The note under a panel nobody has looked at yet waits for the title card to clear first. */
const PROMPT_DELAY = 2.2;

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
  private touch = matchMedia("(hover: none)").matches;

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

  /**
   * Draw onto a picture SCALE times the game's size. `fresh` means none of this reel's items have been
   * opened yet: the panel then pulses and points itself out, like the program on the table.
   */
  draw(ctx: CanvasRenderingContext2D, reel: Reel, now: number, fresh: boolean) {
    ctx.save();
    ctx.scale(SCALE, SCALE);
    ctx.textBaseline = "alphabetic";
    this.drawPanel(ctx, reel, now, fresh);
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
  private drawPanel(ctx: CanvasRenderingContext2D, reel: Reel, now: number, fresh: boolean) {
    const items = reelItems[reel.id];
    const textX = PANEL_X + PANEL_PAD + ENTRY_ICON + 5;
    const textW = PANEL_X + PANEL_W - PANEL_PAD - textX;

    // Lay out first, to know the height.
    const rows = items.map((item) => {
      ctx.font = `600 6.2px ${BODY}`;
      const name = wrap(ctx, item.name, textW);
      ctx.font = `400 4.5px ${MONO}`;
      const sub = wrap(ctx, item.sub, textW);
      const h = Math.max(ENTRY_ICON + 3, name.length * NAME_LINE + sub.length * SUB_LINE + 4);
      return { item, name, sub, h };
    });
    const top = 4;
    const headH = 24;
    const height = PANEL_PAD + headH + rows.reduce((n, r) => n + r.h + 2, 0) + PANEL_PAD - 2;
    this.panel = { x: PANEL_X, y: top, w: PANEL_W, h: height };

    // For a few seconds after a reel starts the panel glows amber; until one of its items has been
    // opened, it keeps pulsing.
    const since = this.title?.reel.id === reel.id ? now - this.title.start : Infinity;
    const start = since < GLOW_TIME ? (1 - since / GLOW_TIME) * (0.6 + 0.4 * Math.sin(since * 7)) : 0;
    const glow = Math.max(start, fresh ? 0.55 + 0.25 * Math.sin(now * 3) : 0);
    ctx.shadowColor = `rgba(224, 163, 58, ${0.7 * glow})`;
    ctx.shadowBlur = 10 * SCALE * glow;
    ctx.fillStyle = PANEL_BG;
    ctx.fillRect(PANEL_X, top, PANEL_W, height);
    ctx.shadowBlur = 0;
    ctx.lineWidth = 0.4 + 0.5 * glow;
    ctx.strokeStyle = glow ? `rgba(224, 163, 58, ${0.5 + 0.5 * glow})` : "rgba(236, 225, 201, 0.45)";
    ctx.strokeRect(PANEL_X + 0.2, top + 0.2, PANEL_W - 0.4, height - 0.4);
    ctx.lineWidth = 0.35;
    ctx.strokeStyle = "rgba(224, 163, 58, 0.3)";
    ctx.strokeRect(PANEL_X + 1.8, top + 1.8, PANEL_W - 3.6, height - 3.6);

    if (fresh) this.drawPrompt(ctx, top + height, since);

    ctx.fillStyle = AMBER;
    ctx.font = `500 4.3px ${MONO}`;
    spaced(ctx, `REEL ${reel.number}`, PANEL_X + PANEL_PAD, top + PANEL_PAD + 4.5, 1.1, "left");
    ctx.fillStyle = INK;
    ctx.font = `500 10px ${DISPLAY}`;
    ctx.textAlign = "left";
    ctx.fillText(reel.title, PANEL_X + PANEL_PAD, top + PANEL_PAD + 16);

    this.entries = [];
    let y = top + PANEL_PAD + headH;
    for (const row of rows) {
      const key = `${reel.id}/${row.item.id}`;
      const box = { x: PANEL_X + PANEL_PAD - 2, y: y - 1, w: PANEL_W - 2 * PANEL_PAD + 4, h: row.h + 1 };
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
      ctx.drawImage(contentIcon(row.item.icon), PANEL_X + PANEL_PAD + 1, iconY + 1, 16, 16);

      let ty = y + (row.h - (row.name.length * NAME_LINE + row.sub.length * SUB_LINE)) / 2 + 5.4;
      ctx.font = `600 6.2px ${BODY}`;
      ctx.fillStyle = ITEM_TYPES[row.item.type].color;
      for (const line of row.name) {
        ctx.fillText(line, textX, ty);
        ty += NAME_LINE;
      }
      ctx.font = `400 4.5px ${MONO}`;
      ctx.fillStyle = INK_DIM;
      for (const line of row.sub) {
        ctx.fillText(line, textX, ty - 0.6);
        ty += SUB_LINE;
      }
      y += row.h + 2;
    }
  }

  /** A note under the panel, like the program's pick-up prompt: there's more to read here. */
  private drawPrompt(ctx: CanvasRenderingContext2D, y: number, since: number) {
    const alpha = since === Infinity ? 1 : Math.min(1, Math.max(0, (since - PROMPT_DELAY) / 0.4));
    if (alpha <= 0) return;
    const text = this.touch ? "Tap an item to read more" : "Click an item to read more";
    ctx.font = `500 4.4px ${MONO}`;
    const w = ctx.measureText(text).width + 9;
    const x = PANEL_X + PANEL_W - w;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "rgba(15, 11, 8, 0.86)";
    ctx.fillRect(x, y + 3, w, 9);
    ctx.lineWidth = 0.4;
    ctx.strokeStyle = AMBER;
    ctx.strokeRect(x + 0.2, y + 3.2, w - 0.4, 8.6);
    ctx.fillStyle = INK;
    ctx.textAlign = "left";
    ctx.fillText(text, x + 4.5, y + 9.1);
    ctx.globalAlpha = 1;
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
