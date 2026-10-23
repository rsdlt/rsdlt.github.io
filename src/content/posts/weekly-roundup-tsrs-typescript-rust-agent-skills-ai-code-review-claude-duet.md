---
title: "Weekly Roundup: TypeScript in Rust, Agent Skills Goes Neutral, a 68% Cheaper Code Reviewer, and Claude Duet"
description: "tsrs ports TypeScript to Rust, Agent Skills moves to the Linux Foundation, Cloudflare cuts AI code review costs 68%, and Anthropic previews Claude Duet."
pubDatetime: 2026-10-23T09:00:00-05:00
tags: ["weekly roundup", "typescript", "rust", "cloudflare", "agent skills", "claude", "ai coding agents"]
---

This week: a Rust port of the TypeScript compiler, a vendor-neutral home for Agent Skills, Cloudflare's playbook for cutting an AI code reviewer's cost by 68%, and Claude Duet, Anthropic's new agent for small businesses. I build [Foambyte](https://foambyte.com) on my own with Claude Code, on Hono, React and TypeScript, so for each story I list the facts, the numbers and what I'd check before using it. Last week's roundup covered [Cloudflare Void, Gemini 4 Argon, Muse Wonder and Workers flamegraphs](/posts/weekly-roundup-cloudflare-void-gemini-4-argon-meta-muse-wonder-flamegraphs/).

## 1. tsrs: the TypeScript compiler, ported to Rust

tsrs is an experimental Rust port of the TypeScript compiler, released on October 20 by Cloudflare and VoidZero (the team behind Vite and Oxc). It lives inside the Oxc toolchain, and the authors built it with the TypeScript team. They say plainly that it's not a fork: the TypeScript team keeps control of the language's design.

Their numbers, which they say they checked with the TypeScript team:

- **Speed and memory:** up to 8x faster than TypeScript 7.0 with about 70% less memory, at the same number of type-check workers.
- **Adaptive default:** tsrs picks a configuration based on the machine. It uses more memory and runs faster still. The post gives no figure for it.
- **Upstream gains:** some tsrs optimizations already landed in TypeScript. The TypeScript 7.1 beta runs up to 2.5x faster than 7.0.

You can try it with `npx tsrs`. There's also a WebAssembly build (`@tsrs/wasm`), and the source is at [github.com/oxc-project/tsrs](https://github.com/oxc-project/tsrs). Some differences from `tsc` remain, such as the order it prints diagnostics in. To stay in sync, an agent reviews upstream changes every morning and opens tracking issues, and the test suite runs against tsrs every night.

