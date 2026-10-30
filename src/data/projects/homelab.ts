import type { Project } from "../types";

export default {
  name: "Self-Hosted Homelab",
  start: "2025-08",
  stack: ["Ubuntu", "Docker Compose", "nginx", "restic", "Tailscale", "Prometheus", "Grafana"],
  icon: "server",
} satisfies Project;
