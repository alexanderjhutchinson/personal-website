import { COLS, ROWS, TILE } from "./config";
import { makeCanvas } from "./pixels";
import { Tile, TILES, Wall, type TileGrid, type TileId, type WallId } from "./tiles";
import { rng } from "../scene/random";

/** Ground height for each column, in tile rows. The house sits on the flat part at the left. */
const SURFACE = [
  17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 16, 16, 16, 16, 15, 15, 15, 15, 16,
  16, 17, 17, 17, 17, 18, 18, 18, 17, 17, 17, 16, 16, 15, 15, 14, 14, 14, 15,
];

export interface Tree {
  x: number;
  ground: number;
  height: number;
}

/**
 * The home base scene: one screen of tiles with a foreground layer (blocks you
 * collide with and can mine) and a background wall layer.
 */
export class World implements TileGrid {
  readonly fgGrid = new Uint8Array(COLS * ROWS);
  readonly bgGrid = new Uint8Array(COLS * ROWS);
  readonly light = new Float32Array(COLS * ROWS);
  readonly lightCanvas: HTMLCanvasElement;
  readonly trees: Tree[] = [
    { x: 21, ground: 16, height: 6 },
    { x: 45, ground: 14, height: 5 },
  ];
  /** Where the target dummy stands, in pixels (bottom center). */
  readonly dummyAt = { x: 27 * TILE + 4, y: 15 * TILE };
  readonly spawn = { x: 9 * TILE, y: 17 * TILE };

  private damage = new Float32Array(COLS * ROWS);
  private damageTime = new Float32Array(COLS * ROWS);
  private lightCtx: CanvasRenderingContext2D;
  private lightImage: ImageData;
  private lightDirty = true;

  constructor() {
    const { c, ctx } = makeCanvas(COLS, ROWS);
    this.lightCanvas = c;
    this.lightCtx = ctx;
    this.lightImage = ctx.createImageData(COLS, ROWS);
    this.generate();
  }

  fg(x: number, y: number): TileId {
    if (x < 0 || x >= COLS || y >= ROWS) return Tile.Bedrock; // the frame's edges are walls
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

  private setWall(x: number, y: number, id: WallId) {
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

  /** Light map: 1 is fully lit, 0 is dark. Sunlight comes down open columns; torches glow; light spreads and fades. */
  updateLight() {
    if (!this.lightDirty) return;
    this.lightDirty = false;
    const L = this.light;
    L.fill(0);
    for (let x = 0; x < COLS; x++) {
      for (let y = 0; y < ROWS; y++) {
        const i = y * COLS + x;
        if (TILES[this.fgGrid[i] as TileId].solid || this.bgGrid[i] !== Wall.None) break;
        L[i] = 1;
      }
    }
    for (let i = 0; i < L.length; i++) if (this.fgGrid[i] === Tile.Torch) L[i] = Math.max(L[i], 1);

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
      const dark = 1 - Math.min(1, L[i]);
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
    const r = rng(2026);

    for (let x = 0; x < COLS; x++) {
      const top = SURFACE[x];
      const dirtDepth = 4 + Math.floor(r() * 2);
      for (let y = top; y < ROWS; y++) {
        let id: TileId = Tile.Stone;
        if (y === ROWS - 1) id = Tile.Bedrock;
        else if (y === top) id = Tile.Grass;
        else if (y < top + dirtDepth) id = Tile.Dirt;
        else if (r() < 0.12) id = Tile.Dirt;
        this.set(x, y, id);
        if (y > top) this.setWall(x, y, Wall.Dirt);
      }
    }

    // A small cave lit by a torch.
    for (let x = 30; x <= 41; x++) {
      for (let y = 21; y <= 24; y++) {
        const dx = (x - 35.5) / 6;
        const dy = (y - 22.8) / 2.3;
        if (dx * dx + dy * dy < 1) this.set(x, y, Tile.Air);
      }
    }
    this.set(33, 24, Tile.Torch);

    // The house: plank floor and walls, doorways on both sides, a stepped roof.
    const [x0, x1, floor] = [3, 15, 17];
    for (let x = x0; x <= x1; x++) this.set(x, floor, Tile.Planks);
    for (let y = 11; y < floor; y++) {
      for (let x = x0 + 1; x < x1; x++) this.setWall(x, y, Wall.Planks);
      if (y < 14) {
        this.set(x0, y, Tile.Planks);
        this.set(x1, y, Tile.Planks);
      }
    }
    for (let x = x0 - 1; x <= x1 + 1; x++) this.set(x, 10, Tile.Planks);
    for (let x = x0 + 1; x <= x1 - 1; x++) this.set(x, 9, Tile.Planks);
    for (let x = x0 + 3; x <= x1 - 3; x++) this.set(x, 8, Tile.Planks);
    for (let x = x0 + 1; x <= x0 + 4; x++) this.set(x, 13, Tile.Platform);
    this.set(9, 12, Tile.Torch);

    this.lightDirty = true;
    this.updateLight();
  }
}
