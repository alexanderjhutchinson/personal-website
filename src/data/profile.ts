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

// No phone number on the public site.
export const links: Link[] = [
  { label: "Email", href: "mailto:ahutchin2003@gmail.com", display: "ahutchin2003@gmail.com" },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/alexanderjhutchinson/", display: "in/alexanderjhutchinson" },
  { label: "GitHub", href: "https://github.com/alexanderjhutchinson", display: "alexanderjhutchinson" },
];