**Why I care:** I wrote [baa](https://github.com/rsdlt/baa), a small Rust plugin that runs `tsc` (or `cargo check`) after every agent turn and shows whether the project still compiles. On a TypeScript project that check runs dozens of times a day, so its speed adds up. Before switching, I'd run tsrs next to `tsc` on Foambyte's Hono and React code and diff the diagnostics. If the two disagree, I'd keep the slow one.

Source: [Cloudflare Blog, "Introducing tsrs: A port of TypeScript to Rust" (Oct 20, 2026)](https://blog.cloudflare.com/typescript-rust-port/)

## 2. Agent Skills moves to the Agentic AI Foundation

On October 22, Anthropic donated the Agent Skills standard to the Agentic AI Foundation (AAIF), part of the Linux Foundation and the same home it gave MCP. The transfer covers the name and logo, the GitHub organization and the agentskills.io domain.

- **Adoption:** more than 70 agent platforms have integrated Agent Skills since the standard came out in December 2025, including ChatGPT, Cursor, GitHub Copilot and VS Code.
- **Maintainers:** engineers from Anthropic, Google, OpenAI and other companies will maintain it as individuals.
- **Roadmap:** versioned releases, a formal process for proposing changes and security guidance for people who write and install skills.
- **Access:** you don't need to join the AAIF to use the standard or contribute to it.

**Why I care:** skills run through a lot of my Claude Code work, and the more of my workflow lives in them, the more I want them to work across vendors. I'm watching the security guidance most. A skill bundles instructions with scripts an agent will run, so I treat installing someone else's skill like adding a dependency.

Source: [Anthropic, "Donating Agent Skills to the Agentic AI Foundation" (Oct 22, 2026)](https://www.anthropic.com/news/donating-agent-skills-to-the-agentic-ai-foundation)

## 3. Cloudflare cut its AI code review bill by 68%

Cloudflare cut the average cost of its internal AI code reviewer from $2.43 to $0.77 per review by restructuring prompts for caching, making fewer LLM calls and retuning models. It published the details on October 19.

| Metric | Before | After |
|---|---|---|
| Average cost per review | $2.43 | $0.77 |
| Median review time | 4m 09s | 1m 32s |
| 99th percentile review time | 15m 20s | 4m 41s |
| Cache hit rate | 85.7% (April) | 97% (September) |
| Tokens per review | 0.91M | 2.99M |

The $2.43 is the average over the two most expensive weeks before the changes. Tokens per review more than tripled while cost fell, with 97% of requests hitting the cache.

What they changed:

1. **A shared cache breakpoint.** They split the prompt so the prefix every review shares (tool definitions and agent prompt) gets its own breakpoint, and every repository reuses it.
2. **One cached first request for three reviewers.** The code quality, security and performance sub-reviewers send identical first requests. One writes the cache and the other two read it.
3. **Fewer LLM calls.** They removed a tool sub-reviewers had no use for, had reviewers read files in parallel, skipped unneeded reviewers on re-reviews and stopped jobs once the review was posted.
4. **Model and effort tuning.** They picked the model and effort level for each reviewer. Cloudflare attributes about 40% of the savings to code changes and the rest to these choices.

**Why I care:** token cost and usage limits are my biggest constraint with agents. About 40% of Cloudflare's savings needed no model change at all, only better ordering and fewer calls: put the parts that never change first and anything that changes per request at the end. I can check my own setup for that this week.

Source: [Cloudflare Blog, "Cutting our inference bill by 68% by being obsessive about optimization" (Oct 19, 2026)](https://blog.cloudflare.com/obsessive-inference-optimization/)

## 4. Anthropic previews Claude Duet

Claude Duet is Anthropic's new agent for professionals and small businesses, built on Claude Opus 5.5. TechCrunch reported on it on October 22.

- **What it does:** builds daily briefings and dashboards, suggests actions based on your data and runs tasks in the background on its own virtual machine, coming back when it needs approval.
- **Integrations:** more than 6,000 connectors and plugins through the Claude Marketplace.
- **Money:** it can buy things through Stripe's Link or Shopify's Shop Pay, but payments and other sensitive steps wait for your approval. It won't trade securities or move money between accounts.
- **Availability:** a research preview with a waitlist, for Pro and Max users, on iOS, Android and the web.

**Why I care:** most of running a small software company happens outside the code: email, follow-ups, invoices, keeping track of what's next. I'd trust an agent that does that work in the background and stops before anything involving money. I'll join the waitlist and see how it handles the non-code side of Foambyte.

Source: [TechCrunch, "Claude Duet app is Anthropic's bet on agents" (Oct 22, 2026)](https://techcrunch.com/2026/10/22/claude-duet-app-is-anthropics-bet-on-agents/)

## Takeaways

- **Diff before you swap a type checker.** tsrs reports up to 8x speed, but it still prints diagnostics differently from `tsc`. Run both on your own code first.
- **Treat skills like dependencies.** A skill ships scripts your agent will run. Read it before you install it, and watch for the AAIF's security guidance.
- **Order your prompts for the cache.** Stable content goes first, per-request content goes last. Cloudflare more than tripled tokens per review and still cut cost by 68%.
- **Look for approval gates in agents that touch money.** Claude Duet pauses before payments and refuses to move money between accounts.

---

*I'm Rodrigo Santiago, a product leader who builds. I co-founded [Foambyte](https://foambyte.com) with my brother Diego, a brewmaster who leads the product as CPO, and I designed and built the platform: architecture, frontend, backend, mobile and infrastructure. If you need someone who can own both the product and the code, [let's talk on LinkedIn](https://www.linkedin.com/in/rsdlt).*
