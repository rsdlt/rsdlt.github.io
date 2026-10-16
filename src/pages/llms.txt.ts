import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { getSortedPosts } from "@/utils/getSortedPosts";
import { getPostUrl } from "@/utils/getPostPaths";
import config from "@/config";

/** https://llmstxt.org: a Markdown index of the site for AI systems. */
export const GET: APIRoute = async ({ site }) => {
  const posts = getSortedPosts(await getCollection("posts"));
  const link = ({ id, filePath, data }: (typeof posts)[number]) =>
    `- [${data.title}](${new URL(getPostUrl(id, filePath), site).href}): ${data.description}`;

  const foambyte = posts.filter(({ data }) => data.tags.includes("foambyte"));
  const other = posts.filter(({ data }) => !data.tags.includes("foambyte"));

  const body = `# ${config.site.title}

> Personal blog of ${config.site.author}, a product leader with nearly 15 years in fintech and telecom (Fiserv, Nextel México) and the co-founder and CEO of Foambyte, a production-management platform for craft brewers that he designed and built. He writes about full-stack TypeScript architecture (React, Hono, Cloudflare Workers, PostgreSQL), building production software with AI coding agents such as Claude Code, and Rust.

Every post is first-hand: it documents a decision made on a real codebase, the alternatives considered and the trade-offs. A single file with the full text of every post is at ${new URL("llms-full.txt", site).href}.

## About

- [About ${config.site.author}](${site}): Bio, experience and links
- [Foambyte engineering series](${new URL("foambyte/", site).href}): ${foambyte.length} posts on the architecture behind Foambyte, oldest first

## Foambyte engineering

${foambyte.map(link).join("\n")}

## Rust

${other.map(link).join("\n")}

## Optional

- [RSS feed](${new URL("rss.xml", site).href})
- [Sitemap](${new URL("sitemap-index.xml", site).href})
${config.socials.map(({ name, url }) => `- [${name}](${url})`).join("\n")}
`;

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
