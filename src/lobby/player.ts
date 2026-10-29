import { COLS, TILE, type Tuning } from "./config";
import { itemIcon, type ItemId } from "./items";
import { TILES } from "./tiles";
import type { World } from "./world";

export interface Controls {
  left: boolean;
  right: boolean;
  jump: boolean;
  down: boolean;
}

const NONE: Controls = { left: false, right: false, jump: false, down: false };

const COYOTE = 0.08; // seconds you can still jump after walking off a ledge
const JUMP_BUFFER = 0.1; // seconds a jump press is remembered before landing

/** Swing arc relative to facing right: from raised behind the head to down in front. */
const SWING_FROM = (-115 * Math.PI) / 180;
const SWING_TO = (55 * Math.PI) / 180;

export class Player {
  x: number;
  y: number; // feet
  vx = 0;
  vy = 0;
  readonly w = 10;
  readonly h = 22;
  facing: 1 | -1 = 1;
  onGround = false;

  private jumpTimer = 0;
  private jumping = false;
  private jumpWasHeld = false;
  private coyote = 0;
  private buffer = 0;
  private dropThrough = 0;
  private walkPhase = 0;
  /** Visual offset after stepping up a ledge, eased back to zero so the step looks smooth. */
  private stepOffset = 0;

  // Item use.
  useItem: ItemId | null = null;
  useTime = 0;
  useDuration = 0;
  private useStyle: "swing" | "hold" = "swing";

  // Wandering when nobody is playing.
  private aiTarget: number | null = null;
  private aiWait = 1.5;
  private aiStuck = 0;
  private aiLastX = 0;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  get box() {
    return { x: this.x - this.w / 2, y: this.y - this.h, w: this.w, h: this.h };
  }

  get center() {
    return { x: this.x, y: this.y - this.h / 2 };
  }

  get using() {
    return this.useItem !== null;
  }

  /** 0 to 1 through the current swing. */
  get useProgress() {
    return this.useDuration ? Math.min(1, this.useTime / this.useDuration) : 0;
  }

  /** Angle of the held item right now, in world terms (already flipped for facing). */
  get swingAngle() {
    const p = this.useProgress;
    const eased = 1 - Math.pow(1 - p, 2.2);
    const a = this.useStyle === "hold" ? (-25 * Math.PI) / 180 : SWING_FROM + (SWING_TO - SWING_FROM) * eased;
    return this.facing === 1 ? a : Math.PI - a;
  }

  get hand() {
    const shoulder = { x: this.x + this.facing * 1, y: this.y + this.stepOffset - 15 };
    const a = this.swingAngle;
    return { x: shoulder.x + Math.cos(a) * 5, y: shoulder.y + Math.sin(a) * 5, shoulder };
  }

  startUse(item: ItemId, duration: number, style: "swing" | "hold", towardX: number) {
    this.useItem = item;
    this.useTime = 0;
    this.useDuration = duration;
    this.useStyle = style;
    this.facing = towardX >= this.x ? 1 : -1;
  }

  /** Controls for when nobody is playing: wander to a spot, wait, pick another. */
  wander(dt: number, world: World): Controls {
    if (this.aiWait > 0) {
      this.aiWait -= dt;
      return NONE;
    }
    if (this.aiTarget === null) {
      this.aiTarget = (2 + Math.random() * (COLS - 4)) * TILE;
      this.aiStuck = 0;
      this.aiLastX = this.x;
    }
    const dx = this.aiTarget - this.x;
    if (Math.abs(dx) < 4) {
      this.aiTarget = null;
      this.aiWait = 1 + Math.random() * 3;
      return NONE;
    }
    const dir = Math.sign(dx);
    // Jump when the wall ahead is taller than a single step.
    const aheadX = this.x + dir * (this.w / 2 + 3);
    const feetRow = Math.floor((this.y - 1) / TILE);
    const blocked1 = TILES[world.fg(Math.floor(aheadX / TILE), feetRow)].solid;
    const blocked2 = TILES[world.fg(Math.floor(aheadX / TILE), feetRow - 1)].solid;
    // Give up on spots it can't reach.
    this.aiStuck = Math.abs(this.x - this.aiLastX) < 0.5 ? this.aiStuck + dt : 0;
    this.aiLastX = this.x;
    if (this.aiStuck > 1.2) {
      this.aiTarget = null;
      this.aiWait = 0.5;
      return NONE;
    }
    return { left: dir < 0, right: dir > 0, jump: blocked1 && blocked2 && this.onGround, down: false };
  }

