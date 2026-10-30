import { COLS, HEIGHT, ROWS, TILE, WIDTH, loadTuning, type Tuning } from "./config";
import { mountContent } from "./content";
import { drawLight, drawSet } from "./draw";
import { Drop, Dummy, Floater, Particle, burst } from "./entities";
import { startGrain } from "./grain";
import { mountHotbar, mountTuning } from "./hud";
import { Inventory } from "./inventory";
import { ITEMS } from "./items";
import { makeCanvas } from "./pixels";
import { Player, type Controls } from "./player";
import { SCENES, type ReelScene } from "./scenes";
import { Sfx } from "./sfx";
import { Tile, TILES } from "./tiles";
import { World } from "./world";
import { REELS, type Reel } from "../data";
import { person } from "../data/profile";

const STEP = 1 / 120;
const IDLE_BEFORE_WANDER = 6; // seconds without input before the character wanders on its own
const SOUND_KEY = "movie-night:sound";
const ROLL_TIME = 0.45; // seconds for the film to roll from one frame to the next
const FRAME_LINE = 12; // the black bar between two frames during the roll, in pixels
const SPRINT = 2.4; // how much faster the character runs when a door button sends it
const GIVE_UP = 2.4; // seconds of walking toward a door before cutting anyway

/** Each reel keeps its own world for the visit, so mined blocks stay mined. */
interface ReelState {
  reel: Reel;
  scene: ReelScene;
  world: World;
  dummy: Dummy | null;
  backdrop: HTMLCanvasElement;
}

/** The character walking on its own: out through a door after a door button, or in through one after a cut. */
interface AutoWalk {
  kind: "leave" | "enter";
  x: number;
  dir: 1 | -1;
  elapsed: number;
  stuck: number;
  lastX: number;
}

