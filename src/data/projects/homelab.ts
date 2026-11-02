import type { Project } from "../types";

export default {
  name: "Self-Hosted Homelab",
  href: "https://github.com/alexanderjhutchinson/server-configs",
  start: "2025-08",
  stack: ["Ubuntu", "Docker Compose", "nginx", "restic", "Tailscale", "Prometheus", "Grafana"],
  icon: "server",
  summary: [
    "I started this project when I was feeling lost about what I wanted from software and just needed to build something.",
    "It was the first time I built a system from nothing, from turning an old laptop into a server to adding a second machine for backups and failover.",
    "I still use it every day, and it's become the home base for everything I work on.",
  ],
} satisfies Project;
