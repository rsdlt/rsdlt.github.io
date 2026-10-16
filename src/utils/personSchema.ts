import config from "@/config";

/**
 * schema.org `Person` for the site author, shared by the home page
 * (ProfilePage) and every post (BlogPosting author) so AI and search
 * engines resolve them to the same entity.
 */
export const personSchema = {
  "@type": "Person",
  "@id": new URL("#person", config.site.url).href,
  name: config.site.author,
  url: config.site.url,
  jobTitle: "Co-founder & CEO, Foambyte",
  worksFor: {
    "@type": "Organization",
    name: "Foambyte",
    url: "https://foambyte.com",
  },
  knowsAbout: [
    "Product management",
    "Fintech",
    "Digital banking",
    "TypeScript",
    "React",
    "Hono",
    "Cloudflare Workers",
    "PostgreSQL",
    "Claude Code",
    "Rust",
  ],
  knowsLanguage: ["en", "es"],
  sameAs: config.socials.map(({ url }) => url),
};
