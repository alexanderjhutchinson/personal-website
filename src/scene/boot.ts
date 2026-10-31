import { REELS, type Reel } from "../data";
import { person } from "../data/profile";
import { startLobby } from "../lobby/game";
import type { RegionAction } from "./programPages";
import type { Mode, Theater } from "./theater";

// Connects the 3D room to the page: buttons, keyboard, sound preference,
// first-visit tracking, the program (picked up and turned), and the reels,
// which play on the room's screen. The whole site is this one page; each
// address opens it in a different state.

const SEEN_KEY = "movie-night:seen-intro";
const SOUND_KEY = "movie-night:sound";
const PROGRAM_KEY = "movie-night:read-program";

function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable (private windows, blocked site data). Nothing depends on it.
  }
}

/** "flat" is the page without the 3D room: the program on its own, or a reel on its own. */
type PageMode = "room" | "program" | "playing" | "entering" | "reel" | "ending" | "flat";

const pageMode: Record<Mode, PageMode> = {
  idle: "room",
  program: "program",
  playing: "playing",
  entering: "entering",
  reel: "reel",
  ending: "ending",
};

const reelAt = (path: string) => REELS.find((r) => r.path === path.replace(/\/+$/, ""));

export function boot() {
  const root = document.documentElement;
  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null;
  const stage = $("stage");
  const canvas = $<HTMLCanvasElement>("scene");
  const soundButton = $<HTMLButtonElement>("sound-toggle");
  const readLink = $<HTMLAnchorElement>("read-program");
  const endButton = $<HTMLAnchorElement>("end-film");
  const pickup = $("pickup");
  const viewName = document.querySelector("[data-view-name]");
  const turnButtons = document.querySelectorAll<HTMLButtonElement>("[data-turn]");
  if (!stage || !canvas) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const openProgram = stage.dataset.open === "program";
  /** The page opened on a reel's address. */
  const openedOn = reelAt(location.pathname);
  const setPageMode = (mode: PageMode) => {
    root.dataset.mode = mode;
  };

  let theater: Theater | null = null;
  let loading: Promise<Theater | null> | null = null;
  /** The reel the film opens on, and whether going in adds it to the browser history. */
  let feature: Reel = REELS[0];
  let pushFeature = true;

  // Sound preference, shared by the room and the reels.
  let soundOn = read(SOUND_KEY) === "on";
  const renderSound = () => {
    if (!soundButton) return;
    soundButton.setAttribute("aria-pressed", String(soundOn));
    const label = soundButton.querySelector("[data-label]");
    if (label) label.textContent = soundOn ? "Sound on" : "Sound off";
  };
  const setSound = (on: boolean) => {
    soundOn = on;
    write(SOUND_KEY, on ? "on" : "off");
    renderSound();
    theater?.sound.setEnabled(on);
  };
  renderSound();

  // The reels: the game draws one picture, which plays on the room's screen in 3D (or on its own, without the room).
  const lobby = startLobby({ onSound: setSound });
  const reelScreen = $("reel-screen");

  soundButton?.addEventListener("click", () => {
    setSound(!soundOn);
    lobby?.setSound(soundOn);
  });

  const fallBack = (err: unknown) => {
    console.warn("The 3D room couldn't start, showing the page without it.", err);
    setPageMode("flat");
    root.dataset.scene = "unavailable";
    if (openedOn && reelScreen) lobby?.mount(reelScreen);
  };

  const load = () => {
    if (loading) return loading;
    root.dataset.loading = "true";
    loading = import("./theater")
      .then(async ({ Theater }) => {
        const t = new Theater(canvas, {
          reducedMotion,
          seenIntro: () => read(SEEN_KEY) === "1",
          onMode: (mode) => onMode(mode),
          onHover: (target) => {
            root.dataset.hover = target ?? "";
            updatePrompt();
          },
          onProgramPage: (name, first, last) => renderView(name, first, last),
          onFrame: () => placePrompt(),
        });
        await t.init();
        if (import.meta.env.DEV) (window as unknown as { theater: Theater }).theater = t;
        t.sound.setEnabled(soundOn);
        if (lobby) t.setPicture(lobby.picture);
        theater = t;
        delete root.dataset.loading;
        if (openedOn) t.enterReel(openedOn.id);
        else if (openProgram) pickUp();
        // Give the room a moment to fade in before pointing at the program.
        else window.setTimeout(updatePrompt, reducedMotion ? 0 : 1200);
        return t;
      })
      .catch((err) => {
        fallBack(err);
        return null;
      });
    return loading;
  };

  const onMode = (mode: Mode) => {
    setPageMode(pageMode[mode]);
    // The address follows the program, so a reload or a shared link opens it again.
    if (mode === "program" && location.pathname !== "/program") history.replaceState(null, "", "/program");
    if (mode === "idle" && location.pathname === "/program") history.replaceState(null, "", "/");
    if (mode === "entering") {
      // The camera has reached the screen: the reel fades in over it.
      write(SEEN_KEY, "1");
      if (pushFeature && location.pathname !== feature.path) history.pushState(null, "", feature.path);
      lobby?.setActive(true);
    }
    if (mode === "reel" && lobby) theater?.showReel(lobby.reel);
    updatePrompt();
  };

  // The program.
  const pickUp = () => {
    if (!theater || theater.mode !== "idle") return;
    write(PROGRAM_KEY, "1");
    theater.pickUp();
  };

  const putDown = () => void theater?.putDown();

  /** Start the film; it opens on this reel. */
  const startFeature = async (reel: Reel, push = true) => {
    feature = reel;
    pushFeature = push;
    if (!theater || !lobby) {
      location.assign(reel.path);
      return;
    }
    await theater.putDown();
    lobby.open(reel.id);
    theater.start();
  };

  /** End the film: the reel gives way to the same picture on the room's screen, and the camera pulls back. */
  const endFeature = (push = true) => {
    if (!theater || (theater.mode !== "reel" && theater.mode !== "entering") || !lobby) return;
    lobby.setActive(false);
    if (push) history.pushState(null, "", "/");
    document.title = person.name;
    canvas.style.cursor = "";
    theater.end();
  };

  const follow = (action: RegionAction) => {
    if ("reel" in action) {
      const reel = REELS.find((r) => r.id === action.reel);
      if (reel) void startFeature(reel);
    } else if (action.href.startsWith("http")) {
      window.open(action.href, "_blank", "noopener");
    } else {
      location.href = action.href;
    }
  };

  const renderView = (name: string, first: boolean, last: boolean) => {
    if (viewName) viewName.textContent = name;
    turnButtons.forEach((b) => (b.disabled = Number(b.dataset.turn) < 0 ? first : last));
  };
  renderView("Cover", true, false);

  // The pick-up prompt: points at the program on the table until it's been picked up once, then only on hover.
  const updatePrompt = () => {
    if (!pickup) return;
    const idle = !!theater && theater.mode === "idle" && !root.dataset.loading;
    const fresh = read(PROGRAM_KEY) !== "1";
    pickup.hidden = !(idle && (fresh || root.dataset.hover === "program"));
    theater?.setGlint(idle && fresh);
    placePrompt();
  };
  const placePrompt = () => {
    if (!pickup || pickup.hidden || !theater) return;
    const at = theater.programAnchor();
    pickup.style.visibility = at ? "" : "hidden";
    if (at) pickup.style.transform = `translate(${Math.round(at.x)}px, ${Math.round(at.y)}px)`;
  };

  // Pointer.
  canvas.addEventListener("click", (e) => {
    if (!theater) return;
    const { clientX: x, clientY: y } = e;
    if (theater.mode === "playing") theater.skip();
    else if (theater.mode === "idle") {
      if (theater.hitsProgram(x, y)) pickUp();
      else if (theater.hitsProjector(x, y)) void startFeature(REELS[0]);
    } else if (theater.mode === "program") {
      const hit = theater.programHit(x, y);
      if (!hit) putDown();
      else if (hit.action) follow(hit.action);
      else theater.turn(hit.side);
    }
  });

  // While a reel plays, the pointer goes through the room's screen into the game.
  const onScreen = (e: MouseEvent) => (theater?.mode === "reel" ? theater.pictureAt(e.clientX, e.clientY) : null);
  canvas.addEventListener("pointermove", (e) => {
    if (theater?.mode !== "reel" || !lobby) return;
    const at = onScreen(e);
    if (at) lobby.pointer("move", at.x, at.y);
    else lobby.pointer("leave");
    canvas.style.cursor = at ? lobby.cursorAt(at.x, at.y) : "";
  });
  canvas.addEventListener("pointerdown", (e) => {
    const at = onScreen(e);
    if (!at || !lobby) return;
    canvas.setPointerCapture(e.pointerId);
    lobby.pointer("down", at.x, at.y);
  });
  canvas.addEventListener("pointerup", (e) => {
    if (theater?.mode !== "reel" || !lobby) return;
    const at = onScreen(e);
    lobby.pointer("up", at?.x, at?.y);
  });
  canvas.addEventListener("pointerleave", () => lobby?.pointer("leave"));
  canvas.addEventListener(
    "wheel",
    (e) => {
      if (!onScreen(e)) return;
      e.preventDefault();
      lobby?.wheel(e.deltaY);
    },
    { passive: false },
  );
  canvas.addEventListener("contextmenu", (e) => {
    if (theater?.mode === "reel") e.preventDefault();
  });

  readLink?.addEventListener("click", (e) => {
    if (!theater || (theater.mode !== "idle" && theater.mode !== "program")) return;
    e.preventDefault();
    pickUp();
  });

  endButton?.addEventListener("click", (e) => {
    if (!theater) return;
    e.preventDefault();
    endFeature();
  });

  // On a screen too narrow for the room, the program as a plain page.
  document.querySelectorAll("[data-plain]").forEach((b) =>
    b.addEventListener("click", () => {
      root.dataset.plain = "";
      $("program-view")?.scrollTo(0, 0);
    }),
  );
  document.querySelectorAll("[data-plain-close]").forEach((b) => b.addEventListener("click", () => delete root.dataset.plain));

  turnButtons.forEach((b) => b.addEventListener("click", () => theater?.turn(Number(b.dataset.turn) < 0 ? -1 : 1)));
  document.querySelectorAll("[data-put-down]").forEach((b) => b.addEventListener("click", putDown));

  // Keyboard. While a reel plays, the keys are the game's.
  /**
   * Escape always backs out of whatever is on top, one layer at a time: an item card (which closes
   * itself), the plain program, the tuning panel, then the film (back to the couch), the opening
   * (stopped), or the program in hand (put down).
   */
  const escape = () => {
    if (document.querySelector("dialog[open]")) return;
    const tuning = $("tuning");
    if (root.hasAttribute("data-plain")) delete root.dataset.plain;
    else if (tuning && !tuning.hidden) tuning.hidden = true;
    else if (!theater) {
      // Without the room, a reel's address is its own page: back out to the program.
      if (openedOn && root.dataset.mode === "flat") location.assign("/");
    } else if (theater.mode === "reel" || theater.mode === "entering") endFeature();
    else if (theater.mode === "playing") theater.abort();
    else if (theater.mode === "program") putDown();
  };

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      escape();
      return;
    }
    if (!theater || e.metaKey || e.ctrlKey || e.altKey) return;
    const onControl = e.target instanceof Element && !!e.target.closest("button, a, input, textarea, select");
    const key = e.key.toLowerCase();
    switch (theater.mode) {
      case "playing":
        e.preventDefault();
        theater.skip();
        break;
      case "idle":
        if (key === "e") {
          e.preventDefault();
          pickUp();
        } else if (!onControl && (key === "enter" || key === " ")) {
          e.preventDefault();
          void startFeature(REELS[0]);
        }
        break;
      case "program":
        if (key === "e") putDown();
        else if (key === "arrowleft" || key === "a") theater.turn(-1);
        else if (key === "arrowright" || key === "d") theater.turn(1);
        else return;
        e.preventDefault();
        break;
    }
  });

  // Back and forward between the room and the reels (the game handles reel to reel).
  window.addEventListener("popstate", () => {
    if (!theater) return;
    const reel = reelAt(location.pathname);
    if (reel && (theater.mode === "idle" || theater.mode === "program")) void startFeature(reel, false);
    else if (!reel && theater.mode === "reel") endFeature(false);
  });

  // Opened on a reel: it starts straight away, and shows on the screen as soon as the room is up.
  if (openedOn && lobby) {
    lobby.open(openedOn.id);
    if (root.dataset.mode === "room") setPageMode("reel");
    else if (reelScreen) lobby.mount(reelScreen);
    lobby.setActive(true);
  }

  if (root.dataset.mode !== "flat") void load();
}
