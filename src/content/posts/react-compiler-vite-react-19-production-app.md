---
title: "Adopting the React Compiler Early in a React 19 + Vite App"
pubDatetime: 2025-05-29T09:00:00-04:00
description: "Why I turned on the React Compiler (RC) in Foambyte's React 19 + Vite app, how to set it up with Babel and ESLint, and the rules I follow so it can do its job."
tags: ["react", "react compiler", "vite", "performance", "frontend", "foambyte"]
---

[Foambyte](https://foambyte.com), the brewing platform my brother Diego and I are building, is about to grow its heaviest screens: a recipe editor with dozens of interdependent inputs, ingredient tables, and live calculations. That's the kind of UI where React apps slowly fill up with `useMemo`, `useCallback` and `React.memo`, and where forgetting one of them causes a re-render storm.

This month I turned on the **React Compiler**, even though it's still a release candidate. Here's why I think adopting it early is the right call for a new codebase, how it's set up, and the rules that make it work.

## What the compiler does

The React Compiler is a build-time tool. It analyzes components and hooks and inserts memoization automatically, at a finer grain than most people write by hand: individual JSX subtrees and derived values, not just whole components.

The practical effect: **you write plain React, and re-renders stay cheap without manual memoization.** The compiler only does this for code that follows the [Rules of React](https://react.dev/reference/rules) (pure render, no mutation of props or state, hooks at the top level). Code that breaks them is skipped, not miscompiled.

## Why adopt it now, in a release candidate

1. **The codebase is young.** Foambyte's frontend is a few months old. Adopting the compiler now means almost all of the code will be written with it from the start, instead of retrofitting a large app later.
2. **The cost of being wrong is low.** It's a Babel plugin. If it misbehaves, removing one line from the Vite config turns it off, and a single component can opt out with a `"use no memo"` directive.
3. **Manual memoization is a maintenance tax.** Dependency arrays are easy to get wrong in both directions: too few and you read stale values, too many and the memo never hits. The compiler infers dependencies from the code itself.
4. **React 19 is the target it's built for.** We're already on React 19, so there's no compatibility layer to add.

## Setup with Vite

`@vitejs/plugin-react` accepts Babel plugins, so enabling the compiler is a few lines:

```ts
// vite.config.ts
const ReactCompilerConfig = { target: "19" };

export default defineConfig({
  plugins: [
    react({
      babel: { plugins: [["babel-plugin-react-compiler", ReactCompilerConfig]] },
    }),
  ],
});
```

The trade-off to know: once you pass Babel plugins, the React plugin runs Babel over your components, which makes transforms a bit slower than a pure esbuild/SWC pipeline. For an app this size it's a non-issue in dev and adds little to production builds.

## The lint rule is not optional

The compiler silently skips components that break the Rules of React. Without feedback, you can't tell whether a component is optimized. That's what `eslint-plugin-react-compiler` is for:

```js
// eslint.config.js
reactCompiler.configs.recommended,
{
  rules: { "react-compiler/react-compiler": "error" },
},
```

I set it to **error**, not warning. A violation usually means real impurity (mutating a prop, reading a ref during render), which is a bug with or without the compiler.

## The rules I follow

- **Don't rip out existing `useMemo`.** The compiler works alongside manual memoization. Removing it is churn with no user-visible benefit, and some `useMemo` calls exist for correctness (a stable object identity passed to a third-party library), not just speed.
- **Don't add new memoization by reflex.** New components start as plain React. If the profiler shows a real problem, measure first, then reach for a manual hook.
- **Keep render pure.** Derived values are computed in render, side effects live in event handlers and effects. That's good React anyway; the compiler just rewards it.
- **Keep state where it changes.** The compiler reduces the cost of re-renders but can't stop a context provider at the root from re-rendering everything below it. State that changes on every keystroke belongs close to the input, or in a store with fine-grained subscriptions.

## What it doesn't fix

The compiler won't fix slow algorithms, giant lists without virtualization, or network waterfalls. For the recipe editor, the bigger wins will come from data and state design: fine-grained subscriptions so typing in one field doesn't re-render the whole form, and server state that lives in a cache instead of in components. The compiler is a multiplier on good structure, not a substitute for it.

## Takeaways

- **Adopt the React Compiler at the start of a codebase,** when there's little to migrate and every new component benefits.
- **It's low risk:** one Babel plugin, a per-component escape hatch, and an easy rollback.
- **Turn the ESLint rule on as an error,** so you know which components the compiler can actually optimize.
- **Stop writing memoization by default,** but keep the hooks that exist for correctness.

---

*I'm Rodrigo Santiago, a product leader who builds. I co-founded [Foambyte](https://foambyte.com) with my brother Diego, a brewmaster who leads the product as CPO, and I designed and built the platform: architecture, frontend, backend, mobile and infrastructure. If you need someone who can own both the product and the code, [let's talk on LinkedIn](https://www.linkedin.com/in/rsdlt).*
