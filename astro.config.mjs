// @ts-check
import { defineConfig } from "astro/config";

// https://docs.astro.build/en/reference/configuration-reference/
export default defineConfig({
  // Where the site lives, for anything that needs a full address (link previews, a sitemap).
  site: "https://alexanderjhutchinson.com",
  // The first lobby frame lived here before the reels had their own pages.
  redirects: { "/lobby": "/about" },
});
