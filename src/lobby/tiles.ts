import { TILE } from "./config";
import type { ItemId } from "./items";
import { hash2, makeCanvas } from "./pixels";
import { rng } from "../scene/random";

export const Tile = { Air: 0, Dirt: 1, Grass: 2, Stone: 3, Planks: 4, Platform: 5, Bedrock: 6, Torch: 7 } as const;
export type TileId = (typeof Tile)[keyof typeof Tile];

export const Wall = { None: 0, Dirt: 1, Planks: 2 } as const;
export type WallId = (typeof Wall)[keyof typeof Wall];

export type Material = "dirt" | "stone" | "wood";

interface TileInfo {
  name: string;
  solid: boolean;
  /** One-way: stand on it from above, jump up through it, drop through with S. */
  platform?: boolean;
  hp: number;
  breakable: boolean;
  drop: ItemId | null;
  material: Material;
  /** Color of the pixels that fly off when it's hit. */
  chip: string;
  /** Outline on sides that face open air. */
  edge: string;
}

export const TILES: Record<TileId, TileInfo> = {
  [Tile.Air]: { name: "Air", solid: false, hp: 0, breakable: false, drop: null, material: "dirt", chip: "", edge: "" },
  [Tile.Dirt]: { name: "Dirt", solid: true, hp: 50, breakable: true, drop: "dirt", material: "dirt", chip: "#7a4a2b", edge: "#3f2414" },
  [Tile.Grass]: { name: "Grass", solid: true, hp: 50, breakable: true, drop: "dirt", material: "dirt", chip: "#5f9a3a", edge: "#3f2414" },
  [Tile.Stone]: { name: "Stone", solid: true, hp: 110, breakable: true, drop: "stone", material: "stone", chip: "#7a7672", edge: "#36332f" },
  [Tile.Planks]: { name: "Planks", solid: true, hp: 70, breakable: true, drop: "wood", material: "wood", chip: "#a0693a", edge: "#4e2c14" },
  [Tile.Platform]: {
    name: "Platform",
    solid: false,
    platform: true,
    hp: 30,
    breakable: true,
    drop: "wood",
    material: "wood",
    chip: "#a0693a",
    edge: "",
  },
  [Tile.Bedrock]: { name: "Bedrock", solid: true, hp: 0, breakable: false, drop: null, material: "stone", chip: "#2b2422", edge: "#120e0c" },
  [Tile.Torch]: { name: "Torch", solid: false, hp: 1, breakable: true, drop: "torch", material: "wood", chip: "#f2b04a", edge: "" },
};

const VARIANTS = 4;

