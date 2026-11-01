import { Vector3 } from "three";
import { SCREEN_SIZE } from "./screen";

export { IMAGE, REEL_VIEW, reelRect } from "./screen";

// Room dimensions and where everything sits, in meters. The viewer sits on a
// couch at the front of the room looking at the screen on the back wall.

export const ROOM = {
  halfWidth: 3.2,
  back: -4.2,
  front: 3.8,
  height: 2.6,
};

export const SCREEN = {
  center: new Vector3(0, 1.6, -4.12),
  ...SCREEN_SIZE,
};

export const COUCH = {
  eye: new Vector3(0, 1.12, 2.3),
  look: new Vector3(0.05, 0.98, -4.1),
};

export const COFFEE_TABLE = { center: new Vector3(0.15, 0, 0.55), top: 0.445 };

export const PROJECTOR = { position: new Vector3(0.5, COFFEE_TABLE.top, 0.6) };

/** The program, standing half open like a greeting card on the back of the coffee table. */
export const PROGRAM = { position: new Vector3(0.14, COFFEE_TABLE.top, 0.33), yaw: 1.1, open: 0.42 };

export const LAMP = { table: new Vector3(-2.45, 0, -3.25) };

/** A loveseat against the left wall with the side table at its far end, so the lamp lights it. From the couch the view cuts it off at the left. */
export const SOFA = { position: new Vector3(-2.68, 0, -2.0), yaw: Math.PI / 2 };

/** A lounge chair in the far right corner, under the pole lamp, turned toward the couch. */
export const CHAIR = { position: new Vector3(2.35, 0, -3.35), yaw: -0.6 };

/** The pin board on the back wall, right of the screen and above the radio, where the pole lamp lights it. */
export const BOARD = { center: new Vector3(1.98, 1.6, ROOM.back), width: 1.1, height: 0.75 };

export const WINDOW = { z0: -3.55, z1: -2.35, y0: 0.85, y1: 2.05 };
