// Content for the stopgap resume page. Copied from the old site (see project.md
// appendix) and still needs a refresh before the site goes live.

export interface Role {
  title: string;
  company: string;
  start: string;
  /** Leave undefined when the end date isn't known yet. */
  end?: string;
  points: string[];
}

export interface Link {
  label: string;
  href: string;
  display: string;
}

export const person = {
  name: "Alexander Hutchinson",
  program: "Systems Design Engineering",
  school: "University of Waterloo",
  role: "Software developer",
};

export const about: string[] = [
  "I am a Systems Design Engineering student at the University of Waterloo trying to discover my passions by following what drives me.",
  "I am interested in Software Development with a background in Data Engineering and Analytics. My experience with data allows me to tackle problems with deeper understanding of the product and business space.",
  "I want to contribute towards developing a meaningful product while tackling challenging problems. At the core, being able to work with something I am genuinely interested in is what creates fulfillment in what I do.",
];

export const roles: Role[] = [
  {
    title: "Software Developer Co-op",
    company: "RedIron Technologies",
    start: "Sep 2024",
    points: [
      "Developed Count Sheet functionalities using C# and .NET, integrating front-end web development with component-based architecture to establish a proof of concept (POC)",
      "Programmed responsive Appearance settings using HTML, CSS, and C# Blazor components, enabling users to control the application’s color scheme, font size, and component border radius",
    ],
  },
  {
    title: "Software Developer Co-op",
    company: "Tree of Life",
    start: "Jan 2024",
    end: "Apr 2024",
    points: [
      "Developed 10+ components on point-of-sales (POS) file management page with Angular & Redux, automating file upload, viewing, & validation, saving 2+ developer hours per week",
      "Wrote API endpoints utilizing C# and .NET framework to seamlessly fetch user information and upload files, serving as the backbone for the POS page",
    ],
  },
  {
    title: "Data Engineer Co-op",
    company: "National Grid",
    start: "May 2023",
    end: "Aug 2023",
    points: [
      "Developed the Inactive Service Program Database with Microsoft Access to improve fieldwork efficiency by identifying high priority clients",
      "Streamlined the ISP Database integration by processing 30,000 records and creating 10 fields on account information using Excel",
    ],
  },
  {
    title: "Data Analyst Co-op",
    company: "Fiix by Rockwell Automation",
    start: "Sep 2022",
    end: "Jan 2023",
    points: [
      "Reported on 12M sales opportunities in Power BI by creating data driven insights and interactive visualizations with Power Query and DAX",
      "Identified actionable insights into sales efficiency by transforming 5 data tables that depict Sales team performance",
    ],
  },
  {
    title: "Data Engineer Co-op",
    company: "Employment and Social Development Canada",
    start: "Jan 2022",
    end: "Apr 2022",
    points: [
      "Analyzed 100 fields, and 30 business metrics with SQL Dev, creating a comprehensive document identifying relevant EI pipeline data for presentational use",
      "Inspected 300 views from Oracle DataLake sources with ADF, identifying essential agent dimensions for refining business insights",
    ],
  },
];

export const links: Link[] = [
  { label: "LinkedIn", href: "https://www.linkedin.com/in/ahutchin/", display: "in/ahutchin" },
  { label: "GitHub", href: "https://github.com/ahutchin", display: "ahutchin" },
  { label: "Email", href: "mailto:ahutchin2003@gmail.com", display: "ahutchin2003@gmail.com" },
];
