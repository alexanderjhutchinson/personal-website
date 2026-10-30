import type { Link } from "./types";

export const person = {
  name: "Alexander Hutchinson",
  program: "Systems Design Engineering",
  school: "University of Waterloo",
  role: "Software developer",
};

export const education = {
  school: "University of Waterloo",
  degree: "BASc, Systems Design Engineering",
  honours: "Dean's Honours",
  gpa: "3.9",
  year: "2026",
};

export const skills: { label: string; items: string[] }[] = [
  {
    label: "Languages",
    items: ["Java", "Bash", "Python", "TypeScript", "JavaScript", "C#", "C++", "SQL", "Dart", "HTML and CSS"],
  },
  { label: "Frameworks and libraries", items: ["Angular", "NgRx", "ASP.NET Core", "Blazor", "Flutter"] },
  {
    label: "Tools",
    items: ["Git", "Postman", "ORDS", "Oracle SQL Developer", "MySQL", "Redis", "Jira", "Confluence"],
  },
];

// The 2023 copy, kept until it's rewritten (see project.md).
export const about: string[] = [
  "I am a Systems Design Engineering student at the University of Waterloo trying to discover my passions by following what drives me.",
  "I am interested in Software Development with a background in Data Engineering and Analytics. My experience with data allows me to tackle problems with deeper understanding of the product and business space.",
  "I want to contribute towards developing a meaningful product while tackling challenging problems. At the core, being able to work with something I am genuinely interested in is what creates fulfillment in what I do.",
];

// No phone number on the public site.
export const links: Link[] = [
  { label: "Email", href: "mailto:ahutchin2003@gmail.com", display: "ahutchin2003@gmail.com" },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/alexanderjhutchinson/", display: "in/alexanderjhutchinson" },
  { label: "GitHub", href: "https://github.com/alexanderjhutchinson", display: "alexanderjhutchinson" },
];
