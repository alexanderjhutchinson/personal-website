import { COLS, HEIGHT, ROWS, TILE, WIDTH } from "./config";
import type { Decor } from "./decor";
import { makeCanvas } from "./pixels";
import { Tile, Wall, type TileId } from "./tiles";
import type { Scene, Tree, World } from "./world";
import type { ReelId } from "../data";
import { rng } from "../scene/random";

/** A scene plus how it's painted: the backdrop behind the tiles, drifting clouds, and props. */
export interface ReelScene extends Scene {
  /** Describes the scene for screen readers. */
  alt: string;
  paintBackdrop(): HTMLCanvasElement;
  /** Cloud color and shadow, or none. */
  clouds?: [string, string];
  decor: Decor[];
}

// Painting helpers for backdrops.

function hills(ctx: CanvasRenderingContext2D, base: number, amp: number, freq: number, phase: number, color: string) {
  ctx.fillStyle = color;
  for (let x = 0; x < WIDTH; x++) {
    const h = base - Math.round(Math.sin(x * freq + phase) * amp + Math.sin(x * freq * 2.7 + phase * 2) * amp * 0.35);
    ctx.fillRect(x, h, 1, HEIGHT - h);
  }
}

function stars(ctx: CanvasRenderingContext2D, count: number, maxY: number, seed: number) {
  const r = rng(seed);
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = `rgba(255, 240, 220, ${0.3 + r() * 0.6})`;
    ctx.fillRect(Math.floor(r() * WIDTH), Math.floor(r() * maxY), 1, 1);
  }
}

function disc(ctx: CanvasRenderingContext2D, cx: number, cy: number, rad: number, color: string) {
  ctx.fillStyle = color;
  for (let y = -rad; y <= rad; y++) {
    const half = Math.round(Math.sqrt(rad * rad - y * y));
    ctx.fillRect(cx - half, cy + y, half * 2 + 1, 1);
  }
}

/** Background trees: [trunk, trunk light, leaves dark → light, speck]. */
function paintTrees(ctx: CanvasRenderingContext2D, trees: Tree[], colors: string[], seed: number) {
  const [trunk, trunkLight, l0, l1, l2, speck] = colors;
  const r = rng(seed);
  for (const tree of trees) {
    const baseX = tree.x * TILE + 4;
    const baseY = tree.ground * TILE;
    const top = baseY - tree.height * TILE;
    ctx.fillStyle = trunk;
    ctx.fillRect(baseX - 2, top + 6, 5, baseY - top - 6);
    ctx.fillStyle = trunkLight;
    ctx.fillRect(baseX - 2, top + 6, 2, baseY - top - 6);
    ctx.fillRect(baseX - 4, baseY - 2, 9, 2);
    disc(ctx, baseX, top + 4, 11, l0);
    disc(ctx, baseX - 6, top + 8, 7, l0);
    disc(ctx, baseX + 7, top + 7, 7, l0);
    disc(ctx, baseX - 1, top + 2, 8, l1);
    disc(ctx, baseX + 3, top - 1, 5, l2);
    ctx.fillStyle = speck;
    for (let i = 0; i < 10; i++) ctx.fillRect(baseX - 6 + Math.floor(r() * 14), top - 4 + Math.floor(r() * 10), 1, 1);
  }
}

// Building helpers.

/** Grass on top, a few rows of dirt, stone below, bedrock at the bottom, and dirt walls behind. */
function ground(world: World, surface: (x: number) => number, r: () => number) {
  for (let x = 0; x < COLS; x++) {
    const top = surface(x);
    const dirtDepth = 4 + Math.floor(r() * 2);
    for (let y = top; y < ROWS; y++) {
      let id: TileId = Tile.Stone;
      if (y === ROWS - 1) id = Tile.Bedrock;
      else if (y === top) id = Tile.Grass;
      else if (y < top + dirtDepth) id = Tile.Dirt;
      else if (r() < 0.12) id = Tile.Dirt;
      world.set(x, y, id);
      if (y > top) world.setWall(x, y, Wall.Dirt);
    }
  }
}

/** A plank house: floor, walls with a doorway on each side, a stepped roof. */
function house(world: World, x0: number, x1: number, floor: number, wallTop: number) {
  for (let x = x0; x <= x1; x++) world.set(x, floor, Tile.Planks);
  for (let y = wallTop; y < floor; y++) {
    for (let x = x0 + 1; x < x1; x++) world.setWall(x, y, Wall.Planks);
    if (y < floor - 3) {
      world.set(x0, y, Tile.Planks);
      world.set(x1, y, Tile.Planks);
    }
  }
  const roof = wallTop - 1;
  for (let x = x0 - 1; x <= x1 + 1; x++) world.set(x, roof, Tile.Planks);
  for (let x = x0 + 1; x <= x1 - 1; x++) world.set(x, roof - 1, Tile.Planks);
  for (let x = x0 + 3; x <= x1 - 3; x++) world.set(x, roof - 2, Tile.Planks);
}

