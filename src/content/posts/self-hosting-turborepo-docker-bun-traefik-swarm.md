---
title: "Self-Hosting a Turborepo App with Docker, Bun, nginx and Traefik"
pubDatetime: 2025-10-09T09:00:00-04:00
description: "How Foambyte's React SPA and Hono API ran on a VPS: multi-stage Docker builds for a Turborepo monorepo, a Bun runtime, nginx, Traefik and Docker Swarm."
tags: ["docker", "bun", "turborepo", "traefik", "devops", "self-hosting", "foambyte"]
---

> [!NOTE]
> **Update, October 2026:** in February 2026 Foambyte's API moved from this setup to Cloudflare Workers. I wrote about that move in [Hono on Cloudflare Workers](/posts/hono-cloudflare-workers-middleware-security-rate-limiting/). This post describes the self-hosted setup as it ran in 2025.

[Foambyte](https://foambyte.com) is self-hosted on a VPS: the React web app, the Hono API, and a reverse proxy, all as Docker containers in a Docker Swarm stack. It's not the trendiest architecture, but it's cheap, fully under our control, and simple enough for one developer to operate.

This post walks through the parts that took the most iteration: Docker builds for a pnpm + Turborepo monorepo, small runtime images, and routing with Traefik.

## The stack

- **Traefik** as the reverse proxy: HTTPS with automatic Let's Encrypt certificates, HTTP-to-HTTPS redirects, and routing by hostname.
- **Frontend:** the static SPA served by **nginx**, three replicas.
- **API:** Hono running on **Bun**, two replicas.
- **Docker Swarm** to run it all, with secrets and an overlay network.

## Why Bun for the API

The server started on Bun. I briefly moved it to Deno, ran into problems getting it to work, and was back on Bun within a few days. With Bun everything ran smoothly: it runs TypeScript directly, installs and starts fast, and its bundler produces a self-contained output, which matters for image size.

## Building in a monorepo

The Dockerfiles live in each app, but the build context is the **repository root**, because each app depends on workspace packages. The build stage installs the workspace once and lets Turborepo build only what the app needs:

```dockerfile
# simplified
FROM node:20-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json .npmrc ./
COPY packages ./packages
COPY apps/server ./apps/server
RUN pnpm install --frozen-lockfile --filter=server...
RUN pnpm turbo build --filter=server...
```

`--filter=server...` means "the server and everything it depends on", so the shared package is built first and nothing unrelated is installed.

## A small runtime image

The runtime stage doesn't need pnpm, Node or `node_modules`. `bun build` bundles the server and its dependencies into `dist/`, so the final image is just Bun plus one folder:

```dockerfile
FROM oven/bun:alpine AS runtime
WORKDIR /app
COPY --from=build /app/apps/server/dist ./apps/server/dist
EXPOSE 3001
CMD ["bun", "./apps/server/dist/server.js"]
```

The pattern here is **install and build with the tools your monorepo uses, run with the smallest runtime that can execute the output.**

## Serving the SPA with nginx

The frontend image builds with Vite in the same way, then copies only `dist/` into `nginx:alpine`. Two details in the nginx config matter for a single-page app:

```nginx
location / {
  try_files $uri $uri/ /index.html;   # client-side routes fall back to the app
}
location /assets/ {
  add_header Cache-Control "public, max-age=31536000, immutable";
}
```

Vite fingerprints asset filenames, so they can be cached forever, while `index.html` stays fresh.

One monorepo-specific detail: the frontend imports route paths and types from the API's source for type safety, so the frontend build stage copies `apps/server` too, even though no server code ends up in the bundle.

## Secrets

Database credentials and the auth secret are **Docker Swarm secrets**, mounted as files under `/run/secrets/`. A small module reads them in production and falls back to environment variables in development:

```ts
// simplified
export function getSecret(name: string): string | undefined {
  if (process.env.NODE_ENV === "production") {
    return readFileSync(`/run/secrets/${name}`, "utf8").trim();
  }
  return process.env[name];
}
```

Secrets never appear in images, compose files or `docker inspect` output.

## CI: build only what changed

A GitHub Actions workflow builds and pushes the images. A path filter decides which apps changed, a matrix builds `frontend` and `server` in parallel with the repository root as context, and the GitHub Actions cache keeps Docker layers warm between runs. All the tooling runs inside Docker, so the CI runner doesn't need Node, pnpm or Bun installed.

## Takeaways

- **Build from the repository root** in a monorepo, and use Turborepo filters (`--filter=app...`) to build only what an app needs.
- **Separate build and runtime images:** bundle the server and ship it on a minimal runtime.
- **Serve SPAs with an SPA-aware fallback** and immutable caching for fingerprinted assets.
- **Use your orchestrator's secrets,** not environment variables baked into images.
- **Self-hosting is a valid early choice** when it keeps costs low and you're comfortable owning the operations; just be honest about the time it takes.

---

*I'm Rodrigo Santiago, a product leader who builds. I co-founded [Foambyte](https://foambyte.com) with my brother Diego, a brewmaster who leads the product as CPO, and I designed and built the platform: architecture, frontend, backend, mobile and infrastructure. If you need someone who can own both the product and the code, [let's talk on LinkedIn](https://www.linkedin.com/in/rsdlt).*
