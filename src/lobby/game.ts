import { COLS, HEIGHT, ROWS, TILE, WIDTH, loadTuning, type Tuning } from "./config";
import { mountContent } from "./content";
import { drawLight, drawSet } from "./draw";
import { Drop, Dummy, Floater, Particle, burst } from "./entities";
import { mountTuning } from "./hud";
import { Inventory } from "./inventory";
import { ITEMS } from "./items";
import { Overlay, SCALE } from "./overlay";
import { makeCanvas } from "./pixels";
import { Player, type Controls } from "./player";
import { SCENES, type ReelScene } from "./scenes";
import { Sfx } from "./sfx";
import { Tile, TILES } from "./tiles";
import { World } from "./world";
import { REELS, type Reel, type ReelId } from "../data";
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

/** What the living room controls about the reels. */
export interface Lobby {
  /** The reel that's loaded. */
  readonly reel: ReelId;
  /**
   * The reel as one picture: the scene with its interface drawn on top, SCALE times the game's
   * resolution. The room shows it on its screen.
   */
  readonly picture: HTMLCanvasElement;
  /** Jump straight to a reel, with no roll, the character at its start. */
  open(reel: ReelId): void;
  /** Run the game and take the keyboard and pointer, or pause it. */
  setActive(on: boolean): void;
  /** Pointer input, in game pixels (the room traces it through its screen). */
  pointer(kind: "move" | "down" | "up" | "leave", x?: number, y?: number): void;
  wheel(deltaY: number): void;
  /** The cursor to show over this point of the picture. */
  cursorAt(x: number, y: number): string;
  /** Without the room, show the picture on its own in this element and take the pointer from it. */
  mount(container: HTMLElement): void;
  /** Sound turned on or off elsewhere (the room's sound button). */
  setSound(on: boolean): void;
}

export interface LobbyOptions {
  /** Called when the reel's own sound button is pressed. */
  onSound?: (on: boolean) => void;
}

