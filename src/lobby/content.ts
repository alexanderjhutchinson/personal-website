import { icon } from "./items";
import type { IconKind } from "../data/types";

// Pixel icons for content items, in the same style as the tools.
const ICONS: Record<IconKind, () => HTMLCanvasElement> = {
  briefcase: () =>
    icon((plot) => {
      for (let y = 5; y <= 13; y++) {
        for (let x = 2; x <= 13; x++) plot(x, y, y === 5 ? "#b47a46" : y === 13 ? "#5a3418" : y === 9 ? "#6a3f20" : "#8d5a30");
      }
      for (const [x, y] of [
        [6, 4],
        [6, 3],
        [7, 2],
        [8, 2],
        [9, 3],
        [9, 4],
      ])
        plot(x, y, "#5a3418");
      plot(7, 9, "#d9a441");
      plot(8, 9, "#d9a441");
      plot(7, 10, "#a87a26");
      plot(8, 10, "#a87a26");
    }),
  turbine: () =>
    icon((plot, line) => {
      line(8, 8, 8, 14, "#cfd6d9");
      line(9, 9, 9, 14, "#9aa3a8");
      line(6, 15, 10, 15, "#6c7479");
      line(8, 6, 8, 0, "#e3e8ea");
      line(7, 7, 2, 11, "#e3e8ea");
      line(9, 7, 14, 11, "#e3e8ea");
      plot(8, 7, "#6c7479");
    }),
  leaf: () =>
    icon((plot, line) => {
      const [cx, cy] = [8.5, 7];
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const u = (x - cx - (y - cy)) / Math.SQRT2;
          const v = (x - cx + (y - cy)) / Math.SQRT2;
          if ((u / 6.5) ** 2 + (v / 3.6) ** 2 >= 1) continue;
          plot(x, y, Math.abs(v) < 0.6 ? "#3e6b2c" : v < 0 ? "#7cb84a" : "#5f9a3a");
        }
      }
      line(4, 12, 1, 15, "#6a3f20");
    }),
  cog: () =>
    icon((plot) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const d = Math.hypot(x - 7.5, y - 7.5);
          const tooth = Math.cos(Math.atan2(y - 7.5, x - 7.5) * 8) > 0.2;
          if (d < 2.2 || d > 7.4 || (d > 5.4 && !tooth)) continue;
          plot(x, y, d < 3.4 ? "#6c7479" : x + y < 14 ? "#cfd6d9" : "#9aa3a8");
        }
      }
    }),
  server: () =>
    icon((plot) => {
      for (let y = 1; y <= 14; y++) for (let x = 3; x <= 12; x++) plot(x, y, "#3d3f44");
      for (const top of [2, 6, 10]) {
        for (let y = top; y < top + 3; y++) for (let x = 4; x <= 11; x++) plot(x, y, y === top ? "#7d828b" : "#5d6169");
        plot(10, top + 1, "#8fe07a");
        plot(8, top + 1, top === 6 ? "#f2b04a" : "#8fe07a");
        plot(5, top + 1, "#2a2b2f");
        plot(6, top + 1, "#2a2b2f");
      }
    }),
  chat: () =>
    icon((plot) => {
      for (let y = 2; y <= 10; y++) {
        for (let x = 1; x <= 14; x++) {
          const corner = (x === 1 || x === 14) && (y === 2 || y === 10);
          if (!corner) plot(x, y, y === 2 ? "#ffffff" : y === 10 ? "#d8cfb2" : "#f1ead2");
        }
      }
      for (const [x, y] of [
        [3, 11],
        [4, 11],
        [3, 12],
        [2, 13],
      ])
        plot(x, y, "#d8cfb2");
      for (const x of [4, 7, 10]) {
        plot(x, 6, "#3b2440");
        plot(x + 1, 6, "#3b2440");
      }
    }),
  gamepad: () =>
    icon((plot) => {
      for (let y = 5; y <= 11; y++) {
        for (let x = 1; x <= 14; x++) {
          const corner = (x === 1 || x === 14) && (y === 5 || y === 11);
          if (!corner) plot(x, y, y === 5 ? "#9aa3a8" : "#6c7479");
        }
      }
      for (const x of [1, 2, 3, 12, 13, 14]) plot(x, 12, "#6c7479");
      for (const x of [2, 3, 12, 13]) plot(x, 13, "#5d6169");
      for (const [x, y] of [
        [4, 7],
        [3, 8],
        [4, 8],
        [5, 8],
        [4, 9],
      ])
        plot(x, y, "#2a2b2f");
      plot(11, 7, "#e0662a");
      plot(12, 8, "#8fe07a");
      plot(10, 8, "#8fbfff");
      plot(11, 9, "#f2c14e");
    }),
  diploma: () =>
    icon((plot) => {
      for (let y = 4; y <= 11; y++) for (let x = 2; x <= 13; x++) plot(x, y, y === 4 ? "#ffffff" : "#efe3c4");
      for (let y = 3; y <= 12; y++) {
        plot(1, y, "#d8cfb2");
        plot(14, y, "#d8cfb2");
      }
      for (const y of [6, 8]) for (let x = 4; x <= 11; x++) plot(x, y, "#b9aa8d");
      for (let y = 4; y <= 11; y++) {
        plot(7, y, "#b8442f");
        plot(8, y, "#b8442f");
      }
      for (const [x, y] of [
        [6, 12],
        [6, 13],
        [9, 12],
        [9, 13],
      ])
        plot(x, y, "#8c2f22");
    }),
  toolbox: () =>
    icon((plot) => {
      for (let y = 6; y <= 13; y++) for (let x = 1; x <= 14; x++) plot(x, y, y <= 7 ? "#8c2f22" : y === 13 ? "#7a281d" : "#b8442f");
      for (const [x, y] of [
        [5, 5],
        [5, 4],
        [6, 3],
        [7, 3],
        [8, 3],
        [9, 3],
        [10, 4],
        [10, 5],
      ])
        plot(x, y, "#5d6169");
      plot(7, 9, "#d9a441");
      plot(8, 9, "#d9a441");
    }),
  letter: () =>
    icon((plot, line) => {
      for (let y = 4; y <= 12; y++) for (let x = 1; x <= 14; x++) plot(x, y, y === 12 ? "#d8cfb2" : "#efe3c4");
      line(1, 4, 7, 9, "#b9aa8d");
      line(14, 4, 8, 9, "#b9aa8d");
      plot(7, 9, "#b8442f");
      plot(8, 9, "#b8442f");
      plot(7, 10, "#8c2f22");
      plot(8, 10, "#8c2f22");
    }),
};

