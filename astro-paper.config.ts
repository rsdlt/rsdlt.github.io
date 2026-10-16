import { defineAstroPaperConfig } from "./src/types/config";

export default defineAstroPaperConfig({
  site: {
    url: "https://rsdlt.dev/",
    title: "rsdlt.dev",
    description:
      "Rodrigo Santiago, product leader and Foambyte co-founder, on building production software: React, Hono, Cloudflare Workers, Postgres, Claude Code and Rust.",
    author: "Rodrigo Santiago",
    profile: "https://github.com/rsdlt",
    ogImage: "default-og.jpg",
    lang: "en",
    timezone: "America/New_York",
    dir: "ltr",
  },
  posts: {
    perPage: 10,
    perIndex: 4,
    scheduledPostMargin: 15 * 60 * 1000,
  },
  features: {
    lightAndDarkMode: false,
    dynamicOgImage: true,
    showArchives: true,
    showBackButton: true,
    editPost: { enabled: false },
    search: "pagefind",
  },
  socials: [
    { name: "github", url: "https://github.com/rsdlt" },
    { name: "linkedin", url: "https://www.linkedin.com/in/rsdlt" },
  ],
  shareLinks: [
    { name: "x", url: "https://x.com/intent/post?url=" },
  ],
});
