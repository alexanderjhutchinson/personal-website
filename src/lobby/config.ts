// The lobby is drawn at a fixed low resolution and scaled up with crisp pixels.

export const TILE = 8;
export const COLS = 48;
export const ROWS = 27;
export const WIDTH = COLS * TILE; // 384
export const HEIGHT = ROWS * TILE; // 216

/** Everything that decides how the lobby feels. Editable live in the tuning panel (press `). */
export interface Tuning {
  /** Top running speed, px/s. */
  runSpeed: number;
  /** How fast the player reaches top speed, px/s². */
  accel: number;
  /** How fast the player stops on the ground with no input, px/s². */
  friction: number;
  /** Fraction of ground acceleration available in the air. */
  airControl: number;
  /** Upward speed while the jump is held, px/s. */
  jumpSpeed: number;
  /** How long holding jump keeps the upward speed, s. Longer means higher jumps. */
  jumpHold: number;
  gravity: number;
  maxFall: number;
  /** Seconds per pickaxe swing. */
  pickUseTime: number;
  /** Seconds per sword swing. */
  swordUseTime: number;
  /** Damage each pickaxe hit does to a block. */
  pickPower: number;
  /** How far away the player can mine or place, in tiles. */
  reach: number;
}

export const DEFAULT_TUNING: Tuning = {
  runSpeed: 92,
  accel: 420,
  friction: 640,
  airControl: 0.65,
  jumpSpeed: 180,
  jumpHold: 0.17,
  gravity: 950,
  maxFall: 270,
  pickUseTime: 0.22,
  swordUseTime: 0.3,
  pickPower: 35,
  reach: 5.5,
};

export const TUNING_RANGES: Record<keyof Tuning, [number, number, number]> = {
  runSpeed: [30, 200, 1],
  accel: [100, 1500, 10],
  friction: [100, 2000, 10],
  airControl: [0, 1, 0.05],
  jumpSpeed: [60, 400, 5],
  jumpHold: [0, 0.4, 0.01],
  gravity: [200, 2500, 10],
  maxFall: [80, 600, 5],
  pickUseTime: [0.08, 0.6, 0.01],
  swordUseTime: [0.1, 0.8, 0.01],
  pickPower: [5, 100, 1],
  reach: [2, 12, 0.5],
};

const TUNING_KEY = "lobby:tuning";

export function loadTuning(): Tuning {
  try {
    const saved = localStorage.getItem(TUNING_KEY);
    if (saved) return { ...DEFAULT_TUNING, ...(JSON.parse(saved) as Partial<Tuning>) };
  } catch {
    // Fall back to defaults when storage is unavailable or the saved value is malformed.
  }
  return { ...DEFAULT_TUNING };
}

export function saveTuning(t: Tuning) {
  try {
    localStorage.setItem(TUNING_KEY, JSON.stringify(t));
  } catch {
    // Tuning still applies for this visit.
  }
}

export function clearTuning() {
  try {
    localStorage.removeItem(TUNING_KEY);
  } catch {
    // Nothing to clear.
  }
}
