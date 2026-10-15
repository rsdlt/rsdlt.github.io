---
title: "Migrating from SQLite to PlanetScale Postgres 18 and TimescaleDB on Cloudflare Workers"
pubDatetime: 2026-10-13T09:00:00-04:00
description: "Why Foambyte moved from SQLite to PlanetScale Postgres 18 with TimescaleDB through Cloudflare Hyperdrive, and the playbook for a short, verifiable cutover."
tags: ["postgres", "planetscale", "timescaledb", "cloudflare hyperdrive", "drizzle", "database migration", "foambyte"]
---

On Sunday [Foambyte](https://foambyte.com) v1.3.0 shipped, and with it the biggest infrastructure change since the move to Cloudflare Workers: the database moved from **Bunny DB (SQLite)** to **PlanetScale Postgres 18** in AWS `us-east-1`, reached from Workers through **Cloudflare Hyperdrive**. The production cutover window was about 26 minutes, and no user data was lost.

This post covers why Postgres was the right call for this product, the Workers-specific details that make it fast and safe, and the migration playbook.

## Why Postgres, and why now

SQLite served the early product well. What changed is what the product needs next:

- **Time-series data.** Brewers log fermentation and carbonation readings over weeks, and sensor data from tanks is on the roadmap. **TimescaleDB** turns those tables into hypertables partitioned by time, without changing a single query.
- **Real types.** Native `boolean`, `jsonb`, `timestamptz` and `double precision` replace 0/1 integers, JSON stored as text, and epoch milliseconds. A whole category of conversion code disappears.
- **Replayable migrations.** Drizzle's Postgres migrator rebuilds the schema from scratch, which makes integration tests against a real database possible (the subject of the next post).
- **Operational safety.** PlanetScale gives point-in-time recovery and frequent automatic backups.
- **Location.** `us-east-1` sits next to Cloudflare's Ashburn location and is the best single region for Foambyte's users in Canada, the US, Mexico and Latin America.

The migration touched 25 tables and roughly 180 query call sites. Drizzle made that tractable: the schema moved from `sqlite-core` to `pg-core` and the query-builder code largely carried over. What needed rewriting was the raw SQL for JSON (`json_extract` became `#>>`, `json_each` became `jsonb_array_elements`) and the transactions.

> [!TIP]
> Map SQLite `real` to Postgres `double precision`, not `real`. Postgres `real` is a 4-byte float and will silently lose precision on values like gravity readings.

## Postgres from Workers: Hyperdrive and a per-request client

A Worker can't hold a long-lived connection pool, and opening a fresh TLS connection to Postgres on every request is slow. **Hyperdrive** solves that: it keeps warm connections to the database near the origin and hands the Worker a local connection string.

Two lessons from production:

- **Turn Hyperdrive's query caching off** for an app like this. Writes don't invalidate that cache, so a session, a plan limit or a read right after a save could come back stale.
- **Cap Hyperdrive's origin connections.** Right after the cutover, Hyperdrive's default origin pool used up every connection the database plan allows. Capping it per config fixed it.

Inside the Worker, every request gets exactly one Drizzle client, shared through `AsyncLocalStorage`:

```ts
export function getDb(env: Bindings): Db {
  const scope = requestScope.getStore();
  if (scope?.db) return scope.db;

  const pool = new Pool({ connectionString: env.HYPERDRIVE.connectionString, max: 5 });
  const db = drizzle({ client: pool });
  if (scope) scope.db = db;
  return db;
}
```

Auth, plan checks and handlers all reuse the same client within a request, and nothing is cached across requests, because a connection kept in global scope goes stale between Worker invocations. I use the `pg` driver because postgres.js over Hyperdrive is a documented compatibility issue.

## Concurrency: replacing SQLite's global write lock

SQLite's `BEGIN IMMEDIATE` takes a database-wide write lock, which quietly made "read, then write" sequences safe: count a user's recipes, then insert under their plan limit; read a batch, then advance its stage. Postgres's default `READ COMMITTED` isolation doesn't give that guarantee.

Rather than serialize the whole database, Foambyte takes a **per-user advisory lock** inside those transactions:

```ts
export async function lockUserForWrites(tx: Tx, userId: string) {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${userId}, 0))`,
  );
}
```

Two requests from the same user run one after the other; different users never block each other. The lock is released automatically when the transaction ends.

## TimescaleDB hypertables, and one surprising constraint

The readings tables become hypertables in a hand-written migration, guarded so that databases without TimescaleDB (like the in-process test database) keep plain tables and identical queries:

```sql
IF position('timescaledb' IN coalesce(current_setting('shared_preload_libraries', true), '')) > 0 THEN
  CREATE EXTENSION IF NOT EXISTS timescaledb;
  PERFORM create_hypertable('batch_ferm_cond_readings',
    by_range('date_time', INTERVAL '30 days'),
    if_not_exists => TRUE, migrate_data => TRUE);
END IF;
```

Hypertables require the time column in every unique key, so the primary key became `(id, date_time)`. The surprise came on staging: **TimescaleDB rejects an `UPDATE` that moves a row into a different chunk.** Editing a reading's date across a 30-day boundary failed with a check-constraint violation. The fix is a delete and re-insert inside one transaction, used only when the date changes:

```ts
return db.transaction(async (tx) => {
  const [existing] = await tx.delete(t).where(where).returning();
  if (!existing) return undefined;
  const [row] = await tx.insert(t).values({ ...existing, ...values }).returning();
  return row;
});
```

One caveat worth knowing before you choose a provider: managed services that offer only TimescaleDB's Apache edition give you hypertables and `time_bucket`, but not compression or continuous aggregates.

## The migration playbook

The principle was **rehearse everything except the switch.**

1. **Schemas, queries and tests moved together.** The code can't run on both databases at once, so it was one unit of work, finished with a green test suite.
2. **A one-transaction data copy.** The copy script reads the old database, converts types, checks foreign keys before writing anything, then truncates, inserts in dependency order and compares **row counts and per-table checksums**. It commits only if every table matches, so it can be re-run safely.
3. **Staging first.** Staging was cut over and exercised before production, with the old staging database kept as a fallback.
4. **A dry run and a full rehearsal** of the production copy into the empty production database.
5. **The window:** final backup of the old database, final copy, promote the release, smoke test.
6. **Verify, don't hope.** A diff script lists keys present in one database but not the other, and rows updated after the copy started, printing keys only and never row contents. It found a single session whose expiry had been extended mid-copy; no user data was missing.
7. **Keep the old database untouched** for two weeks as the rollback path.

From here on, schema changes are **expand-then-contract**: the frontend (Cloudflare Pages) and the API (Workers) deploy independently, so for a few minutes a new frontend may talk to an old API or the other way around, and every migration has to be safe for both.

## Takeaways

- **Choose the database for the next two years of data,** not the last one. Time-series readings made Postgres with TimescaleDB the clear fit.
- **On Workers, use Hyperdrive, one client per request, no caching for read-after-write workloads, and capped origin connections.**
- **Replace implicit locks explicitly.** If your old database serialized writes for you, find every read-then-write sequence and lock it deliberately.
- **Make the data copy atomic and verifiable,** and keep the old database as a rollback until you're sure.

---

*I'm Rodrigo Santiago, a product leader who builds. I designed and built [Foambyte](https://foambyte.com) end to end: architecture, frontend, backend, mobile and infrastructure. If you need someone who can own both the product and the code, [let's talk on LinkedIn](https://www.linkedin.com/in/rsdlt).*
