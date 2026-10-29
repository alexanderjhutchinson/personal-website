import { DEFAULT_TUNING, TUNING_RANGES, clearTuning, saveTuning, type Tuning } from "./config";
import { HOTBAR_SIZE, type Inventory } from "./inventory";
import { ITEMS, itemIcon } from "./items";

const iconUrls = new Map<string, string>();
const iconUrl = (id: Parameters<typeof itemIcon>[0]) => {
  let url = iconUrls.get(id);
  if (!url) {
    url = itemIcon(id).toDataURL();
    iconUrls.set(id, url);
  }
  return url;
};

/** The hotbar, its tooltips, and the name of the selected item. Plain DOM over the canvas so text stays crisp. */
export function mountHotbar(root: HTMLElement, tooltip: HTMLElement, label: HTMLElement, inv: Inventory) {
  root.innerHTML = "";
  const buttons = Array.from({ length: HOTBAR_SIZE }, (_, i) => {
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.type = "button";
    b.className = "slot";
    b.dataset.index = String(i);
    b.innerHTML = `<span class="key">${(i + 1) % 10}</span><img alt="" /><span class="count"></span>`;
    b.addEventListener("click", () => inv.select(i));
    b.addEventListener("pointerenter", () => showTip(i, b));
    b.addEventListener("pointerleave", () => (tooltip.hidden = true));
    b.addEventListener("focus", () => showTip(i, b));
    b.addEventListener("blur", () => (tooltip.hidden = true));
    li.append(b);
    root.append(li);
    return b;
  });

  const showTip = (i: number, anchor: HTMLElement) => {
    const slot = inv.slots[i];
    if (!slot) {
      tooltip.hidden = true;
      return;
    }
    const def = ITEMS[slot.item];
    tooltip.innerHTML = "";
    const name = document.createElement("p");
    name.className = "tip-name";
    name.style.color = def.color;
    name.textContent = def.stackable && slot.count > 1 ? `${def.name} (${slot.count})` : def.name;
    tooltip.append(name);
    for (const line of def.lines) {
      const p = document.createElement("p");
      p.textContent = line;
      tooltip.append(p);
    }
    const frame = root.closest(".frame")?.getBoundingClientRect();
    const a = anchor.getBoundingClientRect();
    if (frame) {
      tooltip.style.left = `${a.left - frame.left}px`;
      tooltip.style.top = `${a.bottom - frame.top + 6}px`;
    }
    tooltip.hidden = false;
  };

  const render = () => {
    buttons.forEach((b, i) => {
      const slot = inv.slots[i];
      const img = b.querySelector("img");
      const count = b.querySelector(".count");
      b.classList.toggle("selected", i === inv.selected);
      b.setAttribute("aria-pressed", String(i === inv.selected));
      b.setAttribute("aria-label", slot ? `${ITEMS[slot.item].name}${slot.count > 1 ? `, ${slot.count}` : ""}` : "Empty slot");
      if (img) {
        if (slot) img.src = iconUrl(slot.item);
        img.hidden = !slot;
      }
      if (count) count.textContent = slot && ITEMS[slot.item].stackable ? String(slot.count) : "";
    });
    const current = inv.current;
    label.textContent = current ? ITEMS[current.item].name : "";
  };
  inv.onChange = render;
  render();
}

/** Sliders for everything in Tuning. Changes apply immediately and are remembered in this browser. */
export function mountTuning(panel: HTMLElement, tuning: Tuning, onResetScene: () => void) {
  const labels: Record<keyof Tuning, string> = {
    runSpeed: "Run speed",
    accel: "Acceleration",
    friction: "Stopping",
    airControl: "Air control",
    jumpSpeed: "Jump speed",
    jumpHold: "Jump hold time",
    gravity: "Gravity",
    maxFall: "Max fall speed",
    pickUseTime: "Pickaxe swing time",
    swordUseTime: "Sword swing time",
    pickPower: "Pickaxe power",
    reach: "Reach (tiles)",
  };
  panel.innerHTML = `<h2>Tune the feel</h2><p class="hint">Saved in this browser. Press <kbd>\`</kbd> to hide.</p>`;
  const inputs = new Map<keyof Tuning, HTMLInputElement>();
  for (const key of Object.keys(TUNING_RANGES) as (keyof Tuning)[]) {
    const [min, max, step] = TUNING_RANGES[key];
    const row = document.createElement("label");
    row.className = "tune-row";
    const name = document.createElement("span");
    name.textContent = labels[key];
    const input = document.createElement("input");
    input.type = "range";
    input.id = `tune-${key}`;
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(tuning[key]);
    const out = document.createElement("output");
    out.textContent = String(tuning[key]);
    input.addEventListener("input", () => {
      tuning[key] = Number(input.value);
      out.textContent = input.value;
      saveTuning(tuning);
    });
    row.append(name, input, out);
    panel.append(row);
    inputs.set(key, input);
  }

  const actions = document.createElement("div");
  actions.className = "tune-actions";
  const button = (text: string, onClick: () => void) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = text;
    b.addEventListener("click", onClick);
    actions.append(b);
    return b;
  };
  button("Defaults", () => {
    Object.assign(tuning, DEFAULT_TUNING);
    clearTuning();
    for (const [key, input] of inputs) {
      input.value = String(tuning[key]);
      input.dispatchEvent(new Event("input"));
    }
    clearTuning();
  });
  const copy = button("Copy values", async () => {
    const text = JSON.stringify(tuning, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      copy.textContent = "Copied";
    } catch {
      copy.textContent = "Couldn't copy";
      console.info(text);
    }
    setTimeout(() => (copy.textContent = "Copy values"), 1500);
  });
  button("Reset scene", onResetScene);
  panel.append(actions);
}
