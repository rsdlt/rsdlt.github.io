---
title: "From Path Aliases to a Real Package: Lessons from a pnpm + Turborepo Monorepo"
pubDatetime: 2025-10-02T09:30:00-04:00
description: "How Foambyte's React app and Hono API share code in a pnpm + Turborepo monorepo, why path aliases broke Docker builds, and the setup that works."
tags: ["monorepo", "turborepo", "pnpm", "typescript", "architecture", "docker", "foambyte"]
---

[Foambyte](https://foambyte.com) started in early 2025 as a single Vite + Capacitor app. In April, when the API arrived, I moved everything into a **pnpm + Turborepo monorepo**: `apps/frontend`, `apps/server`, and room for shared packages. Six months in, the monorepo is one of the best decisions in the project, but the *shared code* part took two attempts to get right.

This post covers why a monorepo fits a product like this, the shortcut that broke, and the setup that works.

## Why a monorepo for a small team

- **One change, one commit.** A new field touches the database table, the API route and the form. In one repo, that's one reviewable change instead of three coordinated releases.
- **Shared types without publishing.** Schemas, enums and constants can be imported by both apps without a private npm registry.
- **One toolchain.** One lockfile, one TypeScript version, one set of scripts.

pnpm handles the workspace; Turborepo runs tasks across it in dependency order and caches the results.

```yaml
# pnpm-workspace.yaml
packages:
  - "apps/*"
  - "packages/*"
```

## Attempt 1: a shared folder behind path aliases

When the frontend and the server first needed the same enums and constants, I created `packages/shared` and pointed both apps at its source with path aliases:

```ts
// vite.config.ts
resolve: { alias: { "@shared": path.resolve(__dirname, "../../packages/shared/src") } }
```

```json
// tsconfig.json
"paths": { "@shared/*": ["../../../packages/shared/src/*"] }
```

It worked locally in minutes. Then the Docker builds broke. Each app's image was built with that app as its context, and a relative path that climbs out of the build context doesn't exist inside it. I tried build args, extra build contexts, and finally a symlink inside the Dockerfile to recreate the directory layout the alias expected. That last one worked, and it was a clear sign the structure was wrong.

> [!WARNING]
> Path aliases into another package's `src` are a hidden dependency. Your package manager doesn't know about it, your build tool doesn't know about it, and neither does Docker. It works until the first environment that doesn't share your folder layout.

## Attempt 2: a real internal package

The fix was to make the shared code a proper workspace package, `@repo/config-foambyte`, with its own `package.json`, a build step (rslib) that emits `dist/`, and an explicit dependency from each app:

```json
// apps/frontend/package.json
"dependencies": { "@repo/config-foambyte": "workspace:*" }
```

```ts
// simplified
import { RecipePatchSchema } from "@repo/config-foambyte";
```

Now pnpm knows the dependency exists, Docker builds just copy the workspace and install it, and imports look like any other package.

The shared package now holds the things both sides must agree on: Zod schemas, option enums, system constants, and the recipe patch merge logic.

## Make the build graph explicit

Once apps import the package's built output, `dist/` has to exist before anything else runs. Turborepo expresses that with `dependsOn: ["^build"]`, meaning "build my dependencies first", and it applies to `dev` and `test`, not just `build`:

```json
"tasks": {
  "build": { "dependsOn": ["^build"] },
  "check-types": { "dependsOn": ["^check-types"] },
  "test": { "dependsOn": ["^build"] },
  "dev": { "persistent": true, "cache": false, "dependsOn": ["^build"] }
}
```

Without the `dev` dependency, a fresh clone failed on `pnpm dev` because no `dist/` existed yet. A `prepare` script in the shared package adds a second guarantee by building it on install.

## One pnpm gotcha

pnpm's strict `node_modules` layout is a feature: packages can only import what they declare. Some libraries, though, expect their sub-packages to be hoisted. Our UI library worked locally and broke in the Docker build until its packages were hoisted explicitly in `.npmrc`:

```ini
public-hoist-pattern[]=*@heroui/*
```

Hoist narrowly, by pattern, instead of turning on `shamefully-hoist` for everything.

## Takeaways

- **A monorepo pays off as soon as two apps share a contract,** even for a team of one.
- **Shared code should be a real package** with a `package.json` and a declared dependency, not a path alias into someone else's `src`.
- **Encode build order in Turborepo** with `^build` for every task that consumes built output, including `dev`.
- **Treat Docker as your strictest environment:** if it can't build, your dependency graph has a hidden edge.

---

*I'm Rodrigo Santiago, a product leader who builds. I co-founded [Foambyte](https://foambyte.com) with my brother Diego, a brewmaster who leads the product as CPO, and I designed and built the platform: architecture, frontend, backend, mobile and infrastructure. If you need someone who can own both the product and the code, [let's talk on LinkedIn](https://www.linkedin.com/in/rsdlt).*
