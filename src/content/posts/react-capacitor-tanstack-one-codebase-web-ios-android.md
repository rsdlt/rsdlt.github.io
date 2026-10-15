---
title: "One React Codebase for Web, iOS and Android: Vite, TanStack and Capacitor"
pubDatetime: 2026-06-18T09:30:00-04:00
description: "Why I built Foambyte as a React 19 SPA packaged with Capacitor instead of React Native or Next.js, and the TanStack Query pattern that keeps it maintainable."
tags: ["react", "capacitor", "tanstack", "frontend", "architecture", "typescript", "foambyte"]
---

Brewers plan recipes at a desk and log readings standing next to a fermentation tank with a phone in one hand. [Foambyte](https://foambyte.com), the production-management platform I build for craft brewers, has to work well in both places. I'm also its only developer, so I need one codebase for the web, iOS and Android, not three.

This post explains the frontend architecture I chose and why I think it's the right trade-off for a product like this.

## The decision: a SPA packaged with Capacitor

There were three realistic options:

| Option | What you get | What it costs |
| --- | --- | --- |
| **Next.js (SSR)** | Server rendering, great SEO | A server runtime, and SSR gives nothing to pages behind a login |
| **React Native** | Native UI widgets | A second component system; web components and Tailwind styles don't carry over |
| **Vite SPA + Capacitor** | One build output for web, iOS and Android | Native feel depends on careful use of native plugins |

I went with the third option for three reasons:

1. **Everything useful sits behind a login.** Recipes, batches and tanks are private data, so server rendering would add infrastructure without any SEO return. The SEO work lives on a separate static [Astro](https://astro.build) marketing site, which is the right tool for that job.
2. **Capacitor needs static, client-rendered files.** The same `dist/` folder that Cloudflare Pages serves is the folder Capacitor wraps into the Android and iOS apps. A SPA gives me that for free.
3. **The app is forms, tables and charts.** That is exactly what the web platform is good at. Nothing in Foambyte needs 120 fps native list virtualization or a custom camera pipeline.

## The stack

- **React 19 with the React Compiler**, so I don't hand-write `useMemo` and `useCallback`.
- **Vite** for builds and dev server.
- **TanStack Router** with file-based routes and automatic code splitting.
- **TanStack Query** for all server state, **TanStack Form** for forms, **TanStack Table** for the data grids.
- **Jotai** for fine-grained client state in the recipe editor.
- **HeroUI v3 + Tailwind CSS v4** for components and styling.
- **react-intl** for English, Spanish and Portuguese.

The common thread is **type safety end to end**. TanStack Router types route params and search params, TanStack Query types every cache entry, and the API types come straight from the server (more on that in a later post).

## Native where it matters, web everywhere else

Capacitor's value isn't the web view. It's the small set of native plugins that make a web app feel like it belongs on the phone:

- **Network status** feeds TanStack Query's `onlineManager`, so queries pause cleanly when a brewer walks into a cellar with no signal.
- **App state** (foreground/background) drives Query's `focusManager` and re-checks the session when the app comes back.
- **Preferences** stores language, units and theme natively.
- **Filesystem + Share** turn a generated PDF into a native share sheet. These plugins are loaded lazily, so the web build never pays for them.

The API client is deliberately boring. Every platform uses plain `fetch`; the only platform-specific decision is the base URL:

```ts
// simplified
const isNative = Capacitor.isNativePlatform();

this.baseUrl =
  mode === "development" && !isNative
    ? `${import.meta.env.VITE_API_URL_DEV}/api`
    : `${import.meta.env.VITE_API_URL_PROD}/api`;
```

One code path means one set of bugs. The client sends credentials, retries idempotent GETs with exponential backoff on 5xx or network errors only, and throws a typed `ApiError` that the UI can reason about.

## Server state: the query-key / query-options / mutation-options triplet

The pattern that has paid off the most is a strict file convention for every resource. Each one gets three files:

- `batch.qk.ts`: query keys
- `batch.qo.ts`: `queryOptions` factories
- `batch.mo.tsx`: `mutationOptions` factories, including cache updates

**Query keys are data, so they get their own module:**

```ts
export const QK_GET_ONE_BATCH = "get_one_batch" as const;

export function qkGetOneBatch(batchId: string | undefined) {
  return [QK_GET_ONE_BATCH, { batchId }] as const;
}
```

**Query options are reusable recipes for fetching:**

```ts
export function qoGetOneBatch(batchId: string | undefined) {
  return queryOptions<BatchResponse>({
    queryKey: qkGetOneBatch(batchId),
    enabled: !!batchId,
    queryFn: () => fapi.request("GET", batchUrls.one(batchId!)),
    staleTime: 60_000,
  });
}
```

The same factory works in a component (`useQuery`), in a route guard, or in an atom (`ensureQueryData`), and there's no chance of two call sites spelling a key differently.

**Mutation options own their side effects.** A batch update applies optimistically, rolls back on error, and invalidates every list that might show stale data:

```ts
onMutate: async (variables) => {
  await queryClient.cancelQueries({ queryKey: qkGetOneBatch(batchId) });
  const previousData = queryClient.getQueryData<BatchResponse>(qkGetOneBatch(batchId));
  // ...apply the patch to the cached batch...
  return { previousData };
},
onSuccess: () => {
  void queryClient.invalidateQueries({ queryKey: [QK_LIST_BATCHES] });
  void queryClient.invalidateQueries({ queryKey: [QK_LIST_BATCH_SUMMARIES] });
},
onError: (_e, _v, ctx) => rollbackBatch(batchId, ctx?.previousData),
```

> [!TIP]
> Put cache invalidation in the mutation, not in the component that calls it. A component knows what the user clicked; the mutation knows what data changed. When terminating a batch frees a tank, only the mutation should know that the tank cache has to be refreshed.

## Jotai for the recipe editor

TanStack Query is the source of truth for server data. But the recipe editor has dozens of fields, live calculations and undo/redo, and re-rendering a whole recipe form on every keystroke is wasteful.

So the editor reads the recipe through Query and exposes it as per-field Jotai atoms, using `jotai-tanstack-query` to share the same `QueryClient`:

```ts
export const recipeQueryAtom = atomWithQuery((get) => ({
  ...qoGetOneRecipe(get(recipeIdAtom)),
}));
export const recipeROAtom = atom((get) => get(recipeQueryAtom).data?.recipe);
export const recipeNameAtom = recipeAtomWithSync((r) => r.name);
```

Each field atom knows how to sync itself back to the server. The split is clear: **Query owns what the server says; Jotai owns what the user is editing right now.**

## Canonical units at the edges

Brewers mix units freely: Celsius or Fahrenheit, liters or gallons, specific gravity or Plato. Foambyte's rule is simple: **everything stored and sent to the API is metric.** The UI converts to the user's preferred units for display and back to metric before every mutation, using converters from a shared `@repo/brewing-formulas` package that the marketing site's public calculators also use.

Unit bugs are the brewing equivalent of off-by-one errors. Keeping conversion at the edges means the API, the database and every calculation only ever see one unit system.

## Takeaways

- **Pick rendering by audience.** Logged-in apps don't need SSR; public pages do. Splitting them into a SPA and a static site lets each be simple.
- **Capacitor works best with a thin native layer:** a few plugins wired into Query's online and focus managers do more for the native feel than any component library.
- **A strict file convention for server state** (keys, options, mutations) is the cheapest way I know to keep a growing React app consistent.
- **Separate server state from editing state.** TanStack Query and Jotai complement each other rather than compete.

In the next post I'll cover the other half of this setup: how the frontend and the Hono API share a single, type-checked contract.

---

*I'm Rodrigo Santiago, a product leader who builds. I designed and built [Foambyte](https://foambyte.com) end to end: architecture, frontend, backend, mobile and infrastructure. If you need someone who can own both the product and the code, [let's talk on LinkedIn](https://www.linkedin.com/in/rsdlt).*
