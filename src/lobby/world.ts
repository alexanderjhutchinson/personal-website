import { COLS, ROWS, TILE } from "./config";
import { makeCanvas } from "./pixels";
import { Tile, TILES, Wall, type TileGrid, type TileId, type WallId } from "./tiles";
import { rng } from "../scene/random";

export interface Tree {
  x: number;
  ground: number;
  height: number;
}

/** One reel's scene: its layout, doors, and light. Scenes live in scenes.ts. */
export interface Scene {
  /** Floor row of the doorway on each side. A side without one is a wall. */
  exits: { left?: number; right?: number };
  /** Where the character starts when the page opens on this reel (feet, in pixels). */
  spawn: { x: number; y: number };
  /** Where the target dummy stands, if there is one (bottom center, in pixels). */
  dummyAt?: { x: number; y: number };
  trees: Tree[];
  /** Brightness of open sky, 0 to 1. */
  skyLight: number;
  /** The darkest anything gets, 0 to 1. */
  ambient: number;
  /** Tiles that light up their surroundings like a torch (a furnace, a lantern). */
  glows: [number, number][];
  build(world: World, r: () => number): void;
}

/** How tall a doorway at the edge of the frame is, in tiles. */
export const DOOR_HEIGHT = 3;

/**
 * One screen of tiles with a foreground layer (blocks you collide with and can
 * mine) and a background wall layer.
 */
export class World implements TileGrid {
  readonly fgGrid = new Uint8Array(COLS * ROWS);
  readonly bgGrid = new Uint8Array(COLS * ROWS);
  readonly light = new Float32Array(COLS * ROWS);
  readonly lightCanvas: HTMLCanvasElement;
  readonly scene: Scene;

  private damage = new Float32Array(COLS * ROWS);
  private damageTime = new Float32Array(COLS * ROWS);
  private lightCtx: CanvasRenderingContext2D;
  private lightImage: ImageData;
  private lightDirty = true;

  constructor(scene: Scene) {
    this.scene = scene;
    const { c, ctx } = makeCanvas(COLS, ROWS);
    this.lightCanvas = c;
    this.lightCtx = ctx;
    this.lightImage = ctx.createImageData(COLS, ROWS);
    this.generate();
  }

  fg(x: number, y: number): TileId {
    // The frame's edges are walls, except for a doorway where the scene has an exit.
    if (x < 0 || x >= COLS) {
      const floor = x < 0 ? this.scene.exits.left : this.scene.exits.right;
      return floor !== undefined && y < floor && y >= floor - DOOR_HEIGHT ? Tile.Air : Tile.Bedrock;
    }
    if (y >= ROWS) return Tile.Bedrock;
    if (y < 0) return Tile.Air;
    return this.fgGrid[y * COLS + x] as TileId;
  }

  bg(x: number, y: number): WallId {
    if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return Wall.None;
    return this.bgGrid[y * COLS + x] as WallId;
  }

  set(x: number, y: number, id: TileId) {
    if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return;
    this.fgGrid[y * COLS + x] = id;
    this.damage[y * COLS + x] = 0;
    this.lightDirty = true;
  }

  setWall(x: number, y: number, id: WallId) {
    if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return;
    this.bgGrid[y * COLS + x] = id;
  }

  /** Is the pixel inside a solid block? */
  solidAtPixel(px: number, py: number) {
    return TILES[this.fg(Math.floor(px / TILE), Math.floor(py / TILE))].solid;
  }

  platformAtPixel(px: number, py: number) {
    return !!TILES[this.fg(Math.floor(px / TILE), Math.floor(py / TILE))].platform;
  }

  damageRatio(x: number, y: number, now: number) {
    const i = y * COLS + x;
    if (now - this.damageTime[i] > 3) return 0;
    const hp = TILES[this.fg(x, y)].hp;
    return hp ? this.damage[i] / hp : 0;
  }

  /** Hit a block with the pickaxe. Returns null if it can't be mined. */
  hit(x: number, y: number, power: number, now: number): { broke: boolean; id: TileId } | null {
    if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return null;
    const id = this.fg(x, y);
    const info = TILES[id];
    if (!info.breakable) return null;
    const i = y * COLS + x;
    // Damage heals if you stop hitting a block for a few seconds.
    if (now - this.damageTime[i] > 3) this.damage[i] = 0;
    this.damage[i] += power;
    this.damageTime[i] = now;
    if (this.damage[i] < info.hp) return { broke: false, id };
    this.set(x, y, Tile.Air);
    return { broke: true, id };
  }