/** Paint 8x8 base textures for every block and wall, a few variants each. */
function buildAtlas() {
  const blocks = new Map<TileId, HTMLCanvasElement[]>();
  const walls = new Map<WallId, HTMLCanvasElement[]>();

  const speckled = (base: string, specks: string[], seed: number, count: number) =>
    Array.from({ length: VARIANTS }, (_, v) => {
      const { c, ctx } = makeCanvas(TILE, TILE);
      const r = rng(seed * 31 + v);
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, TILE, TILE);
      for (let i = 0; i < count; i++) {
        ctx.fillStyle = specks[Math.floor(r() * specks.length)];
        ctx.fillRect(Math.floor(r() * TILE), Math.floor(r() * TILE), 1, 1);
      }
      return c;
    });

  const dirt = speckled("#7a4a2b", ["#6a3f24", "#8b5733", "#6a3f24", "#9a6a44"], 1, 14);
  blocks.set(Tile.Dirt, dirt);
  blocks.set(Tile.Grass, dirt);

  blocks.set(
    Tile.Stone,
    Array.from({ length: VARIANTS }, (_, v) => {
      const { c, ctx } = makeCanvas(TILE, TILE);
      const r = rng(77 + v);
      ctx.fillStyle = "#6d6a66";
      ctx.fillRect(0, 0, TILE, TILE);
      for (let i = 0; i < 12; i++) {
        ctx.fillStyle = r() < 0.5 ? "#5c5955" : "#7f7b76";
        ctx.fillRect(Math.floor(r() * TILE), Math.floor(r() * TILE), 1 + Math.floor(r() * 2), 1);
      }
      ctx.fillStyle = "#55524e";
      const cx = Math.floor(r() * 6) + 1;
      ctx.fillRect(cx, 2 + Math.floor(r() * 3), 2, 1);
      return c;
    }),
  );

  blocks.set(
    Tile.Planks,
    Array.from({ length: VARIANTS }, (_, v) => {
      const { c, ctx } = makeCanvas(TILE, TILE);
      const r = rng(91 + v);
      ctx.fillStyle = "#a0693a";
      ctx.fillRect(0, 0, TILE, TILE);
      ctx.fillStyle = "#b47a46";
      ctx.fillRect(0, 0, TILE, 1);
      ctx.fillRect(0, 4, TILE, 1);
      ctx.fillStyle = "#7a4a26";
      ctx.fillRect(0, 3, TILE, 1);
      ctx.fillRect(0, 7, TILE, 1);
      ctx.fillRect(Math.floor(r() * 6) + 1, 0, 1, 3);
      ctx.fillRect(Math.floor(r() * 6) + 1, 4, 1, 3);
      ctx.fillStyle = "#8d5a30";
      for (let i = 0; i < 4; i++) ctx.fillRect(Math.floor(r() * TILE), Math.floor(r() * TILE), 2, 1);
      return c;
    }),
  );

  blocks.set(Tile.Bedrock, speckled("#2b2422", ["#3a312d", "#1f1917"], 5, 18));

  walls.set(Wall.Dirt, speckled("#43281a", ["#3a2216", "#4d2f1f"], 9, 10));
  walls.set(
    Wall.Planks,
    Array.from({ length: VARIANTS }, (_, v) => {
      const { c, ctx } = makeCanvas(TILE, TILE);
      const r = rng(13 + v);
      ctx.fillStyle = "#5a3820";
      ctx.fillRect(0, 0, TILE, TILE);
      ctx.fillStyle = "#4a2d19";
      ctx.fillRect(0, 7, TILE, 1);
      ctx.fillRect(Math.floor(r() * 7), 0, 1, 7);
      ctx.fillStyle = "#63402a";
      ctx.fillRect(0, 0, TILE, 1);
      return c;
    }),
  );

  return { blocks, walls };
}

let atlas: ReturnType<typeof buildAtlas> | null = null;
function getAtlas() {
  atlas ??= buildAtlas();
  return atlas;
}

export interface TileGrid {
  fg(x: number, y: number): TileId;
  bg(x: number, y: number): WallId;
}

const solidAt = (grid: TileGrid, x: number, y: number) => TILES[grid.fg(x, y)].solid;

export function drawWall(ctx: CanvasRenderingContext2D, wall: WallId, x: number, y: number) {
  if (wall === Wall.None) return;
  const variants = getAtlas().walls.get(wall);
  if (!variants) return;
  ctx.drawImage(variants[Math.floor(hash2(x, y) * VARIANTS)], x * TILE, y * TILE);
}

