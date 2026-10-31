import { DEFAULT_TUNING, TUNING_RANGES, clearTuning, saveTuning, type Tuning } from "./config";

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
