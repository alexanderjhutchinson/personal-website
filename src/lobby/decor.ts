import { TILE } from "./config";

/** Furniture and props: drawn over the walls, not solid, not mineable. */
export interface Decor {
  kind: "sign" | "workbench" | "anvil" | "furnace" | "chest" | "cart" | "rail";
  /** Left edge, in tiles. */
  x: number;
  /** The row it stands on: its bottom edge sits on top of this row. */
  y: number;
  /** Signs point this way. */
  dir?: 1 | -1;
  /** Rails: length in tiles. */
  length?: number;
}

export function drawDecor(ctx: CanvasRenderingContext2D, d: Decor, time: number) {
  const left = d.x * TILE;
  const bottom = d.y * TILE;
  const r = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(left + x, bottom - y - h, w, h);
  };

  switch (d.kind) {
    case "sign": {
      // A signpost with an arrow, pointing toward the door.
      const dir = d.dir ?? 1;
      r(7, 0, 2, 9, "#6a3f20");
      r(7, 0, 1, 9, "#8d5a30");
      r(1, 8, 14, 7, "#4e2c14");
      r(2, 9, 12, 5, "#a0693a");
      r(2, 13, 12, 1, "#b47a46");
      const ax = dir === 1 ? 4 : 12;
      r(Math.min(ax, ax + dir * 7), 11, 8, 1, "#3a2010");
      for (let i = 0; i < 3; i++) r(ax + dir * (7 - i), 11 - i, 1, 1 + i * 2, "#3a2010");
      break;
    }
    case "workbench":
      r(0, 6, 16, 2, "#b47a46");
      r(0, 5, 16, 1, "#7a4a26");
      r(1, 0, 2, 5, "#8d5a30");
      r(13, 0, 2, 5, "#8d5a30");
      r(3, 2, 10, 1, "#7a4a26");
      // A saw and a hammer left on top.
      r(3, 8, 5, 1, "#cfd6d9");
      r(8, 8, 2, 1, "#6a3f20");
      r(11, 8, 1, 2, "#6a3f20");
      r(10, 10, 3, 1, "#9aa3a8");
      break;
    case "anvil":
      r(4, 0, 8, 2, "#3d3f44");
      r(6, 2, 4, 2, "#4c4f55");
      r(1, 4, 14, 3, "#5d6169");
      r(1, 6, 14, 1, "#7d828b");
      r(0, 5, 2, 1, "#5d6169");
      break;
    case "furnace": {
      r(0, 0, 24, 16, "#4e4b48");
      r(1, 1, 22, 14, "#6d6a66");
      r(1, 14, 22, 1, "#8a8681");
      for (let y = 3; y < 14; y += 4) r(0, y, 24, 1, "#5c5955");
      r(8, 16, 8, 3, "#4e4b48");
      // The fire, flickering.
      const f = Math.sin(time * 11) + Math.sin(time * 17 + 1);
      r(6, 2, 12, 7, "#22140c");
      r(7, 2, 10, 4 + (f > 0.5 ? 1 : 0), "#e0662a");
      r(9, 2, 6, 3, "#f2b04a");
      r(10 + (f > 0 ? 1 : 0), 2, 2, 2, "#fff1c4");
      break;
    }
    case "chest":
      r(1, 0, 14, 11, "#4e2c14");
      r(2, 1, 12, 5, "#a0693a");
      r(2, 7, 12, 3, "#b47a46");
      r(2, 6, 12, 1, "#d9a441");
      r(7, 4, 2, 4, "#d9a441");
      r(7, 5, 2, 1, "#5a3418");
      break;
    case "rail": {
      const len = (d.length ?? 1) * TILE;
      for (let x = 1; x < len; x += 4) r(x, 0, 2, 2, "#5a3418");
      r(0, 1, len, 1, "#9aa3a8");
      r(0, 2, len, 1, "#5d6169");
      break;
    }
    case "cart":
      r(2, 1, 3, 3, "#22140c");
      r(11, 1, 3, 3, "#22140c");
      r(3, 2, 1, 1, "#9aa3a8");
      r(12, 2, 1, 1, "#9aa3a8");
      r(0, 3, 16, 7, "#5d6169");
      r(1, 4, 14, 5, "#7d828b");
      r(0, 9, 16, 1, "#9aa3a8");
      // Ore piled inside.
      r(2, 10, 12, 2, "#6d6a66");
      r(4, 12, 6, 1, "#8a8681");
      r(5, 10, 2, 1, "#d9a441");
      r(10, 11, 2, 1, "#d9a441");
      break;
  }
}
