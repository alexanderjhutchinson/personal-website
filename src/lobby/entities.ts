import { TILE } from "./config";
import { itemIcon, type ItemId } from "./items";
import { drawNumber } from "./pixels";
import type { World } from "./world";

/** A straw training dummy on a post. It wobbles when hit and never falls. */
export class Dummy {
  x: number;
  y: number;
  angle = 0;
  spin = 0;
  readonly w = 12;
  readonly h = 22;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  get box() {
    return { x: this.x - this.w / 2, y: this.y - this.h, w: this.w, h: this.h };
  }

  hit(fromRight: boolean) {
    this.spin += fromRight ? -7 : 7;
  }

  update(dt: number) {
    // Damped spring back to upright.
    this.spin += (-this.angle * 140 - this.spin * 9) * dt;
    this.angle += this.spin * dt;
  }

  draw(ctx: CanvasRenderingContext2D) {
    const { x, y } = this;
    ctx.fillStyle = "#5a3418";
    ctx.fillRect(x - 3, y - 2, 6, 2);
    ctx.save();
    ctx.translate(x, y - 2);
    ctx.rotate(this.angle);
    ctx.fillStyle = "#6a3f20";
    ctx.fillRect(-1, -20, 2, 20);
    // Sack body.
    ctx.fillStyle = "#c9a46a";
    ctx.fillRect(-5, -17, 10, 9);
    ctx.fillStyle = "#a8834f";
    ctx.fillRect(-5, -9, 10, 1);
    ctx.fillRect(4, -17, 1, 9);
    ctx.fillStyle = "#7a5a32";
    ctx.fillRect(-3, -14, 6, 1);
    ctx.fillRect(-1, -16, 1, 5);
    // Crossbar arms.
    ctx.fillStyle = "#6a3f20";
    ctx.fillRect(-8, -15, 16, 2);
    ctx.fillStyle = "#e0c27a";
    ctx.fillRect(-9, -16, 2, 4);
    ctx.fillRect(7, -16, 2, 4);
    // Round straw head.
    ctx.fillStyle = "#d9b56a";
    ctx.fillRect(-3, -23, 6, 6);
    ctx.fillRect(-4, -22, 8, 4);
    ctx.fillStyle = "#b8924c";
    ctx.fillRect(-2, -21, 1, 1);
    ctx.fillRect(1, -21, 1, 1);
    ctx.fillRect(-1, -19, 2, 1);
    ctx.restore();
  }
}

/** An item that popped out of a broken block. It falls, then flies to the player when they're close. */
export class Drop {
  vx: number;
  vy: number;
  age = 0;
  taken = false;

  constructor(
    public item: ItemId,
    public x: number,
    public y: number,
  ) {
    this.vx = (Math.random() - 0.5) * 50;
    this.vy = -70 - Math.random() * 30;
  }

  update(dt: number, world: World, target: { x: number; y: number }) {
    this.age += dt;
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const dist = Math.hypot(dx, dy);
    if (this.age > 0.25 && dist < 3.5 * TILE) {
      const pull = 420 * dt;
      this.vx += (dx / dist) * pull;
      this.vy += (dy / dist) * pull;
      this.vx *= 0.9;
      this.vy *= 0.9;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      if (dist < 6) this.taken = true;
      return;
    }
    this.vy = Math.min(this.vy + 600 * dt, 200);
    this.x += this.vx * dt;
    const ny = this.y + this.vy * dt;
    if (this.vy > 0 && world.solidAtPixel(this.x, ny + 3)) {
      this.y = Math.floor((ny + 3) / TILE) * TILE - 3;
      this.vy = 0;
      this.vx *= 0.6;
    } else {
      this.y = ny;
    }
    if (world.solidAtPixel(this.x, this.y)) this.vx = -this.vx * 0.5;
  }

  draw(ctx: CanvasRenderingContext2D, time: number) {
    const bob = Math.round(Math.sin(time * 4 + this.x) * 0.6);
    ctx.drawImage(itemIcon(this.item), 3, 3, 10, 10, Math.round(this.x - 3), Math.round(this.y - 3 + bob), 6, 6);
  }
}

export class Particle {
  life: number;

  constructor(
    public x: number,
    public y: number,
    public vx: number,
    public vy: number,
    public color: string,
    public maxLife = 0.5 + Math.random() * 0.3,
  ) {
    this.life = maxLife;
  }

  update(dt: number) {
    this.life -= dt;
    this.vy += 380 * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.globalAlpha = Math.max(0, Math.min(1, this.life / (this.maxLife * 0.5)));
    ctx.fillStyle = this.color;
    ctx.fillRect(Math.round(this.x), Math.round(this.y), 1, 1);
    ctx.globalAlpha = 1;
  }
}

export function burst(list: Particle[], x: number, y: number, color: string, count: number, speed = 60) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.4 + Math.random() * 0.8);
    list.push(new Particle(x, y, Math.cos(a) * s, Math.sin(a) * s - 40, color));
  }
}

/** A damage number that pops up and drifts. */
export class Floater {
  age = 0;
  vx = (Math.random() - 0.5) * 20;

  constructor(
    public text: string,
    public x: number,
    public y: number,
    public color: string,
  ) {}

  get done() {
    return this.age > 0.9;
  }

  update(dt: number) {
    this.age += dt;
    this.x += this.vx * dt;
    this.y -= (34 - this.age * 30) * dt;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.globalAlpha = this.age > 0.6 ? Math.max(0, 1 - (this.age - 0.6) / 0.3) : 1;
    const w = this.text.length * 4 - 1;
    drawNumber(ctx, this.text, Math.round(this.x - w / 2), Math.round(this.y), this.color);
    ctx.globalAlpha = 1;
  }
}
