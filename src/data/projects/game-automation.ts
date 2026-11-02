import type { Project } from "../types";

export default {
  name: "Game Automation",
  start: "2026-08",
  end: "2026-10",
  stack: ["OCR", "SQLite", "Appium"],
  icon: "gamepad",
  summary: [
    "This tool sorts my collection of 5,000+ Pokémon in Pokémon GO, and it was the first project I built mostly through AI agents.",
    "It tested whether I could hand off the code without losing control of what was being built: I wrote the design and architecture docs and reviewed every step.",
    "It showed me how much of engineering is decision-making rather than programming.",
  ],
} satisfies Project;
