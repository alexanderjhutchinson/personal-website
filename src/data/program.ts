import { REELS, formatRange, jobs, projects } from ".";
import { education, links, person, skills } from "./profile";
import type { Link } from "./types";

// The program: a folded paper on the coffee table. The 3D paper (src/scene/programPages.ts)
// and its high-def view (src/components/Program.astro) are both built from this.

export interface ProgramEntry {
  /** Small line above the title: dates, or a group name. */
  kicker?: string;
  title?: string;
  lines: string[];
}

export interface ProgramSection {
  heading: string;
  entries?: ProgramEntry[];
  links?: Link[];
}

export const cover = {
  kicker: "Home movie night",
  name: person.name,
  standfirst: [person.program, person.school, person.role],
  featureLabel: "Tonight's feature",
  reels: REELS,
  note: "Pick a reel and the film starts there.",
};

/** The three pages after the cover: inside left, inside right, and the back. */
export const pages: ProgramSection[][] = [
  [
    {
      heading: "Experience",
      entries: jobs.map((job) => ({
        kicker: formatRange(job.start, job.end),
        title: job.title,
        lines: [`${job.company}, ${job.location}`],
      })),
    },
    {
      heading: "Education",
      entries: [
        {
          kicker: education.year,
          title: education.degree,
          lines: [education.school, `${education.honours}, GPA ${education.gpa}`],
        },
      ],
    },
  ],
  [
    {
      heading: "Projects",
      entries: projects.map((project) => ({
        kicker: formatRange(project.start, project.end),
        title: project.name,
        lines: [project.stack.join(", ")],
      })),
    },
    {
      heading: "Skills",
      entries: skills.map((group) => ({ kicker: group.label, lines: [group.items.join(", ")] })),
    },
  ],
  [{ heading: "Contact", links }],
];
