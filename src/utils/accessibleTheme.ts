type ThemeRegistration = typeof import("@shikijs/themes/min-light").default;

/** Minimum contrast for token colors: WCAG AA for normal text, plus a margin. */
const MIN_CONTRAST = 4.6;

type Rgb = [number, number, number];

const parse = (hex: string): Rgb => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)) as Rgb;

const toHex = (rgb: Rgb) =>
  "#" + rgb.map(c => Math.round(c).toString(16).padStart(2, "0")).join("");

const luminance = (rgb: Rgb) => {
  const [r, g, b] = rgb.map(c => {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a: Rgb, b: Rgb) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const mix = (a: Rgb, b: Rgb, t: number) => a.map((c, i) => c + (b[i] - c) * t) as Rgb;

/**
 * Returns `color` unchanged if it reads well on `background`; otherwise moves it
 * toward black (light backgrounds) or white (dark ones) until it reaches
 * MIN_CONTRAST. Colors with alpha are flattened onto the background first.
 */
function accessibleColor(color: string, background: string): string {
  if (!/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(color)) return color;
  const bg = parse(background);
  let fg = parse(color);
  if (color.length === 9) fg = mix(bg, fg, parseInt(color.slice(7, 9), 16) / 255);
  if (contrast(fg, bg) >= MIN_CONTRAST) return color;

  const target: Rgb = luminance(bg) > 0.5 ? [0, 0, 0] : [255, 255, 255];
  for (let t = 0.02; t <= 1; t += 0.02) {
    const candidate = mix(fg, target, t);
    if (contrast(candidate, bg) >= MIN_CONTRAST) return toHex(candidate);
  }
  return toHex(target);
}

/**
 * Copies a Shiki theme with every token color raised to readable contrast on
 * the page background. Code blocks use the page background (see typography.css),
 * so pass the matching value from theme.css.
 */
export function accessibleTheme(
  theme: ThemeRegistration,
  background: string
): ThemeRegistration {
  return {
    ...theme,
    name: `${theme.name}-accessible`,
    tokenColors: theme.tokenColors?.map(rule =>
      rule.settings?.foreground
        ? {
            ...rule,
            settings: {
              ...rule.settings,
              foreground: accessibleColor(rule.settings.foreground, background),
            },
          }
        : rule
    ),
  };
}
