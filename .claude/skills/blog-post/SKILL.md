---
name: blog-post
description: House rules for writing, editing and scheduling posts on rsdlt.dev (this Astro blog). Use whenever drafting a new post, turning notes, an announcement or a git log into a post, writing the next post in a series (Building levi, Foambyte engineering), scheduling a post for a future date, or revising an existing post in src/content/posts.
---

# Writing a post for rsdlt.dev

rsdlt.dev is Rodrigo Santiago's blog: first-hand posts about building software, mostly
Foambyte (React, Hono, Cloudflare Workers, Postgres), levi (a Rust git TUI) and working with
Claude Code. Every post documents real work. Accuracy matters more than polish.

## 1. Gather facts from primary sources

- **Projects:** read the git log with bodies (`git log --reverse --format='%ad %h %s%n%b'`),
  the diffs of the commits you cover, and the project's plan or README. For levi that's
  `../levi`, its commit bodies and `docs/plan.md`.
- **News and announcements:** fetch the original source. Quote numbers exactly and attribute
  vendor claims ("Google's own numbers, not independent").
- **Every number needs a source** you could point to. Keep comparisons like for like: don't
  turn "55 s for a full search" and "0.16 s for a scoped query" into "340x faster".
- **Never invent the author's feelings, motivations, opinions or anecdotes** ("my favorite
  part", "the feature I use most", "I wanted"). If the post needs them, write around them and
  list them for the author to fill in.
- **Code samples are real excerpts.** If you trim one, add a `// Simplified from <file>`
  comment.

## 2. File and frontmatter

Path: `src/content/posts/<slug>.md`. The slug is kebab-case with the search keywords people
would type (`integration-testing-cloudflare-workers-postgres-pglite-vitest`). URLs are
`/posts/<slug>/` and must never change once published.

```yaml
---
title: "Specific, Keyword-Rich Title: With a Concrete Payoff"
pubDatetime: 2026-10-18T09:00:00-05:00
description: "One sentence, under ~160 characters, saying what the reader learns."
tags: ["levi", "rust", "git", "claude code"]
---
```

- **`pubDatetime` uses Central time with an explicit offset:** `-05:00` during daylight saving
  (CDT, mid-March to early November), `-06:00` otherwise (CST). Check with `date` if unsure.
- **Tags are lowercase.** Series tags decide which series page lists the post:
  - `foambyte`: Foambyte engineering series (`/foambyte`). Architecture posts only, not news.
  - `levi`: Building levi series (`/levi`).
- Optional fields: `modDatetime` (when revising a published post), `featured`, `draft: true`,
  `ogImage`.
- Don't run prettier on posts. It rewrites the Markdown.

## 3. Scheduling

Production builds hide posts whose `pubDatetime` is in the future (minus a 15-minute margin),
everywhere: lists, tags, RSS, series pages, llms.txt, the post page and its OG image. The site
rebuilds every day at about 9:17 Central, with spare runs an hour and two hours later (`.github/workflows/deploy.yml`), and on every push.

- **Scheduled posts go out at 9:00:** use `T09:00:00` with the right offset. Later times wait
  until the next day's run or the next push.
- **To publish now,** use a time that has already passed.
- **One post per day** for a series, on consecutive days unless told otherwise.
- **Never link to a post that isn't live yet.** Link back to earlier posts, not forward.
  Mentioning a future post in plain text is fine.

## 4. Structure and voice

- **Open with the point.** The first paragraph says what the post covers and why it matters,
  with links to the project or source. In a series, it also links the series page and the
  previous post.
- **`##` sections**, ordered the way the work happened or the way the reader needs it.
- **Bulleted lists with bold lead-ins** for sets of points, numbered lists for sequences, and
  tables for comparisons, benchmarks and before/after numbers.
- **Short paragraphs and plain words.** First person, direct, specific. No em dashes.
- **End with `## Takeaways`:** 3 to 5 bullets with bold lead-ins, each a lesson the reader can
  reuse. In a series, follow with one sentence on what the next post covers.
- **End every post with this footer, verbatim:**

```markdown
---

*I'm Rodrigo Santiago, a product leader who builds. I co-founded [Foambyte](https://foambyte.com) with my brother Diego, a brewmaster who leads the product as CPO, and I designed and built the platform: architecture, frontend, backend, mobile and infrastructure. If you need someone who can own both the product and the code, [let's talk on LinkedIn](https://www.linkedin.com/in/rsdlt).*
```

### Series specifics

- **Building levi:** one post per work session, oldest first, open-ended as levi keeps
  shipping. Every post has a `## How Claude Code fit in` section grounded in the commits: the
  plan as the contract, numbers in commit messages, CI gates, small releases, measured and
  rejected ideas.
- **Foambyte engineering:** each post explains a decision, the alternatives and why it was the
  right trade-off at the time.

## 5. Prose pass

After the draft is complete, apply the `stop-slop` skill to cut AI writing patterns: filler,
formulaic contrasts, passive voice, vague declaratives, pull-quote endings. Where stop-slop and
this skill disagree, this skill wins: keep the bold lead-ins, tables, Takeaways section and the
footer.

## 6. Verify, commit, report

1. `pnpm build` finishes with 0 errors. For a scheduled post, confirm it's absent from `dist/`
   (the production build hides it) and that it renders in `pnpm dev`.
2. Every internal link points to a post that exists and is already live.
3. Re-check each number and quote against its source one last time.
4. Commit the post on its own ("Add a post on …" or "Schedule Building levi post N"). Never
   push; end with `ready for you to push`.
5. Tell the author what to review: claims you couldn't verify, and anywhere a personal detail
   would make the post stronger.
