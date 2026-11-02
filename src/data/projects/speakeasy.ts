import type { Project } from "../types";

export default {
  name: "SpeakEasy",
  href: "https://github.com/sophiewangg/SYDE462-Capstone---Aphasia-Rehabilitation",
  start: "2025-09",
  end: "2026-04",
  stack: ["Flutter", "FastAPI", "Celery", "Redis", "XGBoost", "AssemblyAI"],
  icon: "chat",
  summary: [
    "For my capstone, my team built SpeakEasy, an app that lets people recovering from aphasia practice everyday conversations with AI between speech therapy sessions.",
    "I built the Flutter interface and the backend pipeline that detects when a user is struggling to speak, and we designed every part of it alongside a speech-language pathologist.",
  ],
} satisfies Project;
