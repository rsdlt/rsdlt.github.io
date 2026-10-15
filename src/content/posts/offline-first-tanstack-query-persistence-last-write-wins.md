---
title: "Offline-First Editing with TanStack Query Persistence and Last-Write-Wins Patches"
pubDatetime: 2025-09-26T10:00:00-04:00
description: "How Foambyte kept recipe edits working offline: a persisted TanStack Query cache, a last-write-wins patch queue, and one merge function shared with the server."
tags: ["offline-first", "tanstack query", "react", "capacitor", "immer", "sync", "foambyte"]
---

> [!NOTE]
> **Update, October 2026:** Foambyte no longer ships this offline layer; it was removed in 2026 and the app now works online-first. This post describes the design as it was in September 2025. The patterns still apply if your product needs offline editing.

Brewers don't always work where the Wi-Fi is good. At [Foambyte](https://foambyte.com) we expect brewers to need their recipes when the connection drops: in a cellar, a cold room, or a brewhouse with thick walls. This week Foambyte gained offline support for its core document, the recipe: brewers can open recipes they've already loaded, keep editing them offline, and their changes reach the server when the connection comes back.

Here's the design, and why I chose a deliberately simple sync model.

## Three pieces

1. **A persisted query cache**, so recipes already loaded are available offline.
2. **A pending-patch queue** with last-write-wins semantics, so offline edits survive and get sent once.
3. **One merge function shared by client and server**, so both sides apply a patch the same way.

## 1. Persisting the TanStack Query cache

TanStack Query already holds every recipe the user has opened. Persisting that cache to storage makes it survive restarts and connection loss:

```ts
const asyncLocalStorage = {
  getItem: async (key: string) => localStorage.getItem(key),
  setItem: async (key: string, value: string) => { localStorage.setItem(key, value); },
  removeItem: async (key: string) => { localStorage.removeItem(key); },
};

export const persister = createAsyncStoragePersister({
  storage: asyncLocalStorage,
  key: "FOAMBYTE_QUERY_CACHE",
});

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: Infinity, gcTime: 7 * 24 * 60 * 60 * 1000 },
    mutations: { networkMode: "offlineFirst", retry: false },
  },
});
```

The app root wraps everything in `PersistQueryClientProvider` with a seven-day `maxAge`. Two settings matter:

- **`gcTime` must be at least as long as the persistence window.** Otherwise Query garbage-collects data before it's ever written to storage.
- **`networkMode: "offlineFirst"` on mutations** means a mutation started offline pauses instead of failing, and resumes when the app is back online.

## 2. A last-write-wins patch queue

Recipe edits are small partial updates (patches). Offline, a brewer might change the boil time five times; sending five requests on reconnect would be wasteful and order-sensitive. Instead, the app keeps **one merged patch per recipe** in local storage:

```ts
const result = RecipePatchSchema.safeParse(finalPatch);
if (Object.keys(finalPatch).length) applyOptimistic(recipeId, finalPatch);

if (!onlineManager.isOnline()) {
  const pending = readPending();
  pending[recipeId] = mergePatch(pending[recipeId], finalPatch);
  writePending(pending);
  return;
}
```

The UI updates optimistically either way, so the brewer sees their change immediately. On reconnect, the app resumes paused mutations and flushes the queue: **one `PATCH` per recipe**, then clears the entry.

Detecting "online" needed care on mobile. The app only treats itself as online when both Capacitor's Network plugin and the browser's `online` event agree, which avoids flushing during a flaky half-connection.

## Why last-write-wins

Real-time collaborative sync (CRDTs, operational transforms) solves concurrent editing by many users. Foambyte's recipes are edited by **one brewer at a time**, usually on one device. For that workload, last-write-wins is:

- **Predictable:** the latest edit is what's saved, which is what users expect.
- **Small:** no vector clocks, tombstones or merge UI.
- **Cheap to reason about** when something goes wrong.

The trade-off is explicit: if the same recipe is edited on two devices while one is offline, the last one to sync wins. For this product today, that's an acceptable edge case, and far cheaper than building a sync engine.

## 3. One merge function, shared by client and server

A patch only means something if the client and the server apply it identically. So the merge rules live in one function in the shared package, written to work with Immer drafts:

- top-level fields are assigned;
- each nested section of the recipe (vitals, brewhouse, mash and boil, carbonation, economics…) is merged field by field;
- arrays like ingredients and mash steps are replaced whole.

```ts
export function mergePatch(base: RecipePatch | undefined, patch: RecipePatch): RecipePatch {
  return produce(base ?? {}, (draft) => {
    applyRecipePatchMerge(draft, patch);
  });
}
```

The server runs the **same** `applyRecipePatchMerge` inside an Immer `produce` on the stored recipe, after validating the patch with the same Zod schema the client used. Client and server can't drift, because there's only one implementation.

> [!TIP]
> Replace arrays whole in patches instead of merging them element by element. Merging arrays by index is where patch semantics usually go wrong, for example deleting the second ingredient and editing the third in the same offline session.

## Takeaways

- **Start offline support with the cache you already have:** persisting TanStack Query covers reads with very little code.
- **Coalesce offline writes:** one merged patch per document beats a replayed log of every keystroke.
- **Choose the simplest consistency model your usage allows.** Single-editor documents rarely need CRDTs.
- **Share merge logic between client and server,** and validate patches with the same schema on both sides.

---

*I'm Rodrigo Santiago, a product leader who builds. I co-founded [Foambyte](https://foambyte.com) with my brother Diego, a brewmaster who leads the product as CPO, and I designed and built the platform: architecture, frontend, backend, mobile and infrastructure. If you need someone who can own both the product and the code, [let's talk on LinkedIn](https://www.linkedin.com/in/rsdlt).*
