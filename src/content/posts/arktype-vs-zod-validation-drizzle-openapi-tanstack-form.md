---
title: "ArkType vs Zod: Why I Standardized on Zod Across Forms, API and Database"
pubDatetime: 2025-06-26T08:30:00-04:00
description: "I started Foambyte with ArkType and switched to Zod. The deciding factor wasn't speed or syntax but integrations: drizzle-zod, zod-openapi and TanStack Form."
tags: ["zod", "arktype", "validation", "typescript", "drizzle", "openapi", "tanstack form", "foambyte"]
---

A month ago, [Foambyte](https://foambyte.com)'s login form validated with **ArkType**, and the first server schemas used `drizzle-arktype`. Last week I replaced both with **Zod**. ArkType is an excellent library: fast, with a concise, TypeScript-like syntax. The switch wasn't about the library itself. It was about where validation has to plug in.

This post is about choosing a validation library at the architecture level, and why integrations beat benchmarks.

## Where validation lives in a full-stack TypeScript app

In Foambyte, the same data shape is checked in at least four places:

1. **Database:** schemas derived from the Drizzle tables, for inserts and updates.
2. **API input:** every request body and parameter validated before a handler runs.
3. **API documentation:** the OpenAPI spec that describes those same shapes.
4. **Forms:** field validation in the React app, with translated error messages.

If each layer uses a different library, or a library that some layers don't support, you end up maintaining the same rules twice and hoping they agree.

## The evaluation

When I wired up the API's OpenAPI documentation, I briefly tried the options side by side: ArkType's Hono validator, Valibot with `drizzle-valibot`, and the third-party `hono-openapi` package, next to `@hono/zod-openapi` and `drizzle-zod`.

The comparison came down to one question: **which library has first-class support at every layer?**

| Layer | Zod | ArkType (at the time) |
| --- | --- | --- |
| Drizzle table → schema | `drizzle-zod` | `drizzle-arktype` |
| Hono routes + OpenAPI docs | `@hono/zod-openapi` (official, typed routes and docs from one definition) | Validator only; docs need a separate tool |
| TanStack Form | Supported (Standard Schema) | Supported (Standard Schema) |

The deciding row is the middle one. `@hono/zod-openapi` gives me **one route definition** that validates the request, types the handler and generates the OpenAPI spec. Nothing else on the list matched that without stitching tools together.

## Before and after

The login form's validators show how small the switch was, because TanStack Form accepts any [Standard Schema](https://standardschema.dev) library:

```ts
// Before: ArkType
const Email = type("string.email").configure({
  message: () => intl.formatMessage({ id: "login.email.error", defaultMessage: "Must be a valid email address." }),
});
// validators={{ onBlur: Email }}
```

```ts
// After: Zod 4
import { z } from "zod/v4";

validators={{
  onBlur: z.email({ error: intl.formatMessage({ id: "login.email.error", defaultMessage: "Must be a valid email address." }) }),
}}
```

On the server, the table becomes the source of the schemas:

```ts
export const sBrewHouseSystemSchema = createSelectSchema(brewHouseSystemsTable);
export const iBrewHouseSystemSchema = createInsertSchema(brewHouseSystemsTable);
export const uBrewHouseSystemSchema = createUpdateSchema(brewHouseSystemsTable);
```

Those schemas feed straight into route definitions, so a column added to the table shows up in validation, handler types and docs at once.

> [!TIP]
> Standard Schema made this migration cheap. Because TanStack Form speaks the Standard Schema interface, swapping libraries in forms was a local change. Prefer tools that accept Standard Schema: they keep the validation-library decision reversible.

## What I gave up

- **Raw speed.** ArkType is faster at validation. For a CRUD API validating request bodies of a few kilobytes, that difference is invisible next to network and database time.
- **Syntax.** ArkType's string syntax is concise and pleasant. Zod is more verbose, but its API is the one most TypeScript developers already know, which matters for anyone reading the code later.

## Why Zod 4

Zod 4 landed at the right time. It's significantly faster than Zod 3, ships smaller builds, and has top-level formats like `z.email()` and a unified `error` option for messages. That made the performance gap with ArkType smaller, and the error API fits react-intl translations cleanly.

## Takeaways

- **Choose a validation library by its integration points,** not by microbenchmarks. The best library is the one every layer of your stack speaks natively.
- **One schema, many uses:** database, API input, API docs and forms should derive from the same definitions.
- **Run a short, side-by-side spike** before committing. Trying the options against real routes made the decision obvious.
- **Favor Standard Schema-compatible tools** to keep library choices reversible.

---

*I'm Rodrigo Santiago, a product leader who builds. I co-founded [Foambyte](https://foambyte.com) with my brother Diego, a brewmaster who leads the product as CPO, and I designed and built the platform: architecture, frontend, backend, mobile and infrastructure. If you need someone who can own both the product and the code, [let's talk on LinkedIn](https://www.linkedin.com/in/rsdlt).*
