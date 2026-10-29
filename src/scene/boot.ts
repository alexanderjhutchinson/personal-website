import type { Mode, Theater } from "./theater";

// Connects the 3D scene to the page: buttons, keyboard, sound preference,
// first-visit tracking, and the crossfade between the room and the resume.

const SEEN_KEY = "movie-night:seen-intro";
const SOUND_KEY = "movie-night:sound";

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

type PageMode = "room" | "playing" | "entering" | "entered" | "ending";

const pageMode: Record<Mode, PageMode> = {
  idle: "room",
  playing: "playing",
  entering: "entering",
  entered: "entered",
  ending: "ending",
};

export function boot() {
  const root = document.documentElement;
  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null;
  const canvas = $<HTMLCanvasElement>("scene");
  const startButton = $<HTMLButtonElement>("start-film");
  const soundButton = $<HTMLButtonElement>("sound-toggle");
  const skipLink = $<HTMLAnchorElement>("skip-to-resume");
  const credits = $("credits");
  const resume = $("resume");
  const endButtons = document.querySelectorAll<HTMLButtonElement>("[data-end-film]");
  const replayButton = $<HTMLButtonElement>("play-again");
  const creditsResume = $<HTMLButtonElement>("credits-resume");
  if (!canvas || !resume) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const setPageMode = (mode: PageMode) => {
    root.dataset.mode = mode;
  };

  let theater: Theater | null = null;
  let loading: Promise<Theater | null> | null = null;

  const fallBackToResume = (err: unknown) => {
    console.warn("The 3D room couldn't start, showing the resume instead.", err);
    setPageMode("entered");
    root.dataset.scene = "unavailable";
  };

  const load = () => {
    if (loading) return loading;
    root.dataset.loading = "true";
    loading = import("./theater")
      .then(async ({ Theater }) => {
        const t = new Theater(canvas, {
          reducedMotion,
          seenIntro: () => read(SEEN_KEY) === "1",
          onMode: (mode, detail) => onMode(mode, detail),
          onHover: (on) => {
            root.dataset.hover = on ? "projector" : "";
          },
        });
        await t.init();
        if (import.meta.env.DEV) (window as unknown as { theater: Theater }).theater = t;
        t.sound.setEnabled(soundOn);
        theater = t;
        delete root.dataset.loading;
        return t;
      })
      .catch((err) => {
        fallBackToResume(err);
        return null;
      });
    return loading;
  };

  const onMode = (mode: Mode, detail: { afterEnding?: boolean }) => {
    setPageMode(pageMode[mode]);
    if (mode === "entered") {
      write(SEEN_KEY, "1");
      history.replaceState(null, "", "#resume");
      window.scrollTo(0, 0);
      resume.focus({ preventScroll: true });
      startGrain();
    } else {
      stopGrain();
    }
    if (mode === "idle") {
      if (location.hash) history.replaceState(null, "", location.pathname + location.search);
      if (detail.afterEnding && credits) {
        credits.hidden = false;
        root.dataset.credits = "open";
        replayButton?.focus();
      } else {
        startButton?.focus({ preventScroll: true });
      }
    } else if (credits) {
      credits.hidden = true;
      delete root.dataset.credits;
    }
  };

  // Sound preference.
  let soundOn = read(SOUND_KEY) === "on";
  const renderSound = () => {
    if (!soundButton) return;
    soundButton.setAttribute("aria-pressed", String(soundOn));
    const label = soundButton.querySelector("[data-label]");
    if (label) label.textContent = soundOn ? "Sound on" : "Sound off";
  };
  renderSound();
  soundButton?.addEventListener("click", () => {
    soundOn = !soundOn;
    write(SOUND_KEY, soundOn ? "on" : "off");
    renderSound();
    theater?.sound.setEnabled(soundOn);
  });

  const start = () => theater?.start();

  startButton?.addEventListener("click", start);
  replayButton?.addEventListener("click", start);
  creditsResume?.addEventListener("click", () => theater?.enterQuick());

  canvas.addEventListener("click", (e) => {
    if (!theater) return;
    if (theater.mode === "playing") theater.skip();
    else if (theater.mode === "idle" && theater.hitsProjector(e.clientX, e.clientY)) theater.start();
  });

  skipLink?.addEventListener("click", (e) => {
    if (!theater || root.dataset.mode === "entered") return;
    e.preventDefault();
    theater.enterQuick();
  });

  endButtons.forEach((button) =>
    button.addEventListener("click", async () => {
      const t = theater ?? (await load());
      if (!t) return;
      if (t.mode === "idle" && root.dataset.mode === "entered") t.assumeEntered();
      t.end();
    }),
  );

  document.addEventListener("keydown", (e) => {
    if (!theater) return;
    const target = e.target as HTMLElement | null;
    const onControl = !!target?.closest("button, a, input, textarea, select");
    if (theater.mode === "playing" && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      theater.skip();
    } else if (theater.mode === "idle" && !onControl && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      theater.start();
    }
  });

  // Faint grain over the resume, like light from a projector.
  const grain = $<HTMLCanvasElement>("grain");
  let grainTimer = 0;
  const startGrain = () => {
    if (!grain || reducedMotion || grainTimer) return;
    const ctx = grain.getContext("2d");
    if (!ctx) return;
    grain.width = grain.height = 160;
    const img = ctx.createImageData(160, 160);
    const draw = () => {
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.random() * 255;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
    };
    draw();
    grainTimer = window.setInterval(draw, 1000 / 12);
  };
  const stopGrain = () => {
    window.clearInterval(grainTimer);
    grainTimer = 0;
  };

  if (root.dataset.mode === "room") {
    void load();
  } else {
    startGrain();
  }
}
