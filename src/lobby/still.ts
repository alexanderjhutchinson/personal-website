import { HEIGHT, WIDTH } from "./config";
import { drawLight, drawSet } from "./draw";
import { Dummy } from "./entities";
import { makeCanvas } from "./pixels";
import { Player } from "./player";
import { SCENES } from "./scenes";
import { World } from "./world";
import type { ReelId } from "../data";

/**
 * A reel's opening frame, the way it looks the moment the page loads: the
 * character at its spawn point, nothing mined yet. The living room's projector
 * shows it on the screen, so walking into the screen lands on the same picture.
 */
export function paintReelStill(id: ReelId) {
  const scene = SCENES[id];
  const world = new World(scene);
  const { c, ctx } = makeCanvas(WIDTH, HEIGHT);
  drawSet(ctx, world, scene, scene.paintBackdrop(), 0);
  if (scene.dummyAt) new Dummy(scene.dummyAt.x, scene.dummyAt.y).draw(ctx);
  const player = new Player(scene.spawn.x, scene.spawn.y);
  player.onGround = true;
  player.draw(ctx);
  drawLight(ctx, world, scene, 0);
  return c;
}
