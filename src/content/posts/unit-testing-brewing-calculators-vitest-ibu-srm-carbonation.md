---
title: "Testing Brewing Math: Unit Tests for IBU, Color and Carbonation Calculators"
pubDatetime: 2025-09-04T09:45:00-04:00
description: "How I test Foambyte's brewing calculators with Vitest and Zod: reference values, round trips, behavior checks and 330+ tests for IBU, SRM and CO2."
tags: ["testing", "vitest", "zod", "typescript", "brewing", "domain modeling", "foambyte"]
---

A brewing calculator that's wrong by a few percent looks perfectly fine on screen. Nobody notices until a batch comes out too bitter, too dark or over-carbonated. That's what makes domain math the most important code to test in [Foambyte](https://foambyte.com), and the easiest to under-test.

Over the last two weeks I built Foambyte's first set of calculators and converters, together with about **330 unit tests**. This post covers how they're structured and the testing patterns that work well for numeric domain code.

## What's covered

**Converters:** gravity, mass, temperature, volume and beer color (SRM, EBC and degrees Lovibond).

**Calculators:**

- **Hop utilization and IBU contribution** with the Tinseth formula, including a correction factor for hop forms such as pellets.
- **Alpha acid units** (AAU).
- **Priming sugar** for bottle conditioning, from desired CO2 volumes and beer temperature.
- **Keg pressure (PSI)** for a target carbonation level at a given temperature.

Each one is a pure function: numbers in, number out, no React and no I/O. That's what makes them easy to test and reusable anywhere: the calculator screens, the recipe editor, and the server if we ever need them there.

## Validate inputs at the boundary

Every function validates its inputs with a Zod schema and throws on invalid data rather than returning a plausible-looking wrong number:

```ts
export function calcHopUtilization(originalGravity: number, boilTimeMinutes: number, correctionFactor = 1) {
  // ...input schema safeParse; throws the ZodError on invalid input...
  const bignessFactor = 1.65 * 0.000125 ** (originalGravity - 1);
  const boilTimeFactor = (1 - Math.exp(-0.04 * boilTimeMinutes)) / 4.15;
  return bignessFactor * boilTimeFactor * 100 * correctionFactor;
}
```

A negative boil time or a gravity of 0.5 is a bug upstream, and failing loudly makes it visible in tests and in the UI.

## Five kinds of tests

Each module's tests are grouped the same way, which makes gaps easy to spot in review.

**1. Reference values.** Known inputs with known outputs, compared with a tolerance:

```ts
it("matches known Tinseth value at 1.050 SG, 60 min, C=1.0", () => {
  expect(calcHopUtilization(1.050, 60, 1.0)).toBeCloseTo(23.0664, 3);
});
```

**2. Round trips.** Converting there and back must return the original value: Fahrenheit to Celsius to Fahrenheit, SRM to EBC to SRM. Round trips catch inverted constants that a single reference value can miss.

**3. Behavior, not just values.** Some properties must hold for any input. Hop utilization goes **up** with boil time and **down** with wort gravity. A correction factor scales the result linearly:

```ts
it("applies correction factor linearly (e.g., pellet 1.10)", () => {
  expect(pellet).toBeCloseTo(base * 1.10, 6);
});
```

These monotonicity checks are cheap and catch sign errors and swapped arguments that reference values sometimes don't.

**4. Edge cases.** Zero boil time, very high gravity, beer that's already more carbonated than the target. The priming sugar calculator clamps to zero instead of suggesting negative sugar.

**5. Validation errors.** Invalid inputs must throw, and the tests assert that they do.

> [!TIP]
> Pick tolerances deliberately. `toBeCloseTo(x, 3)` is a real check; `toBeCloseTo(x, 0)` only checks to the nearest unit, which is fine for "about 7 g/L of sugar" but too loose for a hop utilization percentage. Write down why each tolerance is what it is.

## Formulas over lookup tables

My first keg-pressure calculator used a CO2 carbonation table and interpolated between rows. It worked, but interpolation produces small jumps at row boundaries and only covers the table's range. I replaced it with a polynomial regression fitted to the same relationship, which is smooth, short, and easy to test across the whole supported range (roughly 30–65 °F). The input schema enforces that range, in whichever unit the user enters.

## Units are part of the math

Every calculator works internally in one unit system and converts at the boundary. The converters behind that are the most heavily tested code in the set (gravity, mass, temperature and volume alone account for well over 200 tests), because a unit bug silently corrupts every calculator downstream.

## Takeaways

- **Make domain math pure functions** with validated inputs; they're trivially testable and reusable across screens and services.
- **Combine reference values with property checks:** round trips and monotonic behavior catch errors that a few known values miss.
- **Choose and document tolerances** instead of defaulting to whatever passes.
- **Prefer smooth formulas over interpolated tables** when a good fit exists.
- **Test the unit converters hardest;** everything else depends on them.

---

*I'm Rodrigo Santiago, a product leader who builds. I co-founded [Foambyte](https://foambyte.com) with my brother Diego, a brewmaster who leads the product as CPO, and I designed and built the platform: architecture, frontend, backend, mobile and infrastructure. If you need someone who can own both the product and the code, [let's talk on LinkedIn](https://www.linkedin.com/in/rsdlt).*
