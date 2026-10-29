// @ts-check
import { defineConfig } from "astro/config";

// https://docs.astro.build/en/reference/configuration-reference/
export default defineConfig({
  // The first lobby frame lived here before the reels had their own pages.
  redirects: { "/lobby": "/about" },
});
