import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { getSortedPosts } from "@/utils/getSortedPosts";
import { getPostUrl } from "@/utils/getPostPaths";
import config from "@/config";

/** The full Markdown text of every post in one file, for AI systems. */
export const GET: APIRoute = async ({ site }) => {
  const posts = getSortedPosts(await getCollection("posts"));

  const sections = posts.map(({ id, filePath, body, data }) => {
    const updated = data.modDatetime
      ? `\nUpdated: ${data.modDatetime.toISOString().slice(0, 10)}`
      : "";
    return `# ${data.title}

URL: ${new URL(getPostUrl(id, filePath), site).href}
Author: ${data.author}
Published: ${data.pubDatetime.toISOString().slice(0, 10)}${updated}
Tags: ${data.tags.join(", ")}

> ${data.description}

${body?.trim() ?? ""}`;
  });

  const header = `# ${config.site.title}: full text of all posts by ${config.site.author}\n\n`;

  return new Response(header + sections.join("\n\n---\n\n") + "\n", {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