// Reel 1: the home base at sunset.

/** Ground height for each column, in tile rows. The house sits on the flat part at the left. */
const HOME_SURFACE = [
  17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 16, 16, 16, 16, 15, 15, 15, 15, 16,
  16, 17, 17, 17, 17, 18, 18, 18, 17, 17, 17, 16, 16, 15, 15, 14, 14, 14, 14,
];

const homeTrees: Tree[] = [
  { x: 21, ground: 16, height: 6 },
  { x: 45, ground: 14, height: 5 },
];

const home: ReelScene = {
  alt: "A pixel-art scene at sunset: a small wooden house, a target dummy, trees, and a cave underground. Your character can walk, mine blocks, and swing a sword.",
  exits: { right: 14 },
  spawn: { x: 9 * TILE, y: 17 * TILE },
  dummyAt: { x: 27 * TILE + 4, y: 15 * TILE },
  trees: homeTrees,
  skyLight: 1,
  ambient: 0.06,
  glows: [],
  clouds: ["#e9a07c", "#c97a6a"],
  decor: [
    { kind: "chest", x: 12, y: 17 },
    { kind: "sign", x: 44, y: 14, dir: 1 },
  ],
  build(world, r) {
    ground(world, (x) => HOME_SURFACE[x], r);
    // A small cave lit by a torch.
    for (let x = 30; x <= 41; x++) {
      for (let y = 21; y <= 24; y++) {
        const dx = (x - 35.5) / 6;
        const dy = (y - 22.8) / 2.3;
        if (dx * dx + dy * dy < 1) world.set(x, y, Tile.Air);
      }
    }
    world.set(33, 24, Tile.Torch);
    house(world, 3, 15, 17, 11);
    for (let x = 4; x <= 7; x++) world.set(x, 13, Tile.Platform);
    world.set(9, 12, Tile.Torch);
  },
  paintBackdrop() {
    const { c, ctx } = makeCanvas(WIDTH, HEIGHT);
    const sky = ctx.createLinearGradient(0, 0, 0, 130);
    sky.addColorStop(0, "#1d1f45");
    sky.addColorStop(0.5, "#6b3f63");
    sky.addColorStop(0.85, "#d0704a");
    sky.addColorStop(1, "#e89a55");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    stars(ctx, 40, 50, 7);
    // A striped setting sun, like the poster in the living room.
    const [sx, sy, sr] = [298, 112, 26];
    for (let y = -sr; y <= sr; y++) {
      const half = Math.floor(Math.sqrt(sr * sr - y * y));
      const band = y > 4 && (y - 4) % 6 < Math.min(4, Math.floor((y - 4) / 5) + 1);
      if (band) continue;
      ctx.fillStyle = y < -8 ? "#f6d07a" : y < 6 ? "#f2b04a" : "#e0662a";
      ctx.fillRect(sx - half, sy + y, half * 2, 1);
    }
    hills(ctx, 118, 9, 0.018, 1.2, "#5a3554");
    hills(ctx, 130, 7, 0.026, 3.1, "#3b2440");
    paintTrees(ctx, homeTrees, ["#5a3418", "#6a3f20", "#2f5424", "#3e6b2c", "#4c7f2c", "#5f9a3a"], 7);
    return c;
  },
};

// Reel 2: the mine. All underground, lit by torches on the supports.

const MINE_FLOOR = 20;
const SUPPORTS = [9, 20, 31, 41];

