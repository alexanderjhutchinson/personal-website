import { COLS, HEIGHT, ROWS, TILE, WIDTH } from "./config";
import { drawDecor } from "./decor";
import type { ReelScene } from "./scenes";
import { Tile, drawCracks, drawTile, drawWall } from "./tiles";
import type { World } from "./world";

// Drawing a reel's scene, shared by the game and by the still the room's projector shows.

const CLOUDS = [
  { x: 40, y: 22, w: 26 },
  { x: 170, y: 36, w: 34 },
  { x: 260, y: 16, w: 20 },
];

/** Everything behind the characters: sky, drifting clouds, walls, props, and blocks. */
export function drawSet(ctx: CanvasRenderingContext2D, world: World, scene: ReelScene, backdrop: HTMLCanvasElement, time: number) {
  ctx.drawImage(backdrop, 0, 0);

  if (scene.clouds) {
    const [color, shade] = scene.clouds;
    for (const cl of CLOUDS) {
      const x = Math.round(((cl.x + time * 2.5) % (WIDTH + 60)) - 30);
      ctx.fillStyle = color;
      ctx.fillRect(x, cl.y, cl.w, 3);
      ctx.fillRect(x + 4, cl.y - 2, cl.w - 10, 2);
      ctx.fillStyle = shade;
      ctx.fillRect(x + 2, cl.y + 3, cl.w - 4, 1);
    }
  }

  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) drawWall(ctx, world.bg(x, y), x, y);
  for (const d of scene.decor) drawDecor(ctx, d, time);
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      drawTile(ctx, world, x, y, time);
      const ratio = world.damageRatio(x, y, time);
      if (ratio > 0) drawCracks(ctx, x, y, ratio);
    }
  }
}

/** Light over the whole scene: the tile light map, then a warm glow around torches and anything else that burns. */
export function drawLight(ctx: CanvasRenderingContext2D, world: World, scene: ReelScene, time: number) {
  // Soft lighting: the tile light map scaled up with smoothing.
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(world.lightCanvas, 0, 0, WIDTH, HEIGHT);
  ctx.imageSmoothingEnabled = false;

  ctx.globalCompositeOperation = "lighter";
  const glow = (x: number, y: number) => {
    const cx = x * TILE + 4;
    const cy = y * TILE + 2;
    const flicker = 0.85 + Math.sin(time * 9 + x) * 0.08 + Math.sin(time * 23 + y) * 0.05;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 26 * flicker);
    g.addColorStop(0, "rgba(255, 170, 80, 0.28)");
    g.addColorStop(1, "rgba(255, 120, 40, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(cx - 30, cy - 30, 60, 60);
  };
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (world.fg(x, y) === Tile.Torch) glow(x, y);
  for (const [x, y] of scene.glows) glow(x, y);
  ctx.globalCompositeOperation = "source-over";
}
