---
title: "Building a Recipe Calculation Engine in TypeScript: IBU, SRM, Fermentability and FG"
pubDatetime: 2025-12-30T11:00:00-05:00
description: "Designing Foambyte's brewing recipe engine: an ordered chain from volumes to OG, IBU, attenuation, FG, ABV and SRM, built as pure TypeScript functions."
tags: ["typescript", "domain modeling", "brewing", "jotai", "architecture", "algorithms", "foambyte"]
---

> [!NOTE]
> **Update, October 2026:** the engine has since moved to the server as a pure function behind its own API endpoint, protected by golden-master tests. This post describes its first design, as it stood in December 2025.

A brewing recipe is a small system of equations. Change the batch size and the water volumes change; change the grain bill and the original gravity changes; the gravity changes how much bitterness the hops extract; the fermentability of the wort changes how far the yeast ferments, which sets the final gravity and the alcohol. Every brewing app has to solve that system every time a brewer edits anything.

This month I built the first version of [Foambyte](https://foambyte.com)'s **recipe calculation engine**. This post covers its design: the dependency chain, the models, and how the work is split between brewing expertise and software.

## Brewing knowledge in, code out

The engine combines two kinds of knowledge:

- **Published formulas** where the brewing community has settled on one: **Tinseth** for hop utilization, **Morey** for beer color, standard extract-potential math for gravity.
- **Empirical models** where it hasn't, such as how the mash temperature profile affects wort fermentability and how that shifts yeast attenuation. These models and their constants come from **Diego**, my brother and Foambyte's CPO, a brewmaster with more than a decade of experience. My job is to turn them into code that's ordered, testable and fast.

That split matters for the architecture: the constants are **named and centralized** in the shared configuration package, so the brewing side can be tuned without touching the calculation logic.

## The dependency chain

The engine runs as an ordered pipeline. Each step only uses results from earlier steps:

1. **Brewhouse volumes:** from the target batch volume, work backwards through trub loss, cooling shrinkage and boil-off to the pre-boil volume.
2. **Water:** grain absorption, total water, and the mash/sparge split from the mash ratio.
3. **Original gravity (OG):** the sum of each fermentable's extract potential, scaled by brewhouse efficiency.
4. **Pre-boil gravity:** OG adjusted for evaporation and the mash-to-brewhouse efficiency ratio.
5. **Bitterness (IBU):** Tinseth per hop addition, evaluated at pre-boil gravity.
6. **Fermentability:** of the wort (from its ingredients) and of the mash schedule (from its temperatures).
7. **Final gravity (FG):** from the yeast's attenuation, adjusted by fermentability.
8. **ABV:** from OG and FG, capped by the yeast's alcohol tolerance.
9. **Color (SRM):** Morey, with an adjustment for very long boils.
10. **Balance (BU:GU):** bitterness relative to gravity.

```text
volumes → OG → pre-boil gravity → IBU ─────────────┐
           └→ fermentability → attenuation → FG → ABV → BU:GU
grain colors → MCU → SRM
```

Making the order explicit is the main design decision. Brewing calculators often recompute values independently and drift out of sync (an IBU computed against a stale gravity, for example). A single ordered pass guarantees every value in the recipe is consistent with every other.

## A few of the models

**Hop bitterness, per addition.** Tinseth's utilization combines a gravity "bigness" factor and a boil-time factor. Foambyte applies it per hop, at pre-boil gravity, with a correction factor for the hop's form (pellets extract more than whole cones):

```ts
const ibuContribPerHop =
  ((hop.amount * (hop.alphaAcid ?? 0)) / 100) *
  (1000 / batchVolumeL) *
  (1.65 * 0.000125 ** (preBoilGravity - 1)) *
  ((1 - Math.exp(-0.04 * hop.processTime)) / 4.15) *
  correctionFactor;
```

Each hop's contribution is stored on the hop itself, so the UI can show which additions drive the bitterness.

**Final gravity through fermentability.** Instead of using the yeast's average attenuation as-is, the engine estimates how fermentable this particular wort is, from its ingredients and its mash schedule (a time-weighted average over the mash steps, where each temperature band has a baseline fermentability), and shifts the expected attenuation up or down accordingly:

```ts
const wortDeviation = finalWortFermentability / 100 - FERMENTABILITY_REFERENCE;
const apparentAttenuation = yeastAvgAttenuation + WORT_ATTENUATION_SENSITIVITY * wortDeviation;
const fg = 1 + (og - 1) * (1 - apparentAttenuation);
```

A mash at low temperatures produces a more fermentable wort and a drier beer; a hot mash leaves more body. The model captures that with two named constants.

**Color.** Malt color units (MCU) from each grain's Lovibond rating, then Morey's curve, `SRM = 1.4922 × MCU^0.6859`.

**Guard rails.** Some rules aren't formulas: no fermentables or no yeast means nothing ferments (FG equals OG); no hops means zero IBU; a yeast can't produce more alcohol than it tolerates, so FG is capped accordingly.

## Where the engine runs

In this first version the engine lives in the frontend as a **write-only Jotai atom**. When a brewer edits the recipe, the editor builds a patch from the difference between the server's recipe and the local one and hands it to the engine. The engine reads the recipe plus reference data (ingredient catalogue, mash systems) from the TanStack Query cache and runs the pipeline.

The patch also determines the **calculation path**. Most edits run the standard forward pass. But brewers also work backwards ("I want 6.5% ABV" or "I want 45 IBU"), and those targets need different paths through the same chain. The engine already detects the path from the patch, which keeps that decision in one place; the target-driven paths themselves are the next step.

## Where it stands

Honesty about a work in progress: the pipeline computes every value above, and I'm verifying it against a seeded sample recipe with a neutral water baseline, checking the outputs step by step. Next is writing the results back into the recipe and replacing manual checks with automated ones. For an engine like this, the right test is a **golden master**: snapshot the full output for a set of reference recipes, and make any change to those numbers a deliberate, reviewed decision.

## Takeaways

- **Model the domain as an explicit, ordered dependency chain;** it's the only way to keep dozens of derived values consistent.
- **Separate published formulas from empirical models,** and keep the empirical constants named and centralized so domain experts can tune them.
- **Store intermediate results** (like per-hop IBU) where users can see them; it makes the math explainable.
- **Plan for multiple calculation paths** (forward and target-driven) from the start.
- **Golden-master tests** are the natural safety net for calculation engines.

---

*I'm Rodrigo Santiago, a product leader who builds. I co-founded [Foambyte](https://foambyte.com) with my brother Diego, a brewmaster who leads the product as CPO, and I designed and built the platform: architecture, frontend, backend, mobile and infrastructure. If you need someone who can own both the product and the code, [let's talk on LinkedIn](https://www.linkedin.com/in/rsdlt).*
