---
title: "End-to-End Type Safety Without tRPC: A Shared Hono + Zod OpenAPI Contract"
pubDatetime: 2026-07-23T08:45:00-04:00
description: "How Foambyte's React frontend and Hono API share one type-checked contract in a Turborepo monorepo: Drizzle, drizzle-zod, zod-openapi and shared route paths."
tags: ["typescript", "hono", "zod", "openapi", "drizzle", "monorepo", "api design", "foambyte"]
---

The most expensive bug in a product with a single developer is the one where the frontend and the API quietly disagree. A field gets renamed on the server, the UI still compiles, and a brewer finds out in production when a form stops saving.

In [Foambyte](https://foambyte.com) that class of bug can't reach a deploy, because the frontend and the API are type-checked against the same contract. This post explains how that contract is built, and why I chose OpenAPI over tRPC or an RPC client.

## One monorepo, one source of truth

Foambyte is a **pnpm + Turborepo** monorepo. The pieces that matter here:

- `apps/server`: the Hono API.
- `apps/frontend`: the React app (web, iOS and Android, covered in the [previous post](/posts/react-capacitor-tanstack-one-codebase-web-ios-android/)).
- `packages/config-foambyte`: the shared package. It holds the **Drizzle table definitions**, the **zod schemas generated from them**, unit preferences and plan entitlements.

The shared package is the root of the contract. Everything else is derived from it.

## The schema pipeline

Types flow in one direction, from the database table to the API docs:

1. **Drizzle table**: the column definitions live once, in the shared package.
2. **drizzle-zod** generates select, insert and update schemas from that table.
3. **zod-openapi routes** use those schemas for request bodies and response envelopes.
4. **Handlers** are typed by their route, so `c.req.valid("param")` is already parsed and typed.
5. **OpenAPI 3.1** is generated from the routes and rendered with [Scalar](https://scalar.com).

```ts
// shared package
export const sBatchSchema = createSelectSchema(batchTable);

// server route
responses: {
  [HttpStatusCodes.OK]: jsonContent(
    z.object({ batch: sBatchSchema }),
    "The requested batch.",
  ),
}
```

Rename a column and the change ripples: the zod schema changes, the route's response type changes, and every consumer that relied on the old name stops compiling.

## Four files per resource

Every API resource follows the same split. Here's `batches`:

**`batches.paths.ts`: route patterns and client URL builders, side by side.**

```ts
export const batchRoutes = {
  batchSummary: "/batches/summary" as const,
  one: "/batches/{batchId}" as const,
};

export const batchUrls = {
  batchSummary: () => batchRoutes.batchSummary,
  one: (batchId: string | undefined) => `/batches/${batchId}` as const,
};
```

**`batches.routes.ts`: the OpenAPI definition.**

```ts
export const one = createRoute({
  middleware: [requireSession],
  path: batchRoutes.one,
  method: "get",
  request: { params: BatchIdParamsSchema },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(GetOneResponseSchema, "The requested batch."),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, "Batch not found."),
  },
});
```

**`batches.handlers.ts`: the implementation, typed by the route.**

```ts
export const one: AppRouteHandler<OneRoute> = async (c) => {
  const { batchId } = c.req.valid("param");
  // ...
};
```

**`batches.index.ts`: registration.**

```ts
const router = createRouter()
  .openapi(routes.list, handlers.list)
  .openapi(routes.batchSummary, handlers.batchSummary)
  .openapi(routes.one, handlers.one);
```

> [!WARNING]
> Registration order matters. `/batches/summary` must be registered before `/batches/{batchId}`, or the router will happily treat `summary` as a batch id.

The split looks verbose, but each file has exactly one reason to change, and the `paths` file is the one the frontend imports.

## How the frontend consumes the contract

The frontend has a `@server` alias that points at the server's source. It imports **paths and types only**, never server logic:

```ts
import type { Batch } from "@repo/config-foambyte/schemas";
import { batchUrls } from "@server/routes/batches/batches.paths.ts";
import type { BatchSummaryEnvelope } from "@server/routes/batches/batches.routes.ts";

queryFn: () => fapi.request("GET", batchUrls.one(batchId!)),
```

Two details make this robust:

- **URL strings are written once.** No hand-typed `"/batches/" + id` anywhere in the frontend.
- **The frontend type-checks the server files it imports under its own, stricter settings** (`noUncheckedIndexedAccess`, no Node types). A breaking change on the server fails the frontend's `tsc`, and the type check is part of the build gate. It never reaches a deploy.

## Why not tRPC or the Hono RPC client?

I tried Hono's `hc` RPC client early on and removed it. Inferred RPC clients are elegant, but for this product an explicit OpenAPI contract is the better architecture:

- **OpenAPI is a standard, not a library.** The same contract produces interactive docs today and can serve a public API, partner integrations or generated SDKs later, without a rewrite.
- **The API stays plain REST.** URLs are cacheable, loggable and debuggable with `curl`. The mobile apps, the web app and any future client speak the same protocol.
- **One HTTP client for every platform.** The frontend's `fapi` wrapper owns retries, credentials and typed errors in one place, instead of delegating them to a generated client.
- **Type-check cost stays flat.** Inferring a whole router's types into the client gets slow as the API grows. Importing a handful of named types and URL builders doesn't.

The honest trade-off: response types on the client are **asserted, not validated at runtime**. The server validates every request with zod and answers malformed input with a `422` before the handler runs, so inbound data is always safe. Outbound shapes are guaranteed by the shared types at compile time, which has proven sufficient in practice.

## The contract includes units

A contract isn't only shapes. In Foambyte, **every number sent to the API is in canonical metric units**, and the default unit preferences live in the same shared package as the schemas. The frontend converts for display and back before each mutation. Making units part of the contract removed an entire category of "it saved 20 instead of 68" bugs.

## Takeaways

- **Derive, don't duplicate.** One Drizzle table generates the validation schemas, the API types and the docs.
- **Share paths, not just types.** URL builders in a shared module eliminate a surprising number of bugs.
- **Make the compiler your integration test.** If the frontend type-checks the server's route files, API drift becomes a build failure.
- **Prefer standards at boundaries.** OpenAPI keeps the door open to integrations that an RPC protocol would close.

Next, I'll go one layer down: running this API on Cloudflare Workers, and the middleware order that keeps it safe.

---

*I'm Rodrigo Santiago, a product leader who builds. I co-founded [Foambyte](https://foambyte.com) with my brother Diego, a brewmaster who leads the product as CPO, and I designed and built the platform: architecture, frontend, backend, mobile and infrastructure. If you need someone who can own both the product and the code, [let's talk on LinkedIn](https://www.linkedin.com/in/rsdlt).*
