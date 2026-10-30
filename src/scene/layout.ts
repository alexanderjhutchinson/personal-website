import { Vector3 } from "three";

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
  width: 2.5,
  height: 1.56,
  /** Black masking border, as a fraction of the screen width. */
  border: 0.035,
};

/** The projected picture: the screen minus its masking border. */
export const IMAGE = {
  width: SCREEN.width - 2 * SCREEN.border * SCREEN.width,
  height: SCREEN.height - 2 * SCREEN.border * SCREEN.width,
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

export const WINDOW = { z0: -3.55, z1: -2.35, y0: 0.85, y1: 2.05 };