  /** A torch needs a block under or beside it, or a wall behind it. */
  torchSupported(x: number, y: number) {
    return (
      TILES[this.fg(x, y + 1)].solid ||
      TILES[this.fg(x - 1, y)].solid ||
      TILES[this.fg(x + 1, y)].solid ||
      this.bg(x, y) !== Wall.None
    );
  }

  /** Blocks need something to attach to: a neighboring block or a wall behind. */
  blockSupported(x: number, y: number) {
    const near = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ].some(([dx, dy]) => {
      const t = TILES[this.fg(x + dx, y + dy)];
      return t.solid || t.platform;
    });
    return near || this.bg(x, y) !== Wall.None;
  }

  /** Torches next to a removed block fall off if nothing holds them up. */
  unsupportedTorchesAround(x: number, y: number) {
    const out: [number, number][] = [];
    for (const [dx, dy] of [
      [0, -1],
      [1, 0],
      [-1, 0],
    ]) {
      const tx = x + dx;
      const ty = y + dy;
      if (this.fg(tx, ty) === Tile.Torch && !this.torchSupported(tx, ty)) out.push([tx, ty]);
    }
    return out;
  }

  /** Light map: 1 is fully lit, 0 is dark. Sky light comes down open columns; torches glow; light spreads and fades. */
  updateLight() {
    if (!this.lightDirty) return;
    this.lightDirty = false;
    const L = this.light;
    const { skyLight, ambient, glows } = this.scene;
    L.fill(0);
    for (let x = 0; x < COLS; x++) {
      for (let y = 0; y < ROWS; y++) {
        const i = y * COLS + x;
        if (TILES[this.fgGrid[i] as TileId].solid || this.bgGrid[i] !== Wall.None) break;
        L[i] = skyLight;
      }
    }
    for (let i = 0; i < L.length; i++) if (this.fgGrid[i] === Tile.Torch) L[i] = 1;
    for (const [x, y] of glows) L[y * COLS + x] = 1;

    const decay = (i: number) => (TILES[this.fgGrid[i] as TileId].solid ? 0.13 : 0.075);
    for (let pass = 0; pass < 2; pass++) {
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const i = y * COLS + x;
          const d = decay(i);
          if (x > 0) L[i] = Math.max(L[i], L[i - 1] - d);
          if (y > 0) L[i] = Math.max(L[i], L[i - COLS] - d);
        }
      }
      for (let y = ROWS - 1; y >= 0; y--) {
        for (let x = COLS - 1; x >= 0; x--) {
          const i = y * COLS + x;
          const d = decay(i);
          if (x < COLS - 1) L[i] = Math.max(L[i], L[i + 1] - d);
          if (y < ROWS - 1) L[i] = Math.max(L[i], L[i + COLS] - d);
        }
      }
    }

    const data = this.lightImage.data;
    for (let i = 0; i < L.length; i++) {
      const dark = 1 - Math.min(1, Math.max(ambient, L[i]));
      data[i * 4] = 10;
      data[i * 4 + 1] = 6;
      data[i * 4 + 2] = 14;
      data[i * 4 + 3] = Math.round(Math.min(0.94, dark) * 255);
    }
    this.lightCtx.putImageData(this.lightImage, 0, 0);
  }

  generate() {
    this.fgGrid.fill(Tile.Air);
    this.bgGrid.fill(Wall.None);
    this.damage.fill(0);
    this.scene.build(this, rng(2026));

    // Clear the doorways and make sure there's a floor to walk out on.
    const { left, right } = this.scene.exits;
    for (const [floor, cols] of [
      [left, [0, 1]],
      [right, [COLS - 2, COLS - 1]],
    ] as const) {
      if (floor === undefined) continue;
      for (const x of cols) {
        for (let y = floor - DOOR_HEIGHT; y < floor; y++) this.set(x, y, Tile.Air);
        if (!TILES[this.fg(x, floor)].solid) this.set(x, floor, Tile.Dirt);
      }
    }

    this.lightDirty = true;
    this.updateLight();
  }
}