/** Draw one foreground tile, with outlines and rounded corners where it meets open air. */
export function drawTile(ctx: CanvasRenderingContext2D, grid: TileGrid, x: number, y: number, time: number) {
  const id = grid.fg(x, y);
  const px = x * TILE;
  const py = y * TILE;
  if (id === Tile.Air) return;

  if (id === Tile.Platform) {
    ctx.fillStyle = "#a0693a";
    ctx.fillRect(px, py, TILE, 3);
    ctx.fillStyle = "#b47a46";
    ctx.fillRect(px, py, TILE, 1);
    ctx.fillStyle = "#6a3f20";
    ctx.fillRect(px, py + 3, TILE, 1);
    ctx.fillRect(px + 1, py + 4, 1, 2);
    ctx.fillRect(px + 6, py + 4, 1, 2);
    return;
  }

  if (id === Tile.Torch) {
    drawTorch(ctx, px, py, time, x * 7 + y * 3);
    return;
  }

  const variants = getAtlas().blocks.get(id);
  if (variants) ctx.drawImage(variants[Math.floor(hash2(x, y) * VARIANTS)], px, py);

  const info = TILES[id];
  const up = !solidAt(grid, x, y - 1);
  const down = !solidAt(grid, x, y + 1);
  const left = !solidAt(grid, x - 1, y);
  const right = !solidAt(grid, x + 1, y);

  ctx.fillStyle = info.edge;
  if (up) ctx.fillRect(px, py, TILE, 1);
  if (down) ctx.fillRect(px, py + TILE - 1, TILE, 1);
  if (left) ctx.fillRect(px, py, 1, TILE);
  if (right) ctx.fillRect(px + TILE - 1, py, 1, TILE);

  if (id === Tile.Grass && up) {
    // Grass on top, with a few blades poking into the air above.
    ctx.fillStyle = "#4c7f2c";
    ctx.fillRect(px, py, TILE, 3);
    ctx.fillStyle = "#5f9a3a";
    ctx.fillRect(px, py, TILE, 2);
    ctx.fillStyle = "#7cb84a";
    ctx.fillRect(px + 1, py, 2, 1);
    ctx.fillRect(px + 5, py, 1, 1);
    ctx.fillStyle = "#5f9a3a";
    const h = hash2(x, y);
    ctx.fillRect(px + 1 + Math.floor(h * 5), py - 1, 1, 1);
    if (h > 0.4) ctx.fillRect(px + 6 - Math.floor(h * 3), py - 2, 1, 2);
    ctx.fillStyle = "#4c7f2c";
    ctx.fillRect(px + Math.floor(h * 7), py + 3, 1, 1);
    if (left) ctx.fillRect(px, py, 1, 4);
    if (right) ctx.fillRect(px + TILE - 1, py, 1, 4);
  }

  // Round off exposed corners.
  ctx.globalCompositeOperation = "destination-out";
  if (up && left) ctx.fillRect(px, py, 1, 1);
  if (up && right) ctx.fillRect(px + TILE - 1, py, 1, 1);
  if (down && left) ctx.fillRect(px, py + TILE - 1, 1, 1);
  if (down && right) ctx.fillRect(px + TILE - 1, py + TILE - 1, 1, 1);
  ctx.globalCompositeOperation = "source-over";
}

export function drawTorch(ctx: CanvasRenderingContext2D, px: number, py: number, time: number, seed: number) {
  ctx.fillStyle = "#6a3f20";
  ctx.fillRect(px + 3, py + 3, 2, 5);
  ctx.fillStyle = "#8d5a30";
  ctx.fillRect(px + 3, py + 3, 1, 5);
  const f = Math.sin(time * 14 + seed) + Math.sin(time * 23 + seed * 2);
  ctx.fillStyle = "#e0662a";
  ctx.fillRect(px + 2, py + 1, 4, 3);
  ctx.fillStyle = "#f2b04a";
  ctx.fillRect(px + 3, py + (f > 0.6 ? 0 : 1), 2, 3);
  ctx.fillStyle = "#fff1c4";
  ctx.fillRect(px + 3 + (f > 0 ? 1 : 0), py + 2, 1, 1);
}

// Crack patterns for the three damage stages.
const CRACKS = [
  ["........", "........", "...#....", "....#...", "...#....", "........", "........", "........"],
  ["........", ".#......", "..#..#..", "...##...", "...#.#..", "..#.....", "........", "........"],
  ["#.....#.", ".#...#..", "..#.##..", "...##...", "..#..#..", ".#...##.", "#.....#.", "........"],
];

export function drawCracks(ctx: CanvasRenderingContext2D, x: number, y: number, ratio: number) {
  if (ratio <= 0) return;
  const stage = Math.min(2, Math.floor(ratio * 3));
  ctx.fillStyle = "rgba(20, 12, 8, 0.85)";
  CRACKS[stage].forEach((row, cy) => {
    [...row].forEach((ch, cx) => {
      if (ch === "#") ctx.fillRect(x * TILE + cx, y * TILE + cy, 1, 1);
    });
  });
}
