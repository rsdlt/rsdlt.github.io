---
title: "How I Use Claude Code on a Production SaaS Without Vibe Coding"
pubDatetime: 2026-10-15T10:00:00-04:00
description: "The guard rails behind AI-assisted development at Foambyte: CLAUDE.md as a contract, pinned skills, permission denies, diff review, audits and deploy gates."
tags: ["claude code", "ai coding agents", "software engineering", "sdlc", "security", "testing", "foambyte"]
---

I wrote every line of [Foambyte](https://foambyte.com)'s first versions by hand. Today a large share of its code is written by AI coding agents, mostly **Claude Code**. Foambyte is a production platform holding real brewers' data, so "let the model write it and see if it runs" was never an option.

The difference between vibe coding and engineering with agents isn't the tool. It's the system around it. This post describes that system: what the agents know, what they're not allowed to do, and how their work is verified before it reaches production.

## The principle: run the agent like an engineering team

An AI coding agent is fast, tireless and well read, and it has no memory of your project's decisions. That's the profile of a capable new engineer on day one. I give it what I'd give a new engineer:

1. **Written context:** how the system works and the rules that aren't negotiable.
2. **Hard limits** on actions that are dangerous or irreversible.
3. **Review** of every change.
4. **Automated gates** that don't care who wrote the code.

## 1. CLAUDE.md is an architecture contract

The root `CLAUDE.md` is about a hundred lines. It isn't a prompt with tips. It's the project's architecture and rules, written precisely enough that a reader can't misinterpret them:

> Every query on user data must be scoped by `userId` […] keep that pattern for new writes.

> All numeric values sent to the server must be in canonical metric units […]

> Keep it at zero: the Cloudflare build fails on any error.

It also describes how the system fits together: the four-file structure of an API route, the query-key/query-options/mutation-options pattern on the frontend, how releases flow from staging to production, and why database migrations must be expand-then-contract.

The important habit: **`CLAUDE.md` changes with the code.** When a decision is made, such as moving to Postgres, adding a new package or tightening a rule, the document is updated in the same piece of work. An agent working from a stale contract makes confident, wrong changes.

## 2. Skills: reusable expertise, pinned like dependencies

Beyond the project rules, the repo has 24 **skills**: focused guides the agent loads when it works in a specific area, such as Drizzle, Hono, TanStack Query, Cloudflare Workers, Postgres, Capacitor, better-auth security, accessibility, and security hardening.

Two practices make them safe to rely on:

- **Third-party skills are pinned.** A lock file records each skill's source and a SHA-256 hash of its content. Instructions that shape generated code are a supply-chain input, and they deserve the same treatment as an npm dependency.
- **Domain rules get their own skills.** The `canonical-units` skill is written for Foambyte: every value sent to the server must be converted to metric units first, which it states as "non-negotiable". Brewing unit bugs are silent and expensive, so the rule is spelled out where the agent will see it.

## 3. Hard guard rails: what agents cannot do

Some actions are too consequential to leave to instructions alone. For those, the rule exists twice: once in prose, and once as a hard deny in Claude Code's permission settings, which the agent can't override:

```json
{
  "permissions": {
    "deny": [
      "Bash(*db:migrate*)",
      "Bash(*drizzle-kit migrate*)",
      "Bash(*drizzle-kit push*)",
      "Bash(*restore:pg*)",
      "Bash(git push *)"
    ]
  }
}
```

- **Database migrations:** the agent can *generate* a migration from schema changes, then it must stop and hand it to me. I apply migrations myself, from my machine, after reading the SQL.
- **Pushing code:** the agent commits locally; I push. Nothing reaches staging or production without my explicit action.

The infrastructure adds a third layer. The application's database role has read and write access to data but **can't run DDL**, so even a mistake made with application credentials can't drop a table.

## 4. I review every diff

Everything the agent writes, I read before it's committed. In practice, that shapes how work is done:

- **Small, focused changes.** One concern per commit, so each diff can be reviewed properly.
- **Commit messages explain why,** not just what, and reference the decision or the audit item behind the change.
- **Transparency in the history.** Every agent-assisted commit carries a `Co-Authored-By` trailer, so anyone reading the history can see which work was AI-assisted.

Review is where architecture actually gets enforced. The agent proposes; I decide.

## 5. Gates that don't care who wrote the code

The deploy pipeline is the final reviewer. Cloudflare's build command for the app runs:

- **a license check** on every dependency, against an allow-list policy;
- **type checks with zero errors** on the frontend, the server and the shared packages;
- **the full test suite:** about 1,200 test cases across the apps and packages, including integration tests against a real Postgres engine.

If any of them fails, nothing deploys. Releases go to **staging first**, versioned with Changesets, and are promoted to production only after they've been verified there. A separate smoke suite runs against the real staging database inside transactions that are always rolled back.

Zero type errors wasn't the starting point. The server started with a baseline of 11 errors and the frontend with 547. A ratchet prevented the count from growing while the agents and I drove both to zero, and then the check became strict. Gates like this are what make agent speed safe: the agent can move quickly precisely because mistakes are caught mechanically.

## 6. Security audits, then fixes with regression tests

I also use agents to **audit** the codebase, with a structured methodology: a threat model first, then a STRIDE analysis, then a detailed checklist across authorization, authentication, plan entitlements, the Workers runtime, the database, email, the frontend, the mobile apps and the supply chain. Findings are verified a second time before they count, and anything that needs a judgment call is flagged for a human decision rather than "fixed" automatically.

Each accepted finding gets an ID. The fix cites that ID in the code and, where it makes sense, comes with a test that proves it. The multi-tenant isolation tests in Foambyte's API came from exactly this process: they seed a state that should never exist (one user's batch pointing at another user's tank) and prove the API never touches the other user's data.

The audit reports themselves are kept out of the repository; only the fixes and their tests are committed.

## 7. Extra safety nets for risky changes

Some changes deserve more than review and tests. Moving Foambyte's recipe calculation engine from the browser to the server is a good example:

1. **Golden masters first:** snapshot the engine's full output for six reference recipes across every calculation path.
2. **Extract** the engine into a pure function, with the snapshots unchanged.
3. **Move it to the server** and run it in **shadow mode**: every save was also recalculated on the server without being stored, and the result logged as a match or mismatch against the client within a tolerance of one part in a billion.
4. **Switch** the server to be the source of truth only after production showed matching results.
5. **Lock it in** with a build plugin that fails the frontend build if any engine code ends up in the browser bundle.

An agent did most of the typing in that sequence. The sequence itself, and the decision at each step to proceed, was mine.

## What I don't delegate

- **Architecture and data-model decisions.**
- **Database migrations and production releases.**
- **Security trade-offs** flagged by audits.
- **The final read of every diff.**

## Takeaways

- **Vibe coding is a process failure, not a tool failure.** Agents are safe when the system around them is.
- **Write the contract down** (`CLAUDE.md`, skills) and update it with every decision.
- **Back critical rules with hard permissions,** least-privilege credentials, and a human hand on migrations and pushes.
- **Review every diff** and keep AI-assisted work visible in the history.
- **Let gates do the policing:** zero type errors, a full test suite, license checks and staging-first releases.
- **Use agents for audits too,** and turn every finding into a fix with a test.

---

*I'm Rodrigo Santiago, a product leader who builds. I co-founded [Foambyte](https://foambyte.com) with my brother Diego, a brewmaster who leads the product as CPO, and I designed and built the platform: architecture, frontend, backend, mobile and infrastructure. If you need someone who can own both the product and the code, [let's talk on LinkedIn](https://www.linkedin.com/in/rsdlt).*