const mine: ReelScene = {
  alt: "A pixel-art mine tunnel lit by torches on timber supports, with a rail track and a mine cart full of ore.",
  exits: { left: MINE_FLOOR, right: MINE_FLOOR },
  spawn: { x: 6 * TILE, y: MINE_FLOOR * TILE },
  trees: [],
  skyLight: 0,
  ambient: 0.2,
  glows: [],
  decor: [
    { kind: "rail", x: 5, y: MINE_FLOOR, length: 38 },
    { kind: "cart", x: 25, y: MINE_FLOOR },
    { kind: "sign", x: 2, y: MINE_FLOOR, dir: -1 },
    { kind: "sign", x: 44, y: MINE_FLOOR, dir: 1 },
  ],
  build(world, r) {
    for (let x = 0; x < COLS; x++) {
      for (let y = 0; y < ROWS; y++) {
        world.set(x, y, y === ROWS - 1 ? Tile.Bedrock : r() < 0.1 ? Tile.Dirt : Tile.Stone);
      }
    }
    // Dirt pockets in the rock.
    for (let i = 0; i < 7; i++) {
      const cx = r() * COLS;
      const cy = r() * ROWS;
      const rad = 1.5 + r() * 2.5;
      for (let y = Math.floor(cy - rad); y <= cy + rad; y++) {
        for (let x = Math.floor(cx - rad); x <= cx + rad; x++) {
          if (y < ROWS - 1 && Math.hypot(x - cx, y - cy) < rad) world.set(x, y, Tile.Dirt);
        }
      }
    }
    // The tunnel: a wavy ceiling over a flat floor, with rock hanging down here and there.
    for (let x = 0; x < COLS; x++) {
      const ceiling = Math.round(6 + Math.sin(x * 0.31) * 1.6 + Math.sin(x * 0.12 + 2) * 2.2);
      for (let y = ceiling; y < MINE_FLOOR; y++) {
        world.set(x, y, Tile.Air);
        world.setWall(x, y, Wall.Stone);
      }
      if (r() < 0.25) world.set(x, ceiling, Tile.Stone);
    }
    // Timber supports: posts behind, a beam to stand on, and a torch on each.
    for (const sx of SUPPORTS) {
      for (let y = 9; y < MINE_FLOOR; y++) {
        world.setWall(sx, y, Wall.Planks);
        world.setWall(sx + 4, y, Wall.Planks);
      }
      for (let x = sx; x <= sx + 4; x++) world.set(x, 14, Tile.Platform);
      for (let x = sx; x <= sx + 4; x++) if (world.fg(x, 9) === Tile.Air) world.setWall(x, 9, Wall.Planks);
      world.set(sx + 2, 13, Tile.Torch);
    }
  },
  paintBackdrop() {
    const { c, ctx } = makeCanvas(WIDTH, HEIGHT);
    ctx.fillStyle = "#120d0b";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    return c;
  },
};

// Reel 3: the workshop at night.

const WORKSHOP_FLOOR = 18;
const workshopTrees: Tree[] = [
  { x: 5, ground: WORKSHOP_FLOOR, height: 5 },
  { x: 44, ground: WORKSHOP_FLOOR, height: 6 },
];

const workshop: ReelScene = {
  alt: "A pixel-art workshop at night under a full moon, with a workbench, an anvil, a furnace, and a chest.",
  exits: { left: WORKSHOP_FLOOR },
  spawn: { x: 24 * TILE, y: WORKSHOP_FLOOR * TILE },
  dummyAt: { x: 41 * TILE + 4, y: WORKSHOP_FLOOR * TILE },
  trees: workshopTrees,
  skyLight: 0.55,
  ambient: 0.06,
  glows: [[28, 17]],
  clouds: ["#2c3160", "#20244a"],
  decor: [
    { kind: "sign", x: 2, y: WORKSHOP_FLOOR, dir: -1 },
    { kind: "workbench", x: 15, y: WORKSHOP_FLOOR },
    { kind: "anvil", x: 21, y: WORKSHOP_FLOOR },
    { kind: "furnace", x: 27, y: WORKSHOP_FLOOR },
    { kind: "chest", x: 33, y: WORKSHOP_FLOOR },
  ],
  build(world, r) {
    ground(world, (x) => (x > 45 ? WORKSHOP_FLOOR - 1 : WORKSHOP_FLOOR), r);
    house(world, 11, 37, WORKSHOP_FLOOR, 10);
    for (let x = 12; x <= 18; x++) world.set(x, 14, Tile.Platform);
    world.set(19, 12, Tile.Torch);
    world.set(31, 12, Tile.Torch);
  },
  paintBackdrop() {
    const { c, ctx } = makeCanvas(WIDTH, HEIGHT);
    const sky = ctx.createLinearGradient(0, 0, 0, 150);
    sky.addColorStop(0, "#080a1f");
    sky.addColorStop(0.6, "#1a1f48");
    sky.addColorStop(1, "#3a3360");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    stars(ctx, 90, 110, 11);
    // A full moon, like the one outside the living room window.
    disc(ctx, 206, 30, 14, "#f1ead2");
    disc(ctx, 201, 26, 3, "#d8cfb2");
    disc(ctx, 211, 36, 2, "#d8cfb2");
    disc(ctx, 209, 23, 1, "#d8cfb2");
    hills(ctx, 124, 8, 0.02, 0.4, "#1c1e3c");
    hills(ctx, 136, 6, 0.03, 2.2, "#141530");
    paintTrees(ctx, workshopTrees, ["#2a1d1a", "#33241f", "#16261f", "#1d3227", "#243d2e", "#2d4a36"], 11);
    return c;
  },
};

export const SCENES: Record<ReelId, ReelScene> = { about: home, experience: mine, projects: workshop };
