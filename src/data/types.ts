// Shapes for the site's content. Each job and project is one file in
// src/data/jobs or src/data/projects; adding a file adds it everywhere.

/** Year and month, like "2025-06". */
export type YearMonth = `${number}-${number}`;

/** Pixel icons drawn in code (src/lobby/contentIcons.ts). */
export type IconKind =
  | "briefcase"
  | "turbine"
  | "leaf"
  | "cog"
  | "server"
  | "chat"
  | "gamepad"
  | "diploma"
  | "toolbox"
  | "letter";

export interface Link {
  label: string;
  href: string;
  /** What to show instead of the address. */
  display: string;
}

export interface Job {
  title: string;
  company: string;
  location: string;
  start: YearMonth;
  /** Leave out while it's the current role. */
  end?: YearMonth;
  icon?: IconKind;
}

export interface Project {
  name: string;
  start: YearMonth;
  /** Leave out while it's ongoing. */
  end?: YearMonth;
  /** The tech stack, shown as the item's crafting materials. */
  stack: string[];
  icon?: IconKind;
  links?: Link[];
}
