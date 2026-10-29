import { makeCanvas } from "./pixels";
import { Tile, type TileId } from "./tiles";
import { rng } from "../scene/random";

export type ItemId = "pickaxe" | "sword" | "torch" | "dirt" | "stone" | "wood";

export interface ItemDef {
  id: ItemId;
  name: string;
  /** Tooltip lines under the name. */
  lines: string[];
  use: "mine" | "swing" | "place";
  /** Tile placed by "place" items. */
  places?: TileId;
  /** Damage to the target dummy. */
  damage: number;
  stackable: boolean;
  /** Tooltip name color. */
  color: string;
}

export const ITEMS: Record<ItemId, ItemDef> = {
  pickaxe: {
    id: "pickaxe",
    name: "Pickaxe",
    lines: ["Breaks blocks", "Hold to keep swinging"],
    use: "mine",
    damage: 6,
    stackable: false,
    color: "#9fd3ff",
  },
  sword: {
    id: "sword",
    name: "Old Sword",
    lines: ["Swings in an arc", "Try it on the dummy"],
    use: "swing",
    damage: 22,
    stackable: false,
    color: "#9fd3ff",
  },
  torch: {
    id: "torch",
    name: "Torch",
    lines: ["Lights up the dark", "Place on walls or ground"],
    use: "place",
    places: Tile.Torch,
    damage: 1,
    stackable: true,
    color: "#ffffff",
  },
  dirt: { id: "dirt", name: "Dirt", lines: ["Place it anywhere"], use: "place", places: Tile.Dirt, damage: 1, stackable: true, color: "#ffffff" },
  stone: { id: "stone", name: "Stone", lines: ["Place it anywhere"], use: "place", places: Tile.Stone, damage: 1, stackable: true, color: "#ffffff" },
  wood: { id: "wood", name: "Wood", lines: ["Place it anywhere"], use: "place", places: Tile.Planks, damage: 1, stackable: true, color: "#ffffff" },
};

export type Plot = (x: number, y: number, color: string) => void;

/** Draw a 16x16 icon with a plotting callback; a dark outline is added around the shape automatically. */
export function icon(draw: (plot: Plot, line: (x0: number, y0: number, x1: number, y1: number, c: string) => void) => void) {
  const S = 16;
  const px = new Map<number, string>();
  const plot: Plot = (x, y, color) => {
    if (x >= 0 && y >= 0 && x < S && y < S) px.set(Math.round(y) * S + Math.round(x), color);
  };
  const line = (x0: number, y0: number, x1: number, y1: number, c: string) => {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= steps; i++) plot(x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps, c);
  };
  draw(plot, line);

  const { c, ctx } = makeCanvas(S, S);
  ctx.fillStyle = "#22140c";
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      if (px.has(y * S + x)) continue;
      const near = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].some(([dx, dy]) => px.has((y + dy) * S + (x + dx)) && x + dx >= 0 && x + dx < S);
      if (near) ctx.fillRect(x, y, 1, 1);
    }
  }
  for (const [i, color] of px) {
    ctx.fillStyle = color;
    ctx.fillRect(i % S, Math.floor(i / S), 1, 1);
  }
  return c;
}

function blockIcon(base: string, light: string, dark: string, speck: string, seed: number) {
  return icon((plot) => {
    const r = rng(seed);
    for (let y = 3; y < 13; y++) {
      for (let x = 3; x < 13; x++) {
        let c = base;
        if (y === 3 || x === 3) c = light;
        else if (y === 12 || x === 12) c = dark;
        else if (r() < 0.18) c = speck;
        plot(x, y, c);
      }
    }
  });
}

const ICONS: Record<ItemId, () => HTMLCanvasElement> = {
  pickaxe: () =>
    icon((plot, line) => {
      line(2, 13, 9, 6, "#b47a46");
      line(3, 13, 10, 6, "#8d5a30");
      plot(2, 14, "#8d5a30");
      // Curved head: an arc around (4, 12).
      for (let a = -82; a <= -8; a += 2) {
        const t = (a * Math.PI) / 180;
        plot(4 + Math.cos(t) * 10, 12 + Math.sin(t) * 10, "#cfd6d9");
        plot(4 + Math.cos(t) * 9, 12 + Math.sin(t) * 9, "#9aa3a8");
        if (a > -62 && a < -28) plot(4 + Math.cos(t) * 8, 12 + Math.sin(t) * 8, "#6c7479");
      }
    }),
  sword: () =>
    icon((plot, line) => {
      line(5, 10, 14, 1, "#e3e8ea");
      line(6, 10, 14, 2, "#9aa3a8");
      line(3, 8, 7, 12, "#d9a441");
      line(4, 11, 2, 13, "#5a3418");
      plot(1, 14, "#d9a441");
    }),
  torch: () =>
    icon((plot, line) => {
      line(7, 8, 7, 14, "#b47a46");
      line(8, 8, 8, 14, "#8d5a30");
      for (const [x, y, c] of [
        [6, 5, "#e0662a"],
        [9, 5, "#e0662a"],
        [6, 6, "#e0662a"],
        [9, 6, "#e0662a"],
        [7, 7, "#e0662a"],
        [8, 7, "#e0662a"],
        [7, 4, "#f2b04a"],
        [8, 4, "#f2b04a"],
        [7, 5, "#fff1c4"],
        [8, 5, "#f2b04a"],
        [7, 6, "#f2b04a"],
        [8, 6, "#f2b04a"],
        [7, 3, "#e0662a"],
      ] as const)
        plot(x, y, c);
    }),
  dirt: () => blockIcon("#7a4a2b", "#9a6a44", "#5a3520", "#6a3f24", 3),
  stone: () => blockIcon("#6d6a66", "#8a8681", "#4e4b48", "#5c5955", 5),
  wood: () =>
    icon((plot) => {
      for (let y = 3; y < 13; y++) {
        for (let x = 3; x < 13; x++) {
          const seam = y === 6 || y === 9 || y === 12;
          plot(x, y, seam ? "#7a4a26" : y === 3 || y === 7 || y === 10 ? "#b47a46" : "#a0693a");
        }
      }
    }),
};

const iconCache = new Map<ItemId, HTMLCanvasElement>();
export function itemIcon(id: ItemId) {
  let c = iconCache.get(id);
  if (!c) {
    c = ICONS[id]();
    iconCache.set(id, c);
  }
  return c;
}