  update(dt: number, input: Controls, world: World, t: Tuning) {
    // Horizontal movement.
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const control = this.onGround ? 1 : t.airControl;
    if (dir !== 0) {
      const turning = Math.sign(this.vx) === -dir;
      this.vx += dir * (t.accel + (turning ? t.friction : 0)) * control * dt;
      if (Math.abs(this.vx) > t.runSpeed) this.vx = Math.sign(this.vx) * t.runSpeed;
      if (!this.using) this.facing = dir as 1 | -1;
    } else {
      const drag = (this.onGround ? t.friction : t.friction * 0.15) * dt;
      this.vx = Math.abs(this.vx) <= drag ? 0 : this.vx - Math.sign(this.vx) * drag;
    }

    // Jumping: holding jump keeps rising at full speed for up to jumpHold seconds.
    const pressed = input.jump && !this.jumpWasHeld;
    this.jumpWasHeld = input.jump;
    if (pressed) this.buffer = JUMP_BUFFER;
    this.coyote = this.onGround ? COYOTE : this.coyote - dt;
    this.buffer -= dt;
    if (this.buffer > 0 && this.coyote > 0) {
      this.jumping = true;
      this.jumpTimer = t.jumpHold;
      this.vy = -t.jumpSpeed;
      this.buffer = 0;
      this.coyote = 0;
    }
    if (this.jumping && input.jump && this.jumpTimer > 0) {
      this.vy = -t.jumpSpeed;
      this.jumpTimer -= dt;
    } else {
      this.jumping = false;
      this.vy = Math.min(this.vy + t.gravity * dt, t.maxFall);
    }

    if (input.down && this.standingOnPlatform(world)) this.dropThrough = 0.18;
    this.dropThrough -= dt;

    this.moveX(this.vx * dt, world);
    this.moveY(this.vy * dt, world);

    this.stepOffset = Math.max(0, this.stepOffset - 60 * dt);
    if (this.onGround && Math.abs(this.vx) > 2) this.walkPhase += (Math.abs(this.vx) / t.runSpeed) * dt * 11;
    else this.walkPhase = 0;

    if (this.useItem) {
      this.useTime += dt;
      if (this.useTime >= this.useDuration) this.useItem = null;
    }
  }

