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
  /** The company's site, which its name links to on the card. */
  href?: string;
  location: string;
  start: YearMonth;
  /** Leave out while it's the current role. */
  end?: YearMonth;
  icon?: IconKind;
  /** What I did there, a paragraph each, under the divider on its card. */
  summary: string[];
}

export interface Project {
  name: string;
  /** Where its name links to on the card: its code, or its site. */
  href?: string;
  start: YearMonth;
  /** Leave out while it's ongoing. */
  end?: YearMonth;
  /** The tech stack, listed as "Technologies" on its card. */
  stack: string[];
  icon?: IconKind;
  links?: Link[];
  /** What it is and how it works, a paragraph each, under the divider on its card. */
  summary: string[];
}