const canvases = new Map<IconKind, HTMLCanvasElement>();
/** A content item's 16×16 pixel icon. */
export function contentIcon(kind: IconKind) {
  let c = canvases.get(kind);
  if (!c) {
    c = ICONS[kind]();
    canvases.set(kind, c);
  }
  return c;
}

const urls = new Map<IconKind, string>();
function iconUrl(kind: IconKind) {
  let url = urls.get(kind);
  if (!url) {
    url = contentIcon(kind).toDataURL();
    urls.set(kind, url);
  }
  return url;
}

/**
 * The item cards (and the reel's item list for screen readers) are rendered
 * into the page by Astro. This fills in their pixel icons and opens a card
 * when an item is clicked, here or in the panel drawn on the reel.
 */
export function mountContent(onOpen?: (key: string) => void) {
  for (const el of document.querySelectorAll<HTMLElement>("[data-icon]")) {
    const kind = el.dataset.icon as IconKind;
    if (!(kind in ICONS) || el.querySelector("img")) continue;
    const img = document.createElement("img");
    img.alt = "";
    img.src = iconUrl(kind);
    el.append(img);
  }

  const dialog = document.getElementById("item-card") as HTMLDialogElement | null;
  if (!dialog) return null;
  const cards = dialog.querySelectorAll<HTMLElement>("[data-card]");

  // Closing plays the opening backwards (the "closing" class in Reel.astro), then closes for real. The
  // dialog stays open until then, so the page and the game keep ignoring keys. Opening a card meanwhile
  // calls the close off. If the animation stalls (a page that isn't drawing), it closes anyway.
  let closing = 0;
  const close = () => {
    if (!dialog.open || dialog.classList.contains("closing")) return;
    const token = ++closing;
    dialog.classList.add("closing");
    const played = Promise.allSettled(dialog.getAnimations({ subtree: true }).map((a) => a.finished));
    void Promise.race([played, new Promise((resolve) => setTimeout(resolve, 600))]).then(() => {
      if (token !== closing) return;
      dialog.classList.remove("closing");
      dialog.close();
    });
  };

  // Cards are keyed "reel/item". The open card's item goes in the address, like /projects#speakeasy.
  const open = (key: string) => {
    closing++;
    dialog.classList.remove("closing");
    for (const card of cards) card.hidden = card.dataset.card !== key;
    if (!dialog.open) dialog.showModal();
    history.replaceState(history.state, "", `#${key.split("/")[1]}`);
    onOpen?.(key);
  };

  document.addEventListener("click", (e) => {
    const button = (e.target as Element | null)?.closest<HTMLElement>("[data-item]");
    if (button?.dataset.item) open(button.dataset.item);
  });
  // Close with the button, Escape, or a click outside the card.
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog || (e.target as Element).closest("[data-close]")) close();
  });
  // Escape is caught as a key, since the browser only lets a page hold back its own close (the cancel
  // event) after a fresh click. Cancel still covers other ways of closing, like a phone's back gesture.
  dialog.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    e.preventDefault();
    close();
  });
  dialog.addEventListener("cancel", (e) => {
    e.preventDefault();
    close();
  });
  dialog.addEventListener("close", () => {
    if (location.hash) history.replaceState(history.state, "", location.pathname + location.search);
  });

  const reel = document.getElementById("reel-layer")?.dataset.reel;
  const linked = `${reel}/${decodeURIComponent(location.hash.slice(1))}`;
  if (location.hash && [...cards].some((card) => card.dataset.card === linked)) open(linked);

  return { open };
}