  private hitsSolid(world: World, left: number, top: number) {
    const x0 = Math.floor(left / TILE);
    const x1 = Math.floor((left + this.w - 0.01) / TILE);
    const y0 = Math.floor(top / TILE);
    const y1 = Math.floor((top + this.h - 0.01) / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (TILES[world.fg(tx, ty)].solid) return true;
      }
    }
    return false;
  }

  private moveX(dx: number, world: World) {
    if (dx === 0) return;
    const nx = this.x + dx;
    if (!this.hitsSolid(world, nx - this.w / 2, this.y - this.h)) {
      this.x = nx;
      return;
    }
    // Walk up single-block ledges without jumping.
    if (this.onGround && !this.hitsSolid(world, nx - this.w / 2, this.y - this.h - TILE)) {
      this.y -= TILE;
      this.stepOffset += TILE;
      this.x = nx;
      return;
    }
    if (dx > 0) this.x = Math.floor((nx + this.w / 2) / TILE) * TILE - this.w / 2 - 0.001;
    else this.x = Math.ceil((nx - this.w / 2) / TILE) * TILE + this.w / 2 + 0.001;
    this.vx = 0;
  }

  private moveY(dy: number, world: World) {
    const ny = this.y + dy;
    this.onGround = false;
    if (dy > 0) {
      const x0 = Math.floor((this.x - this.w / 2) / TILE);
      const x1 = Math.floor((this.x + this.w / 2 - 0.01) / TILE);
      const fromRow = Math.floor((this.y - 0.01) / TILE);
      const toRow = Math.floor(ny / TILE);
      for (let row = fromRow + 1; row <= toRow; row++) {
        for (let tx = x0; tx <= x1; tx++) {
          const tile = TILES[world.fg(tx, row)];
          const landsOnPlatform = tile.platform && this.dropThrough <= 0;
          if (tile.solid || landsOnPlatform) {
            this.y = row * TILE;
            this.vy = 0;
            this.onGround = true;
            return;
          }
        }
      }
      this.y = ny;
    } else if (dy < 0) {
      if (this.hitsSolid(world, this.x - this.w / 2, ny - this.h)) {
        this.y = Math.ceil((ny - this.h) / TILE) * TILE + this.h;
        this.vy = 0;
        this.jumping = false;
      } else {
        this.y = ny;
      }
    }
    // Still standing on something?
    if (dy === 0 || !this.onGround) {
      const below = Math.floor((this.y + 0.5) / TILE);
      const x0 = Math.floor((this.x - this.w / 2) / TILE);
      const x1 = Math.floor((this.x + this.w / 2 - 0.01) / TILE);
      for (let tx = x0; tx <= x1; tx++) {
        const tile = TILES[world.fg(tx, below)];
        if ((tile.solid || (tile.platform && this.dropThrough <= 0)) && Math.abs(this.y - below * TILE) < 0.6 && this.vy >= 0) {
          this.onGround = true;
        }
      }
    }
  }

  private standingOnPlatform(world: World) {
    if (!this.onGround) return false;
    const below = Math.floor((this.y + 0.5) / TILE);
    const x0 = Math.floor((this.x - this.w / 2) / TILE);
    const x1 = Math.floor((this.x + this.w / 2 - 0.01) / TILE);
    for (let tx = x0; tx <= x1; tx++) if (TILES[world.fg(tx, below)].solid) return false;
    return true;
  }

  draw(ctx: CanvasRenderingContext2D) {
    const ox = Math.round(this.x) - 8;
    const oy = Math.round(this.y + this.stepOffset) - 24;
    const f = this.facing;
    // Mirror horizontally inside the 16px sprite box when facing left.
    const r = (x: number, y: number, w: number, h: number, color: string) => {
      ctx.fillStyle = color;
      ctx.fillRect(f === 1 ? ox + x : ox + 16 - x - w, oy + y, w, h);
    };

    const airborne = !this.onGround;
    const step = Math.floor(this.walkPhase) % 4;
    const stride = airborne ? 0 : step === 0 ? 2 : step === 2 ? -2 : 0;
    const bob = !airborne && (step === 1 || step === 3) ? 1 : 0;

    const C = {
      outline: "#24160e",
      hair: "#4a2c19",
      hairLight: "#6a4128",
      skin: "#e8b48a",
      skinShade: "#c98f66",
      shirt: "#d9a441",
      shirtShade: "#a87a26",
      pants: "#3b4a6b",
      pantsShade: "#2b3650",
      shoe: "#2a1a10",
    };

    // Back leg.
    const backLift = airborne ? (this.vy < 0 ? 2 : 0) : 0;
    r(6 - stride, 16 + bob, 3, 6 - backLift, C.pantsShade);
    r(6 - stride, 22 + bob - backLift, 3, 2, C.shoe);
    // Back arm.
    if (!this.using) r(5 + Math.sign(stride), 9 + bob, 2, 6, C.shirtShade);
    // Torso.
    r(5, 8 + bob, 6, 8, C.shirt);
    r(5, 8 + bob, 1, 8, C.shirtShade);
    r(6, 15 + bob, 5, 1, C.shirtShade);
    // Front leg.
    const frontLift = airborne ? (this.vy < 0 ? 0 : 1) : 0;
    r(7 + stride, 16 + bob, 3, 6 - frontLift, C.pants);
    r(7 + stride, 22 + bob - frontLift, 3, 2, C.shoe);
    r(8 + stride, 16 + bob, 1, 6 - frontLift, C.pantsShade);
    // Head.
    r(5, 1 + bob, 7, 7, C.skin);
    r(5, 6 + bob, 7, 1, C.skinShade);
    r(4, 0 + bob, 8, 3, C.hair);
    r(4, 3 + bob, 2, 3, C.hair);
    r(6, 0 + bob, 4, 1, C.hairLight);
    r(10, 3 + bob, 1, 2, C.outline);
    r(11, 5 + bob, 1, 1, C.skinShade);

    // Front arm and held item.
    if (this.using && this.useItem) {
      const { shoulder, x: hx, y: hy } = this.hand;
      ctx.save();
      ctx.translate(Math.round(hx), Math.round(hy));
      ctx.rotate(this.swingAngle + Math.PI / 4);
      if (f === -1) ctx.scale(1, -1);
      // Icons are drawn pointing up and right, with the handle at (2, 13).
      ctx.drawImage(itemIcon(this.useItem), -2, -13);
      ctx.restore();
      const steps = 5;
      for (let i = 0; i <= steps; i++) {
        const px = shoulder.x + ((hx - shoulder.x) * i) / steps;
        const py = shoulder.y + ((hy - shoulder.y) * i) / steps;
        ctx.fillStyle = i >= steps - 1 ? C.skin : C.shirt;
        ctx.fillRect(Math.round(px) - 1, Math.round(py) - 1, 2, 2);
      }
    } else {
      const swing = airborne ? -2 : -Math.sign(stride);
      r(8 + swing, 9 + bob, 2, 5, C.shirt);
      r(8 + swing, 14 + bob, 2, 1, C.skin);
    }
  }
}