export function startLobby(opts: LobbyOptions = {}): Lobby | null {
  const layer = document.getElementById("reel-layer");
  const tuningPanel = document.getElementById("tuning");
  const soundButton = document.getElementById("lobby-sound");
  const prevButton = document.getElementById("door-prev");
  const nextButton = document.getElementById("door-next");
  if (!layer || !tuningPanel) return null;

  const tuning = loadTuning();
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  // Each reel's item panel points itself out until one of its items has been opened, like the program
  // on the table. Passing the pointer over it doesn't count. Remembered across visits.
  const READ_KEY = "movie-night:read-reels";
  const readReels = new Set<string>();
  try {
    for (const id of JSON.parse(localStorage.getItem(READ_KEY) ?? "[]")) readReels.add(String(id));
  } catch {
    // Nothing remembered: every panel points itself out.
  }
  const markRead = (id: string) => {
    if (readReels.has(id)) return;
    readReels.add(id);
    try {
      localStorage.setItem(READ_KEY, JSON.stringify([...readReels]));
    } catch {
      // Not remembered, still applies for this visit.
    }
  };
  const content = mountContent((key) => markRead(key.split("/")[0]));

  // The picture the room projects: the scene, scaled up with crisp pixels, and the interface drawn sharp on top.
  const { c: picture, ctx: pctx } = makeCanvas(WIDTH * SCALE, HEIGHT * SCALE);
  picture.className = "reel-picture";

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

  let here = stateFor(REELS.find((r) => r.id === layer.dataset.reel) ?? reelAt(location.pathname) ?? REELS[0]);
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
  const overlay = new Overlay(inv);
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
    opts.onSound?.(soundOn);
  });

  // The room shares the screen: the game only runs, and only takes keys and the pointer, while a reel is up.
  let active = false;

  // Input.
  const keys = new Set<string>();
  const mouse = { x: -100, y: -100, down: false, inside: false };
  let lastInput = -Infinity;
  let time = 0;
  const GAME_KEYS = new Set(["KeyA", "KeyD", "KeyW", "KeyS", "Space", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]);

  window.addEventListener("keydown", (e) => {
    // Item cards are dialogs; the game ignores keys while one is open.
    if (!active || e.target instanceof HTMLInputElement || document.querySelector("dialog[open]")) return;
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

  // Pointer input arrives in game pixels: traced through the room's screen, or from the picture on its own.
  const pointer: Lobby["pointer"] = (kind, x = -100, y = -100) => {
    if (!active) return;
    if (kind === "leave") {
      mouse.inside = false;
      mouse.down = false;
      overlay.hover = null;
      return;
    }
    mouse.x = x;
    mouse.y = y;
    mouse.inside = true;
    overlay.hover = overlay.at(x, y);
    if (kind === "down") {
      lastInput = time;
      if (soundOn) sfx.setEnabled(true);
      const hit = overlay.at(x, y);
      if (hit?.kind === "slot") inv.select(hit.index);
      else if (hit?.kind === "item") content?.open(hit.key);
      // A click on the interface isn't a click in the world.
      else if (!overlay.covers(x, y)) mouse.down = true;
    } else if (kind === "up") {
      mouse.down = false;
    }
  };
  const wheel = (deltaY: number) => {
    if (active) inv.select(inv.selected + Math.sign(deltaY));
  };

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
    if (active) document.title = `${reel.title} · ${person.name}`;
    picture.setAttribute("aria-label", `Reel ${reel.number}, ${reel.title}. ${scene.alt}`);
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

  const showTitle = () => overlay.showTitle(here.reel, time);

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

  // Back and forward between reels. Leaving the reels for the room is the room's to handle.
  window.addEventListener("popstate", () => {
    const reel = reelAt(location.pathname);
    if (!active || !reel || reel.id === here.reel.id) return;
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
    if (mouse.inside && !overlay.covers(mouse.x, mouse.y) && slot && ITEMS[slot.item].use !== "swing") {
      const { tx, ty, inReach } = target();
      if (inReach) {
        ctx.strokeStyle = "rgba(255, 240, 200, 0.7)";
        ctx.lineWidth = 1;
        ctx.strokeRect(tx * TILE + 0.5, ty * TILE + 0.5, TILE - 1, TILE - 1);
      }
    }
    ctx.restore();

    pctx.imageSmoothingEnabled = false;
    pctx.drawImage(transition ? rollFilm(transition.t / ROLL_TIME, transition.dir) : buffer, 0, 0, picture.width, picture.height);
    overlay.draw(pctx, here.reel, time, !readReels.has(here.reel.id));
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

  // Without the room, the picture is shown on its own, fitted to the window.
  let mounted = false;
  const resize = () => {
    if (!mounted) return;
    const w = Math.min(document.documentElement.clientWidth - 32, ((window.innerHeight - 100) * WIDTH) / HEIGHT);
    picture.style.width = `${Math.max(240, Math.round(w))}px`;
  };
  window.addEventListener("resize", resize);
  renderReel();

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

  let raf = 0;
  let last = 0;
  let acc = 0;
  const loop = (now: number) => {
    acc += Math.min(0.1, (now - last) / 1000);
    last = now;
    while (acc >= STEP) {
      update(STEP);
      acc -= STEP;
    }
    render();
    raf = requestAnimationFrame(loop);
  };

  return {
    get reel() {
      return here.reel.id;
    },
    open(id) {
      const reel = REELS.find((r) => r.id === id);
      if (!reel) return;
      here = stateFor(reel);
      ({ world, dummy, scene } = here);
      player = new Player(scene.spawn.x, scene.spawn.y);
      auto = null;
      transition = null;
      drops = [];
      particles = [];
      floaters = [];
      shake = 0;
      lastInput = time;
      renderReel();
      render();
    },
    setActive(on) {
      if (on === active) return;
      active = on;
      if (on) {
        renderReel();
        showTitle();
        last = performance.now();
        raf = requestAnimationFrame(loop);
      } else {
        cancelAnimationFrame(raf);
        keys.clear();
        mouse.down = false;
      }
    },
    get picture() {
      return picture;
    },
    pointer,
    wheel,
    cursorAt(x, y) {
      return overlay.at(x, y) ? "pointer" : overlay.covers(x, y) ? "default" : "crosshair";
    },
    mount(container) {
      if (mounted) return;
      mounted = true;
      container.append(picture);
      resize();
      const toGame = (e: PointerEvent | MouseEvent) => {
        const r = picture.getBoundingClientRect();
        return [((e.clientX - r.left) / r.width) * WIDTH, ((e.clientY - r.top) / r.height) * HEIGHT] as const;
      };
      picture.addEventListener("pointermove", (e) => {
        const [x, y] = toGame(e);
        pointer("move", x, y);
        picture.style.cursor = this.cursorAt(x, y);
      });
      picture.addEventListener("pointerdown", (e) => {
        picture.setPointerCapture(e.pointerId);
        pointer("down", ...toGame(e));
      });
      picture.addEventListener("pointerup", (e) => pointer("up", ...toGame(e)));
      picture.addEventListener("pointerleave", () => pointer("leave"));
      picture.addEventListener("contextmenu", (e) => e.preventDefault());
      picture.addEventListener(
        "wheel",
        (e) => {
          e.preventDefault();
          wheel(e.deltaY);
        },
        { passive: false },
      );
    },
    setSound(on) {
      soundOn = on;
      sfx.setEnabled(on);
      renderSound();
    },
  };
}
