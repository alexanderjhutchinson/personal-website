import { education, links, skills } from "./profile";
import type { IconKind, Job, Link, Project, YearMonth } from "./types";

type Entry<T> = T & { id: string };

/** Every file in a folder, keyed by file name, newest first. */
function load<T extends { start: YearMonth }>(modules: Record<string, { default: T }>): Entry<T>[] {
  return Object.entries(modules)
    .map(([path, mod]) => ({ ...mod.default, id: path.split("/").pop()!.replace(/\.ts$/, "") }))
    .sort((a, b) => b.start.localeCompare(a.start));
}

export const jobs = load(import.meta.glob<{ default: Job }>("./jobs/*.ts", { eager: true }));
export const projects = load(import.meta.glob<{ default: Project }>("./projects/*.ts", { eager: true }));

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const parse = (ym: YearMonth) => {
  const [y, m] = ym.split("-").map(Number);
  return { y, m };
};
export const formatMonth = (ym: YearMonth) => {
  const { y, m } = parse(ym);
  return `${MONTHS[m - 1]} ${y}`;
};

/** "Jun – Aug 2025", "Sep 2025 – Apr 2026", or "Aug 2025 – now". */
export function formatRange(start: YearMonth, end?: YearMonth) {
  if (!end) return `${formatMonth(start)} – now`;
  const a = parse(start);
  const b = parse(end);
  if (a.y === b.y) return a.m === b.m ? formatMonth(start) : `${MONTHS[a.m - 1]} – ${MONTHS[b.m - 1]} ${b.y}`;
  return `${formatMonth(start)} – ${formatMonth(end)}`;
}

function months(start: YearMonth, end: YearMonth) {
  const a = parse(start);
  const b = parse(end);
  const n = (b.y - a.y) * 12 + (b.m - a.m) + 1;
  return n === 1 ? "1 month" : `${n} months`;
}

export type ReelId = "about" | "experience" | "projects";
export interface Reel {
  id: ReelId;
  number: number;
  title: string;
  path: string;
  scene: string;
}

// The reels of the feature, in order. Reel pages, the door buttons, and the Program all read from here.
export const REELS: readonly Reel[] = [
  { id: "about", number: 1, title: "About", path: "/about", scene: "The home base" },
  { id: "experience", number: 2, title: "Experience", path: "/experience", scene: "The mine" },
  { id: "projects", number: 3, title: "Projects", path: "/projects", scene: "The workshop" },
];

/** What an item's name color means. */
export const ITEM_TYPES = {
  school: { label: "School", color: "#e58a5c" },
  work: { label: "Work", color: "#e0a33a" },
  project: { label: "Project", color: "#b7c46c" },
  info: { label: "Info", color: "#ece1c9" },
} as const;
export type ItemType = keyof typeof ITEM_TYPES;

/** One piece of content as an item: a short entry in the reel's panel, and a full card on click. */
export interface ContentItem {
  id: string;
  type: ItemType;
  icon: IconKind;
  name: string;
  /** One short line under the name in the panel. */
  sub: string;
  /** Lines on the card, under the name. */
  lines: string[];
  groups?: { label: string; items: string[] }[];
  links?: Link[];
}

const skillCount = skills.reduce((n, g) => n + g.items.length, 0);

export const reelItems: Record<ReelId, ContentItem[]> = {
  about: [
    {
      id: "education",
      type: "school",
      icon: "diploma",
      name: education.degree,
      sub: `${education.school} · ${education.year}`,
      lines: [education.school, `${education.honours}, GPA ${education.gpa}`, education.year],
    },
    {
      id: "skills",
      type: "info",
      icon: "toolbox",
      name: "Skills",
      sub: `${skills[0].items.slice(0, 3).join(", ")} and ${skillCount - 3} more`,
      lines: [],
      groups: skills,
    },
    {
      id: "contact",
      type: "info",
      icon: "letter",
      name: "Contact",
      sub: links.map((l) => l.label).join(", "),
      lines: [],
      links,
    },
  ],
  experience: jobs.map((job) => ({
    id: job.id,
    type: "work",
    icon: job.icon ?? "briefcase",
    name: job.title,
    sub: `${job.company} · ${formatRange(job.start, job.end)}`,
    lines: [
      job.company,
      job.location,
      job.end ? `${formatRange(job.start, job.end)} (${months(job.start, job.end)})` : formatRange(job.start),
    ],
  })),
  projects: projects.map((project) => ({
    id: project.id,
    type: "project",
    icon: project.icon ?? "cog",
    name: project.name,
    sub: formatRange(project.start, project.end),
    lines: [formatRange(project.start, project.end)],
    groups: [{ label: "Materials", items: project.stack }],
    links: project.links,
  })),
};
