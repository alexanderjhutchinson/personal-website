import { COLS, HEIGHT, ROWS, TILE, WIDTH, loadTuning } from "./config";
import { Drop, Dummy, Floater, Particle, burst } from "./entities";
import { mountHotbar, mountTuning } from "./hud";
import { Inventory } from "./inventory";
import { ITEMS } from "./items";
import { makeCanvas } from "./pixels";
import { Player, type Controls } from "./player";
import { Sfx } from "./sfx";
import { Tile, TILES, drawCracks, drawTile, drawWall } from "./tiles";
import { World, type Tree } from "./world";
import { rng } from "../scene/random";

const STEP = 1 / 120;
const IDLE_BEFORE_WANDER = 6; // seconds without input before the character wanders on its own
const SOUND_KEY = "movie-night:sound";

/** Sky, sunset, hills, and trees: painted once, since nothing in them moves. */
function paintBackdrop(trees: Tree[]) {
  const { c, ctx } = makeCanvas(WIDTH, HEIGHT);
  const sky = ctx.createLinearGradient(0, 0, 0, 130);
  sky.addColorStop(0, "#1d1f45");
  sky.addColorStop(0.5, "#6b3f63");
  sky.addColorStop(0.85, "#d0704a");
  sky.addColorStop(1, "#e89a55");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const r = rng(7);
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(255, 240, 220, ${0.3 + r() * 0.6})`;
    ctx.fillRect(Math.floor(r() * WIDTH), Math.floor(r() * 50), 1, 1);
  }

  // A striped setting sun, like the poster in the living room.
  const [sx, sy, sr] = [298, 112, 26];
  for (let y = -sr; y <= sr; y++) {
    const half = Math.floor(Math.sqrt(sr * sr - y * y));
    const row = sy + y;
    const band = y > 4 && (y - 4) % 6 < Math.min(4, Math.floor((y - 4) / 5) + 1);
    if (band) continue;
    ctx.fillStyle = y < -8 ? "#f6d07a" : y < 6 ? "#f2b04a" : "#e0662a";
    ctx.fillRect(sx - half, row, half * 2, 1);
  }

  const hills = (base: number, amp: number, freq: number, phase: number, color: string) => {
    ctx.fillStyle = color;
    for (let x = 0; x < WIDTH; x++) {
      const h = base - Math.round(Math.sin(x * freq + phase) * amp + Math.sin(x * freq * 2.7 + phase * 2) * amp * 0.35);
      ctx.fillRect(x, h, 1, HEIGHT - h);
    }
  };
  hills(118, 9, 0.018, 1.2, "#5a3554");
  hills(130, 7, 0.026, 3.1, "#3b2440");

  for (const tree of trees) {
    const baseX = tree.x * TILE + 4;
    const baseY = tree.ground * TILE;
    const top = baseY - tree.height * TILE;
    ctx.fillStyle = "#5a3418";
    ctx.fillRect(baseX - 2, top + 6, 5, baseY - top - 6);
    ctx.fillStyle = "#6a3f20";
    ctx.fillRect(baseX - 2, top + 6, 2, baseY - top - 6);
    ctx.fillRect(baseX - 4, baseY - 2, 9, 2);
    const blob = (cx: number, cy: number, rad: number, color: string) => {
      ctx.fillStyle = color;
      for (let y = -rad; y <= rad; y++) {
        const half = Math.round(Math.sqrt(rad * rad - y * y));
        ctx.fillRect(cx - half, cy + y, half * 2 + 1, 1);
      }
    };
    blob(baseX, top + 4, 11, "#2f5424");
    blob(baseX - 6, top + 8, 7, "#2f5424");
    blob(baseX + 7, top + 7, 7, "#2f5424");
    blob(baseX - 1, top + 2, 8, "#3e6b2c");
    blob(baseX + 3, top - 1, 5, "#4c7f2c");
    ctx.fillStyle = "#5f9a3a";
    for (let i = 0; i < 10; i++) ctx.fillRect(baseX - 6 + Math.floor(r() * 14), top - 4 + Math.floor(r() * 10), 1, 1);
  }
  return c;
}

function rectsOverlap(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function startLobby() {
  const canvas = document.getElementById("lobby-canvas") as HTMLCanvasElement | null;
  const frame = document.getElementById("frame");
  const hotbar = document.getElementById("hotbar");
  const tooltip = document.getElementById("tooltip");
  const label = document.getElementById("item-label");
  const tuningPanel = document.getElementById("tuning");
  const tuneButton = document.getElementById("tune-toggle");
  const soundButton = document.getElementById("lobby-sound");
  if (!canvas || !frame || !hotbar || !tooltip || !label || !tuningPanel) return;
  const screen = canvas.getContext("2d");
  if (!screen) return;

  const tuning = loadTuning();
  let world = new World();
  let player = new Player(world.spawn.x, world.spawn.y);
  let dummy = new Dummy(world.dummyAt.x, world.dummyAt.y);
  let drops: Drop[] = [];
  let particles: Particle[] = [];
  let floaters: Floater[] = [];
  const backdrop = paintBackdrop(world.trees);
  const { c: buffer, ctx } = makeCanvas(WIDTH, HEIGHT);

  const inv = new Inventory();
  const stockInventory = () => {
    inv.slots.fill(null);
    inv.put(0, "pickaxe", 1);
    inv.put(1, "sword", 1);
    inv.put(2, "torch", 99);
    inv.select(0);
  };
  mountHotbar(hotbar, tooltip, label, inv);
  stockInventory();

  const resetScene = () => {
    world = new World();
    player = new Player(world.spawn.x, world.spawn.y);
    dummy = new Dummy(world.dummyAt.x, world.dummyAt.y);
    drops = [];
    particles = [];
    floaters = [];
    stockInventory();
  };
  mountTuning(tuningPanel, tuning, resetScene);
  const showTuning = import.meta.env.DEV || new URLSearchParams(location.search).has("tune");
  if (tuneButton) tuneButton.hidden = !showTuning;
  const toggleTuning = () => {
    if (!showTuning) return;
    tuningPanel.hidden = !tuningPanel.hidden;
  };
  tuneButton?.addEventListener("click", toggleTuning);

  // Sound shares the preference with the living room.
  const sfx = new Sfx();
  let soundOn = false;
  try {
    soundOn = localStorage.getItem(SOUND_KEY) === "on";
  } catch {
    // Sound stays off.
  }
  const renderSound = () => {
    soundButton?.setAttribute("aria-pressed", String(soundOn));
    const text = soundButton?.querySelector("[data-label]");
    if (text) text.textContent = soundOn ? "Sound on" : "Sound off";
  };
  renderSound();
  soundButton?.addEventListener("click", () => {
    soundOn = !soundOn;
    try {
      localStorage.setItem(SOUND_KEY, soundOn ? "on" : "off");
    } catch {
      // Not remembered, still applies now.
    }
    sfx.setEnabled(soundOn);
    renderSound();
  });

  // Input.
  const keys = new Set<string>();
  const mouse = { x: -100, y: -100, down: false, inside: false };
  let lastInput = -Infinity;
  let time = 0;
  const GAME_KEYS = new Set(["KeyA", "KeyD", "KeyW", "KeyS", "Space", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]);

  window.addEventListener("keydown", (e) => {
    if (e.target instanceof HTMLInputElement) return;
    if (e.code === "Backquote") {
      toggleTuning();
      return;
    }
    if (/^Digit[0-9]$/.test(e.code)) {
      const n = Number(e.code.slice(5));
      inv.select(n === 0 ? 9 : n - 1);
      lastInput = time;
      return;
    }
    if (GAME_KEYS.has(e.code)) {
      e.preventDefault();
      keys.add(e.code);
      lastInput = time;
      if (soundOn) sfx.setEnabled(true);
    }
  });
  window.addEventListener("keyup", (e) => keys.delete(e.code));
  window.addEventListener("blur", () => {
    keys.clear();
    mouse.down = false;
  });

  const toLogical = (e: PointerEvent | WheelEvent) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * WIDTH;
    mouse.y = ((e.clientY - rect.top) / rect.height) * HEIGHT;
  };
  canvas.addEventListener("pointermove", (e) => {
    toLogical(e);
    mouse.inside = true;
  });
  canvas.addEventListener("pointerleave", () => {
    mouse.inside = false;
    mouse.down = false;
  });
  canvas.addEventListener("pointerdown", (e) => {
    toLogical(e);
    mouse.inside = true;
    mouse.down = true;
    lastInput = time;
    canvas.setPointerCapture(e.pointerId);
    if (soundOn) sfx.setEnabled(true);
  });
  canvas.addEventListener("pointerup", () => (mouse.down = false));
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      inv.select(inv.selected + Math.sign(e.deltaY));
    },
    { passive: false },
  );

  const controls = (): Controls => ({
    left: keys.has("KeyA") || keys.has("ArrowLeft"),
    right: keys.has("KeyD") || keys.has("ArrowRight"),
    jump: keys.has("Space") || keys.has("KeyW") || keys.has("ArrowUp"),
    down: keys.has("KeyS") || keys.has("ArrowDown"),
  });

  // Item use.
  let swingHit = false;
  let shake = 0;

  const target = () => {
    const tx = Math.floor(mouse.x / TILE);
    const ty = Math.floor(mouse.y / TILE);
    const c = player.center;
    const inReach = Math.hypot(tx * TILE + TILE / 2 - c.x, ty * TILE + TILE / 2 - c.y) <= tuning.reach * TILE;
    return { tx, ty, inReach: inReach && tx >= 0 && tx < COLS && ty >= 0 && ty < ROWS };
  };

  const breakAt = (tx: number, ty: number, id: number) => {
    const info = TILES[id as keyof typeof TILES];
    if (info.drop) drops.push(new Drop(info.drop, tx * TILE + 4, ty * TILE + 4));
    burst(particles, tx * TILE + 4, ty * TILE + 4, info.chip, 8);
    sfx.breakBlock(info.material);
    for (const [x, y] of world.unsupportedTorchesAround(tx, ty)) {
      world.set(x, y, Tile.Air);
      drops.push(new Drop("torch", x * TILE + 4, y * TILE + 4));
    }
  };

  const tryUse = () => {
    if (!mouse.down || !mouse.inside || player.using) return;
    const slot = inv.current;
    if (!slot) return;
    const def = ITEMS[slot.item];
    const { tx, ty, inReach } = target();

    if (def.use === "mine") {
      player.startUse(slot.item, tuning.pickUseTime, "swing", mouse.x);
      swingHit = false;
      if (!inReach) return;
      const result = world.hit(tx, ty, tuning.pickPower, time);
      if (!result) return;
      const info = TILES[result.id];
      sfx.dig(info.material);
      burst(particles, tx * TILE + 4, ty * TILE + 4, info.chip, 3, 40);
      if (result.broke) breakAt(tx, ty, result.id);
    } else if (def.use === "swing") {
      player.startUse(slot.item, tuning.swordUseTime, "swing", mouse.x);
      swingHit = false;
      sfx.swing();
    } else if (def.use === "place" && def.places !== undefined) {
      if (!inReach || world.fg(tx, ty) !== Tile.Air) return;
      const isTorch = def.places === Tile.Torch;
      if (isTorch ? !world.torchSupported(tx, ty) : !world.blockSupported(tx, ty)) return;
      const cell = { x: tx * TILE, y: ty * TILE, w: TILE, h: TILE };
      if (!isTorch && (rectsOverlap(cell, player.box) || rectsOverlap(cell, dummy.box))) return;
      world.set(tx, ty, def.places);
      inv.consume(inv.selected);
      sfx.place(TILES[def.places].material);
      player.startUse(slot.item, 0.14, "hold", mouse.x);
    }
  };

  /** Swinging tools can hit the dummy once per swing, anywhere along the blade. */
  const checkSwingHit = () => {
    if (!player.useItem || swingHit) return;
    const def = ITEMS[player.useItem];
    if (def.use === "place") return;
    const p = player.useProgress;
    if (p < 0.12 || p > 0.9) return;
    const { x: hx, y: hy } = player.hand;
    const a = player.swingAngle;
    const reach = def.use === "swing" ? 15 : 12;
    const box = dummy.box;
    for (let d = 4; d <= reach; d += 2) {
      const px = hx + Math.cos(a) * d;
      const py = hy + Math.sin(a) * d;
      if (px >= box.x - 2 && px <= box.x + box.w + 2 && py >= box.y - 2 && py <= box.y + box.h + 2) {
        swingHit = true;
        const crit = Math.random() < 0.08;
        const dmg = Math.round(def.damage * (0.85 + Math.random() * 0.3) * (crit ? 2 : 1));
        floaters.push(new Floater(String(dmg), dummy.x, box.y - 4, crit ? "#ffd84a" : "#ff9a5a"));
        dummy.hit(player.x > dummy.x);
        burst(particles, px, py, "#d9b56a", 5, 50);
        sfx.hit(crit);
        shake = crit ? 0.16 : 0.1;
        return;
      }
    }
  };

  const update = (dt: number) => {
    time += dt;
    const idle = time - lastInput > IDLE_BEFORE_WANDER;
    player.update(dt, idle ? player.wander(dt, world) : controls(), world, tuning);
    tryUse();
    checkSwingHit();
    dummy.update(dt);
    const pc = player.center;
    for (const d of drops) {
      d.update(dt, world, pc);
      if (d.taken) {
        if (inv.add(d.item)) sfx.pickup();
        else d.taken = false;
      }
    }
    drops = drops.filter((d) => !d.taken);
    for (const p of particles) p.update(dt);
    particles = particles.filter((p) => p.life > 0);
    for (const f of floaters) f.update(dt);
    floaters = floaters.filter((f) => !f.done);
    shake = Math.max(0, shake - dt);
    world.updateLight();
  };

  const clouds = [
    { x: 40, y: 22, w: 26 },
    { x: 170, y: 36, w: 34 },
    { x: 260, y: 16, w: 20 },
  ];

  const render = () => {
    ctx.save();
    if (shake > 0) ctx.translate(Math.round((Math.random() - 0.5) * 2), Math.round((Math.random() - 0.5) * 2));
    ctx.drawImage(backdrop, 0, 0);

    for (const cl of clouds) {
      const x = Math.round(((cl.x + time * 2.5) % (WIDTH + 60)) - 30);
      ctx.fillStyle = "#e9a07c";
      ctx.fillRect(x, cl.y, cl.w, 3);
      ctx.fillRect(x + 4, cl.y - 2, cl.w - 10, 2);
      ctx.fillStyle = "#c97a6a";
      ctx.fillRect(x + 2, cl.y + 3, cl.w - 4, 1);
    }

    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) drawWall(ctx, world.bg(x, y), x, y);
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        drawTile(ctx, world, x, y, time);
        const ratio = world.damageRatio(x, y, time);
        if (ratio > 0) drawCracks(ctx, x, y, ratio);
      }
    }

    dummy.draw(ctx);
    for (const d of drops) d.draw(ctx, time);
    player.draw(ctx);
    for (const p of particles) p.draw(ctx);

    // Soft lighting: the tile light map scaled up with smoothing.
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(world.lightCanvas, 0, 0, WIDTH, HEIGHT);
    ctx.imageSmoothingEnabled = false;

    // Warm glow around torches.
    ctx.globalCompositeOperation = "lighter";
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (world.fg(x, y) !== Tile.Torch) continue;
        const cx = x * TILE + 4;
        const cy = y * TILE + 2;
        const flicker = 0.85 + Math.sin(time * 9 + x) * 0.08 + Math.sin(time * 23 + y) * 0.05;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 26 * flicker);
        g.addColorStop(0, "rgba(255, 170, 80, 0.28)");
        g.addColorStop(1, "rgba(255, 120, 40, 0)");
        ctx.fillStyle = g;
        ctx.fillRect(cx - 30, cy - 30, 60, 60);
      }
    }
    ctx.globalCompositeOperation = "source-over";

    for (const f of floaters) f.draw(ctx);

    // Highlight the block under the cursor when the selected item can act on it.
    const slot = inv.current;
    if (mouse.inside && slot && ITEMS[slot.item].use !== "swing") {
      const { tx, ty, inReach } = target();
      if (inReach) {
        ctx.strokeStyle = "rgba(255, 240, 200, 0.7)";
        ctx.lineWidth = 1;
        ctx.strokeRect(tx * TILE + 0.5, ty * TILE + 0.5, TILE - 1, TILE - 1);
      }
    }
    ctx.restore();

    screen.imageSmoothingEnabled = false;
    screen.drawImage(buffer, 0, 0, canvas.width, canvas.height);
  };

  // Scale the frame to fit, using whole-pixel multiples when there's room.
  const resize = () => {
    const availW = document.documentElement.clientWidth - 32;
    const availH = window.innerHeight - 140;
    let s = Math.min(availW / WIDTH, availH / HEIGHT);
    if (s >= 2) s = Math.floor(s);
    s = Math.max(s, 0.5);
    const cssW = Math.round(WIDTH * s);
    const cssH = Math.round(HEIGHT * s);
    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    frame.style.setProperty("--px", `${s}px`);
    frame.style.width = `${cssW}px`;
  };
  resize();
  window.addEventListener("resize", resize);

  if (import.meta.env.DEV) {
    // Handle for poking at the lobby from the browser console while developing.
    (window as unknown as { lobby: unknown }).lobby = {
      get player() {
        return player;
      },
      get world() {
        return world;
      },
      get dummy() {
        return dummy;
      },
      inv,
      tuning,
      mouse,
      /** Run the simulation forward by hand (works even when the tab isn't animating). */
      advance(seconds: number) {
        for (let t = 0; t < seconds; t += STEP) update(STEP);
        render();
      },
    };
  }

  let last = performance.now();
  let acc = 0;
  const loop = (now: number) => {
    acc += Math.min(0.1, (now - last) / 1000);
    last = now;
    while (acc >= STEP) {
      update(STEP);
      acc -= STEP;
    }
    render();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
