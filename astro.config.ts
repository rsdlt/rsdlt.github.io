import {
  defineConfig,
  envField,
  fontProviders,
  svgoOptimizer,
} from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import { unified } from "@astrojs/markdown-remark";
import remarkToc from "remark-toc";
import remarkCollapse from "remark-collapse";
import rehypeCallouts from "rehype-callouts";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import {
  transformerNotationDiff,
  transformerNotationHighlight,
  transformerNotationWordHighlight,
} from "@shikijs/transformers";
import minLight from "@shikijs/themes/min-light";
import nightOwl from "@shikijs/themes/night-owl";
import { transformerFileName } from "./src/utils/transformers/fileName";
import { accessibleTheme } from "./src/utils/accessibleTheme";
import config from "./astro-paper.config";

export default defineConfig({
  site: config.site.url,
  // Pages from the old Jekyll (Chirpy) site at rsdlt.github.io that have no
  // match here. GitHub Pages can't send 301s, so Astro writes instant
  // meta-refresh pages with a canonical link, which Google treats as permanent.
  redirects: {
    "/about": "/projects/",
    "/page2": "/posts/",
    "/categories": "/tags/",
    "/categories/rust": "/tags/rust/",
    "/categories/ray-tracer": "/tags/ray-tracer/",
    "/categories/neovim": "/tags/neovim/",
    "/categories/traits": "/tags/traits/",
    "/categories/wasm": "/tags/wasm/",
  },
  integrations: [
    mdx(),
    sitemap({
      filter: page =>
        config.features?.showArchives !== false || !page.endsWith("/archives/"),
    }),
  ],
  i18n: {
    locales: ["en"],
    defaultLocale: "en",
    routing: {
      prefixDefaultLocale: false,
    },
  },
  markdown: {
    processor: unified({
      remarkPlugins: [
        // Posts use $$...$$ for math; a lone $ is literal text.
        [remarkMath, { singleDollarTextMath: false }],
        remarkToc,
        [remarkCollapse, { test: "Table of contents" }],
      ],
      rehypePlugins: [rehypeCallouts, rehypeKatex],
    }),
    shikiConfig: {
      // Code blocks sit on the page background (theme.css), so token colors
      // are raised to readable contrast against it. Light gets a higher target
      // so colors still pass on shaded lines (highlights, diffs, muted).
      themes: {
        light: accessibleTheme(minLight, "#fcfcfa", 6),
        dark: accessibleTheme(nightOwl, "#262427"),
      },
      defaultColor: false,
      wrap: false,
      transformers: [
        transformerFileName({ style: "v2", hideDot: false }),
        transformerNotationHighlight(),
        transformerNotationWordHighlight(),
        transformerNotationDiff({ matchAlgorithm: "v3" }),
      ],
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
  fonts: [
    {
      name: "JetBrains Mono",
      cssVariable: "--font-jetbrains-mono",
      provider: fontProviders.google(),
      fallbacks: ["monospace"],
      weights: [300, 400, 500, 600, 700],
      styles: ["normal", "italic"],
      formats: ["woff", "ttf"],
    },
  ],
  env: {
    schema: {
      PUBLIC_GOOGLE_SITE_VERIFICATION: envField.string({
        access: "public",
        context: "client",
        optional: true,
      }),
    },
  },
  experimental: {
    svgOptimizer: svgoOptimizer(),
  },
});