const reelAt = (path: string) => REELS.find((r) => r.path === path.replace(/\/+$/, ""));

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
  const soundButton = document.getElementById("lobby-sound");
  const stage = document.getElementById("stage");
  const prevButton = document.getElementById("door-prev");
  const nextButton = document.getElementById("door-next");
  const titleCard = document.getElementById("reel-title");
  if (!canvas || !frame || !stage || !hotbar || !tooltip || !label || !tuningPanel) return;
  const screen = canvas.getContext("2d");
  if (!screen) return;

  const tuning = loadTuning();
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  mountContent();
  const grain = document.getElementById("reel-grain");
  if (grain instanceof HTMLCanvasElement) startGrain(grain, reduceMotion.matches);

  const states = new Map<Reel["id"], ReelState>();
  const stateFor = (reel: Reel) => {
    let state = states.get(reel.id);
    if (!state) {
      const scene = SCENES[reel.id];
      const dummy = scene.dummyAt ? new Dummy(scene.dummyAt.x, scene.dummyAt.y) : null;
      state = { reel, scene, world: new World(scene), dummy, backdrop: scene.paintBackdrop() };
      states.set(reel.id, state);
    }
    return state;
  };

  let here = stateFor(REELS.find((r) => r.id === stage.dataset.reel) ?? reelAt(location.pathname) ?? REELS[0]);
  let { world, dummy, scene } = here;
  let player = new Player(scene.spawn.x, scene.spawn.y);
  let drops: Drop[] = [];
  let particles: Particle[] = [];
  let floaters: Floater[] = [];
  let auto: AutoWalk | null = null;
  let transition: { t: number; dir: 1 | -1 } | null = null;
  const { c: buffer, ctx } = makeCanvas(WIDTH, HEIGHT);
  const { c: fromFrame, ctx: fromCtx } = makeCanvas(WIDTH, HEIGHT);
  const { c: rollFrame, ctx: rollCtx } = makeCanvas(WIDTH, HEIGHT);

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
    states.delete(here.reel.id);
    here = stateFor(here.reel);
    ({ world, dummy, scene } = here);
    player = new Player(scene.spawn.x, scene.spawn.y);
    auto = null;
    drops = [];
    particles = [];
    floaters = [];
    stockInventory();
  };
  // The tuning panel is for development only: press ` to show it.
  if (import.meta.env.DEV) mountTuning(tuningPanel, tuning, resetScene);
  const toggleTuning = () => {
    if (import.meta.env.DEV) tuningPanel.hidden = !tuningPanel.hidden;
  };

  // Sound shares the preference with the living room.
  const sfx = new Sfx();
  let soundOn = false;
  try {
    soundOn = localStorage.getItem(SOUND_KEY) === "on";
  } catch {
    // Sound stays off.
  }
  const renderSound = () => soundButton?.setAttribute("aria-pressed", String(soundOn));
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
    // Item cards and the program are dialogs; the game ignores keys while one is open.
    if (e.target instanceof HTMLInputElement || document.querySelector("dialog[open]")) return;
    // Space and Enter press a button that has keyboard focus instead of jumping.
    const focused = e.target instanceof HTMLElement && e.target.matches("button:focus-visible, a:focus-visible");
    if (focused && (e.code === "Space" || e.code === "Enter")) return;
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
      // Taking control stops a run to the door. The walk in through a door always finishes,
      // so a held key can't leave the character standing in the doorway it came through.
      if (auto?.kind === "leave") auto = null;
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
      if (!isTorch && (rectsOverlap(cell, player.box) || (dummy && rectsOverlap(cell, dummy.box)))) return;
      world.set(tx, ty, def.places);
      inv.consume(inv.selected);
      sfx.place(TILES[def.places].material);
      player.startUse(slot.item, 0.14, "hold", mouse.x);
    }
  };

  /** Swinging tools can hit the dummy once per swing, anywhere along the blade. */
  const checkSwingHit = () => {
    if (!player.useItem || swingHit || !dummy) return;
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

  // Reels.
  const neighbor = (dir: 1 | -1): Reel | undefined => REELS[REELS.indexOf(here.reel) + dir];
  const panels = document.querySelectorAll<HTMLElement>("[data-reel-panel]");

  const renderReel = () => {
    const { reel } = here;
    document.title = `${reel.title} · ${person.name}`;
    // The × ends the film on whichever reel is playing.
    document.getElementById("end-film")?.setAttribute("href", `/?end=${reel.id}`);
    canvas.setAttribute("aria-label", `Reel ${reel.number}, ${reel.title}. ${scene.alt}`);
    for (const panel of panels) panel.hidden = panel.dataset.reelPanel !== reel.id;
    for (const [button, target] of [
      [prevButton, neighbor(-1)],
      [nextButton, neighbor(1)],
    ] as const) {
      if (!button) continue;
      button.hidden = !target;
      const text = button.querySelector("[data-label]");
      if (text && target) text.textContent = `Reel ${target.number} · ${target.title}`;
    }
  };

  const showTitle = () => {
    if (!titleCard) return;
    const number = titleCard.querySelector("[data-number]");
    const name = titleCard.querySelector("[data-name]");
    if (number) number.textContent = `Reel ${here.reel.number}`;
    if (name) name.textContent = here.reel.title;
    titleCard.classList.remove("show");
    void titleCard.offsetWidth; // restart the animation
    titleCard.classList.add("show");
  };

  /** Cut to another reel. The character comes in through the door on the side it left from. */
  const go = (reel: Reel, dir: 1 | -1, push = true) => {
    if (reel.id === here.reel.id) return;
    fromCtx.drawImage(buffer, 0, 0);
    here = stateFor(reel);
    ({ world, dummy, scene } = here);
    const door = dir === 1 ? scene.exits.left : scene.exits.right;
    const speed = Math.min(Math.abs(player.vx), tuning.runSpeed);
    if (door !== undefined) {
      player = new Player(dir === 1 ? -8 : WIDTH + 8, door * TILE);
      player.facing = dir;
      player.vx = dir * speed; // keep walking at the speed it left at
      const x = dir === 1 ? 3 * TILE : WIDTH - 3 * TILE;
      auto = { kind: "enter", x, dir, elapsed: 0, stuck: 0, lastX: player.x };
    } else {
      player = new Player(scene.spawn.x, scene.spawn.y);
      auto = null;
    }
    drops = [];
    particles = [];
    floaters = [];
    shake = 0;
    lastInput = time;
    if (push) history.pushState({ reel: reel.id }, "", reel.path);
    renderReel();
    sfx.roll();
    if (reduceMotion.matches) {
      transition = null;
      showTitle();
    } else {
      transition = { t: 0, dir };
    }
  };

  /** A door button: the character runs out through that side's door, then the film cuts. */
  let sprint: Tuning = tuning;
  const leave = (dir: 1 | -1) => {
    const target = neighbor(dir);
    if (!target) return;
    const door = dir === 1 ? scene.exits.right : scene.exits.left;
    // Pressing it again while the character is on its way cuts right away.
    const again = auto?.kind === "leave" && auto.dir === dir;
    if (reduceMotion.matches || door === undefined || again || transition) {
      auto = null;
      go(target, dir);
      return;
    }
    sprint = { ...tuning, runSpeed: tuning.runSpeed * SPRINT, accel: tuning.accel * 2 };
    auto = { kind: "leave", x: dir === 1 ? WIDTH + 16 : -16, dir, elapsed: 0, stuck: 0, lastX: player.x };
    lastInput = time;
  };
  prevButton?.addEventListener("click", () => leave(-1));
  nextButton?.addEventListener("click", () => leave(1));

  window.addEventListener("popstate", () => {
    const reel = reelAt(location.pathname);
    if (!reel || reel.id === here.reel.id) return;
    auto = null;
    go(reel, REELS.indexOf(reel) > REELS.indexOf(here.reel) ? 1 : -1, false);
  });

  const update = (dt: number) => {
    if (transition) {
      // The world holds still while the film rolls.
      transition.t += dt;
      if (transition.t >= ROLL_TIME) {
        transition = null;
        showTitle();
      }
      return;
    }
    time += dt;

    let input: Controls;
    let feel = tuning;
    if (auto) {
      auto.elapsed += dt;
      auto.stuck = Math.abs(player.x - auto.lastX) < 0.3 ? auto.stuck + dt : 0;
      auto.lastX = player.x;
      if (auto.kind === "leave") {
        // Blocked (say, by placed blocks) or taking too long: cut anyway.
        if (auto.elapsed > GIVE_UP || auto.stuck > 0.5) {
          const { dir } = auto;
          auto = null;
          const target = neighbor(dir);
          if (target) go(target, dir);
          return;
        }
        feel = sprint;
      } else if (Math.abs(auto.x - player.x) < 4 || auto.elapsed > 1.5) {
        auto = null;
      }
    }
    if (auto) input = player.steer(auto.x, world);
    else input = time - lastInput > IDLE_BEFORE_WANDER ? player.wander(dt, world) : controls();
    player.update(dt, input, world, feel);

    // Walking out through a door: past the edge and still heading out.
    if (auto?.kind !== "enter") {
      const dir = player.x > WIDTH + 4 && player.vx > 0 ? 1 : player.x < -4 && player.vx < 0 ? -1 : 0;
      const target = dir ? neighbor(dir) : undefined;
      if (dir && target) {
        auto = null;
        go(target, dir);
        return;
      }
    }

    tryUse();
    checkSwingHit();
    dummy?.update(dt);
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

  const render = () => {
    ctx.save();
    if (shake > 0) ctx.translate(Math.round((Math.random() - 0.5) * 2), Math.round((Math.random() - 0.5) * 2));
    drawSet(ctx, world, scene, here.backdrop, time);

    dummy?.draw(ctx);
    for (const d of drops) d.draw(ctx, time);
    player.draw(ctx);
    for (const p of particles) p.draw(ctx);

    drawLight(ctx, world, scene, time);

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
    screen.drawImage(transition ? rollFilm(transition.t / ROLL_TIME, transition.dir) : buffer, 0, 0, canvas.width, canvas.height);
  };

  /**
   * The frame roll: the old frame slides off, the black frame line passes
   * through, and the new frame slides into place, like film slipping in the gate.
   */
  const rollFilm = (p: number, dir: 1 | -1) => {
    const eased = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
    const travel = HEIGHT + FRAME_LINE;
    const o = Math.round(eased * travel) * dir;
    rollCtx.fillStyle = "#000";
    rollCtx.fillRect(0, 0, WIDTH, HEIGHT);
    rollCtx.drawImage(fromFrame, 0, -o);
    rollCtx.drawImage(buffer, 0, dir === 1 ? travel - o : -travel - o);
    rollCtx.fillStyle = `rgba(255, 236, 200, ${Math.random() * 0.08})`;
    rollCtx.fillRect(0, 0, WIDTH, HEIGHT);
    return rollFrame;
  };

  // Scale the frame to fit, using whole-pixel multiples when there's room.
  const resize = () => {
    const availW = document.documentElement.clientWidth - 32;
    const availH = window.innerHeight - 100;
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
    stage.style.setProperty("--px", `${s}px`);
    stage.style.width = `${cssW}px`;
  };
  resize();
  window.addEventListener("resize", resize);
  renderReel();
  showTitle();

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
      get reel() {
        return here.reel.id;
      },
      get auto() {
        return auto;
      },
      get transition() {
        return transition;
      },
      leave,
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
