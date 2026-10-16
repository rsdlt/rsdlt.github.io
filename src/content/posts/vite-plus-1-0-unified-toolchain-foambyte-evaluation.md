---
title: "Vite+ 1.0 Is Out: Should Foambyte Trade Its Toolchain for One Command?"
pubDatetime: 2026-10-16T10:00:00-04:00
description: "What VoidZero shipped in Vite+ 1.0, a unified vp command for Vite, Vitest, Oxlint, Oxfmt, tsdown and caching tasks, and the pros and cons we're weighing for Foambyte."
tags: ["vite", "vite plus", "vitest", "oxc", "tooling", "monorepo", "turborepo", "foambyte"]
---

On September 28, VoidZero [announced Vite+ 1.0](https://voidzero.dev/posts/announcing-vite-plus-1-0), the team behind Vite, Vitest, Rolldown and Oxc. It's a single toolchain behind a single command, `vp`, and a single `vite.config.ts`.

[Foambyte](https://foambyte.com) already uses most of the pieces Vite+ packages: Vite for the React app, Vitest for 660+ unit and integration tests, and a pnpm + Turborepo monorepo stitching it all together. So the question isn't whether Vite+ is interesting. It's whether swapping our hand-assembled toolchain for one opinionated package is worth it. We're evaluating that now. This post covers what shipped and where we've landed so far.

## What Vite+ 1.0 is

Vite+ is a toolchain, not a framework or a package manager, and not a replacement for Vite. One `vite-plus` dependency replaces a stack of separate tools, each with its own config, release cadence and upgrade path:

| Command      | What it runs                                  | Replaces                  |
| ------------ | --------------------------------------------- | ------------------------- |
| `vp dev`     | Vite 8 dev server with HMR                    | `vite`                    |
| `vp build`   | Vite 8 + Rolldown production build            | `vite build`              |
| `vp check`   | Oxlint, Oxfmt and type checking               | ESLint, Prettier, `tsc`   |
| `vp test`    | Vitest (unit, component, browser)             | `vitest`                  |
| `vp pack`    | tsdown library builds and binaries            | tsup, rslib and similar   |
| `vp run`     | Vite Task, a monorepo task runner with caching | Turborepo                 |
| `vp env`     | Node.js version management                    | nvm, mise (for Node)      |
| `vp install` | Your package manager of choice                | n/a, it wraps pnpm/npm/…  |

There are also `vp create` for new projects, `vp migrate` for existing ones (it shows its plan before touching files), `vp hooks` and `vp staged` for Git hooks, and `vp toolchain` to see the exact version of every bundled tool. CI gets a `setup-vp` action for GitHub Actions and GitLab that combines Node setup, package manager setup and dependency caching into one step.

A few details from the announcement stand out:

- **It's MIT licensed and free.** No paid tier is mentioned.
- **The speed claims are big:** Oxlint "50x to 100x faster than ESLint," Oxfmt "up to 30x faster than Prettier," and a native React Compiler in Oxc "10x faster than the Babel plugin it replaces." These are VoidZero's numbers; I haven't benchmarked them on our code yet.
- **Adoption is real:** close to two million weekly downloads and 2,600+ public repositories depending on it.
- **It's honest about gaps.** The team says 1.0 is "far from feature-complete." Remote caching, deeper monorepo diagnostics, `vp release` and `vp docs` are still on the roadmap.

## How Foambyte's toolchain looks today

For context, here's what Vite+ would be replacing:

- **Frontend:** React 19 + Vite with the React Compiler running as a [Babel plugin](/posts/react-compiler-vite-react-19-production-app/), plus ESLint and its React Compiler rule.
- **API:** Hono on Cloudflare Workers, built and deployed with Wrangler.
- **Shared code:** an internal package, `@repo/config-foambyte`, built with rslib.
- **Tests:** Vitest for [unit tests](/posts/unit-testing-brewing-calculators-vitest-ibu-srm-carbonation/) and [integration tests against PGlite](/posts/integration-testing-cloudflare-workers-postgres-pglite-vitest/).
- **Orchestration:** pnpm workspaces and [Turborepo](/posts/pnpm-turborepo-monorepo-shared-package-lessons/), with `dependsOn: ["^build"]` encoding the build graph.
- **Versions:** mise pins Node and pnpm.

That's at least seven tools with seven configs, and every one of them works. That matters for what follows.

## The pros

**1. One config and one upgrade path.** Today a Vite major means checking that Vitest, the React plugin, ESLint plugins and Turborepo all still agree. Vite+ ships those as one tested set, and `vp toolchain` tells you exactly what you're running. For a small team, fewer moving parts to keep in sync is the main benefit.

**2. Dropping Babel from the frontend build.** Our React Compiler setup is the one place where we knowingly accepted a slower pipeline: passing a Babel plugin makes `@vitejs/plugin-react` run Babel over every component. A native compiler in Oxc removes that trade-off.

**3. Much faster checks, in CI and for agents.** Linting and formatting run on every change. Most of Foambyte's code is written with [Claude Code](/posts/claude-code-production-saas-ai-coding-guardrails/), and the agent runs those checks many times per change. A check loop that drops from seconds to well under a second compounds across a day of work. `vp staged` also gives us a fast pre-commit gate without adding husky and lint-staged.

**4. The tools we already use, just packaged.** This isn't a jump to an unfamiliar stack. Vite and Vitest stay Vite and Vitest; our 660+ tests shouldn't need to change. The risk is concentrated in the parts that are new to us: Oxlint, Oxfmt and Vite Task.

**5. Fewer devDependencies to audit.** One `vite-plus` package in place of `vite`, `vitest`, `eslint` and its plugins, a formatter and `turbo` means a smaller surface for supply-chain review and fewer Dependabot PRs.

## The cons

**1. Turborepo is solved, and remote caching isn't there yet.** Our Turborepo setup took [two attempts to get right](/posts/pnpm-turborepo-monorepo-shared-package-lessons/), and it works. `vp run` caches locally, but remote caching is still on the roadmap. Replacing a working, well-understood task graph with a 1.0 runner is the riskiest part of a migration for the smallest gain.

**2. Lint rule parity has to be proven, not assumed.** Our ESLint config isn't just style. The React Compiler rule is an error because it's how we know which components the compiler can optimize. Before switching, we need to confirm Oxlint covers every rule we actually rely on, or keep ESLint alongside it, which defeats part of the point.

**3. Not everything is a Vite project.** The API builds with Wrangler and its own bundler, and the Workers runtime has its own testing considerations. Vite+ can lint, format, type-check and test it, but it won't replace Wrangler. The mobile builds go through Capacitor and Xcode/Android Studio. "One toolchain" covers less of our pipeline than the pitch suggests.

**4. Bundling means coupling.** Today we can upgrade Vitest without touching the formatter. With Vite+, every tool moves on one release train. That's a pro when the set is well tested and a con when one bundled tool has a regression we can't pin around.

**5. Overlap with mise.** `vp env` manages Node, but mise already pins Node and pnpm for this repo and other tools in my setup. Two version managers for the same runtime is a recipe for "works on my machine." We'd keep mise and ignore `vp env`, or move fully, but not both.

**6. Vendor concentration.** Vite+ is MIT licensed, so lock-in is limited in practice. Still, the bundler, linter, formatter, test runner and task runner would all come from one company, and the announcement page notes that VoidZero is joining Cloudflare. Foambyte already runs on Cloudflare, so that's probably good for Workers support. It's also a reason to watch where the roadmap goes.

## How we're evaluating it

Rather than a big-bang `vp migrate`, the plan is to adopt Vite+ in slices, each one reversible on its own:

1. **Run `vp check` next to our current ESLint setup in CI** for a couple of weeks and compare findings. If Oxlint misses rules we depend on, we'll know before anything is removed.
2. **Move the shared package** from rslib to `vp pack`. It's small, isolated and easy to verify: the apps either import the same `dist/` or they don't.
3. **Switch the frontend to the native React Compiler** and compare build times and the compiled output on a few components.
4. **Leave Turborepo alone** until `vp run` has remote caching and has been in the wild for a few more months.

Each step has a clear signal: same findings, same output, faster. If a step doesn't deliver, it gets rolled back and the rest of the toolchain stays as it is.

## Takeaways

- **Vite+ 1.0 is a real toolchain, not a wrapper:** one command and one config over Vite 8, Vitest, Oxlint, Oxfmt, tsdown and a caching task runner, all MIT licensed.
- **The strongest case is speed and fewer moving parts,** especially for teams that run checks constantly, like ones working with AI coding agents.
- **The weakest case is replacing things that already work,** like a tuned Turborepo graph, before the roadmap catches up.
- **Adopt it in slices.** Start with checks and small packages, measure, and keep each step reversible.

I'll follow up with numbers once the first two steps are done.

---

*I'm Rodrigo Santiago, a product leader who builds. I co-founded [Foambyte](https://foambyte.com) with my brother Diego, a brewmaster who leads the product as CPO, and I designed and built the platform: architecture, frontend, backend, mobile and infrastructure. If you need someone who can own both the product and the code, [let's talk on LinkedIn](https://www.linkedin.com/in/rsdlt).*
