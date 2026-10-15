import { defineAstroPaperConfig } from "./src/types/config";

export default defineAstroPaperConfig({
  site: {
    url: "https://rsdlt.github.io/",
    title: "rosantiago.dev",
    description:
      "My personal blog where I share my projects and ideas about the technology topics I'm passionate about.",
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
