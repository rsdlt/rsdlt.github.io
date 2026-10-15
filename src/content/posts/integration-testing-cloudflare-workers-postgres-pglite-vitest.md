---
title: "Integration Testing a Cloudflare Workers API Against Real Postgres with PGlite"
pubDatetime: 2026-10-14T19:30:00-04:00
description: "How Foambyte runs 330+ Vitest integration tests against an in-process Postgres 18 with PGlite in about 10 seconds, including multi-tenant isolation tests."
tags: ["testing", "pglite", "vitest", "postgres", "cloudflare workers", "hono", "multi-tenant", "foambyte"]
---

After moving [Foambyte](https://foambyte.com) to [PlanetScale Postgres](/posts/planetscale-postgres-timescaledb-cloudflare-hyperdrive-migration/), I wanted the API's integration tests to run against **the same database engine as production**, not a mock and not a different SQL dialect. They also had to run inside Cloudflare's build, which gates every deploy, where there's no Docker to spin up a Postgres container.

**PGlite** solved both. It's Postgres compiled to WebAssembly, running in-process in Node. Foambyte's suite now boots the real Hono app against a real Postgres 18 for each test: about 330 tests across 49 files, in roughly 10 seconds.

## Why real Postgres instead of mocks

Mocked database calls test that your code calls the database the way you *think* it should. The bugs that hurt in production live in the gap:

- a `jsonb` operator that behaves differently from what you expected,
- a foreign key or check constraint that rejects a write,
- a `count()` that comes back as a string, because Postgres returns `bigint`,
- a query that forgets to filter by user.

Only a real engine catches those. Docker-based test databases do too, but they're slow to start and unavailable in many CI environments. PGlite gives the same engine at in-process speed.

## A migrated template, copied per test

Running every migration before every test would be slow. Instead, each test file migrates **once** into a template, dumps its data directory, and every test starts from a fresh copy:

```ts
// once per file
const pglite = new PGlite({ extensions }); // pg_trgm, unaccent
await migrate(drizzle({ client: pglite }), { migrationsFolder });
const template = await pglite.dumpDataDir("none");

// per test
const client = new PGlite({ loadDataDir: template, extensions });
```

The migrations under test are the same committed migrations that run in production, so a broken migration fails the suite before it can fail a deploy.

## Booting the real app with Workers bindings

The API reads its database from a Worker binding through `getDb(env)`. In tests, a setup file swaps that for a `TEST_DB` binding, and refuses to run without one:

```ts
vi.mock("@/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/db")>()),
  getDb: (env: { TEST_DB?: unknown }) => {
    if (!env?.TEST_DB) throw new Error("getDb called in a test without a TEST_DB binding");
    return env.TEST_DB;
  },
}));
```

Two Workers-specific details:

- The harness calls `app.fetch(request, env, executionCtx)` directly, because Hono's `app.request()` helper doesn't pass Workers-style `env` bindings through.
- It collects every `waitUntil` promise, so the test doesn't close the database while background work is still running.

## Two fake users, on purpose

Authentication is mocked at the better-auth boundary: the mocked session lookup reads an `x-test-user` header and returns one of two fixture sessions, `user-a` or `user-b`. Each test file registers that mock before importing the app, so the real middleware chain runs unchanged.

Having **two** users in every test environment is the point. Foambyte is multi-tenant: every query on user data must be scoped by user. With two tenants available by default, isolation tests are as easy to write as any other test.

## Defense-in-depth tests

The most valuable tests in the suite don't test the happy path. They **seed a state that should never exist** and prove the API still doesn't cross tenants.

For example: insert, directly into the database, a batch owned by user A that points at a tank owned by user B. Then, as user A, terminate the batch, delete it, and fetch summaries, and assert that user B's tank is untouched and its data never appears in A's responses.

If a future bug, a data import or a bad migration ever produces that state, the handlers are already proven not to make it worse. Scoping by user in every query is the first line of defense; these tests make sure there's a second.

## What PGlite can't test, and the staging suite that does

PGlite runs a single connection and no TimescaleDB, so two things need a real server:

- **Concurrency.** The per-user advisory lock that serializes a user's writes only means something with two real connections.
- **TimescaleDB behavior,** such as moving a reading into a different time chunk.

Those live in a small `test:staging` suite that runs on demand against the real staging database. Every write in it happens inside one Drizzle transaction that is **always rolled back**, by throwing a `Rollback` error at the end.

> [!WARNING]
> Don't wrap test writes in a raw `BEGIN`. The first version of the staging suite did, and Drizzle's own transaction inside the code under test issued a `COMMIT` that committed the test rows into staging. Use your ORM's transaction and throw to roll back; inner transactions then become savepoints, and nothing escapes.

## Tests as the deploy gate

There is no separate CI service. Cloudflare's build command for the app runs the license check, the type checks and this whole suite; if anything fails, nothing deploys. A ten-second suite is what makes that practical on every push.

## Takeaways

- **Test against the engine you run in production.** PGlite makes real Postgres as cheap as a mock.
- **Migrate once, copy per test.** Template databases keep a real-database suite fast.
- **Bake two tenants into the harness.** Isolation tests should be the default, not an afterthought.
- **Seed impossible states.** Defense-in-depth tests prove your API fails safe when the data is already wrong.
- **Know your test database's limits,** and cover them with a small, always-rolled-back suite against a real server.

---

*I'm Rodrigo Santiago, a product leader who builds. I designed and built [Foambyte](https://foambyte.com) end to end: architecture, frontend, backend, mobile and infrastructure. If you need someone who can own both the product and the code, [let's talk on LinkedIn](https://www.linkedin.com/in/rsdlt).*
