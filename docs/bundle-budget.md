# Bundle budget

Canonical JS/CSS size budgets for production (`bun run build`). Any change
that pushes a chunk over these thresholds must be justified in the PR
description. Thresholds are tightened when there is ≥ 15 % headroom vs. the
current actual.

_Last updated: 2026-04-17 (post spark-gate + phosphor-extract)._

## Actuals vs. budgets

| Chunk / asset | Actual (min) | Actual (gzip) | Budget (min) | Budget (gzip) | Notes |
| --- | ---: | ---: | ---: | ---: | --- |
| `index.html` | 2.40 kB | 0.93 kB | 8 kB | 2 kB | — |
| `assets/index-*.css` | 699.55 kB | 102.32 kB | 760 kB | 115 kB | Tailwind JIT output; big because of tree of design tokens. Next wave: split out PWA-cold styles. |
| `assets/index-*.js` (app entry) | 244.46 kB | 75.12 kB | 280 kB | 90 kB | Routing shell, context providers, hooks. |
| `assets/react-vendor-*.js` | 216.06 kB | 69.22 kB | 250 kB | 80 kB | React 19 + react-dom + scheduler. |
| `assets/phosphor-*.js` | 296.11 kB | 68.95 kB | 320 kB | 78 kB | All ~145 used icons; see `bundle-optimization.md`. |
| `assets/sentry-*.js` | 257.55 kB | 85.06 kB | 300 kB | 100 kB | Deferred via `sentry-lazy`. |
| `assets/supabase-*.js` | 172.93 kB | 45.77 kB | 200 kB | 55 kB | Loaded on first auth/query. |
| `assets/framer-motion-*.js` | 117.79 kB | 39.07 kB | 135 kB | 45 kB | |
| `assets/radix-*.js` | 104.38 kB | 32.25 kB | 125 kB | 40 kB | All Radix primitives. |
| `assets/mapbox-gl-*.js` | 1704.12 kB | 469.84 kB | 1800 kB | 500 kB | Lazy — only loaded when a map is opened. Budget tracked, not first-paint-critical. See `maplibre-migration.md`. |
| `assets/tanstack-query-*.js` | 37.49 kB | 11.16 kB | 50 kB | 15 kB | |
| `assets/sonner-*.js` | 33.83 kB | 9.67 kB | 40 kB | 12 kB | |
| `assets/vercel-*.js` | 5.99 kB | 2.05 kB | 12 kB | 4 kB | |
| **First-paint JS total** (entry + react-vendor + phosphor) | **756.63 kB** | **213.29 kB** | **850 kB** | **245 kB** | Hard ceiling. Pushed down from ≈ 1180 kB / 347 kB last wave. |
| **PWA precache total** | **2529.70 kB** | — | **3700 kB** | — | Service-worker precache includes CSS + all statically imported JS, excludes `proxy.js` (deleted) and `mapbox-gl-*.js` / `maplibre-gl-*.js` / `*.map`. |

## What changed this wave

- `dist/proxy.js` (1570.98 kB) — eliminated. The `@github/spark` plugin now
  runs dev-only (`command === 'serve'`).
- `react-vendor`: 709.75 kB → 216.06 kB (−493 kB raw, −132 kB gzip). Caused
  by an overly-greedy `id.includes('react')` check in `manualChunks` that
  accidentally swept in `@phosphor-icons/react`, `react-hook-form`,
  `react-day-picker`, etc.
- `phosphor` is a first-class chunk (296.11 kB). Previously invisible inside
  `react-vendor`.
- `radix`, `tanstack-query`, `vercel` each get their own chunks now that
  they aren't absorbed into other vendor buckets.
- PWA precache: 5726.40 kB → 2529.70 kB (-55 %). `globIgnores` now excludes
  `proxy.js`, `mapbox-gl-*.js`, `maplibre-gl-*.js`, and `*.map`.

## How the budget is enforced

Manual today (via PR review of `bun run build` output). A follow-up wave
can wire `scripts/check-bundle-size.mjs` (not yet present in this worktree)
to `bun run release-check`. The budget table above is the source of truth
for that script when it lands.

## Tightening rationale

Chunks where we had ≥ 15 % headroom were trimmed in this update:

- `index.html`: actual 2.40 kB, budget was 10 kB → tightened to 8 kB.
- `app entry JS`: actual 244 kB, budget was 320 kB → tightened to 280 kB.
- `react-vendor`: actual 216 kB → budget 250 kB (≈ 15 % headroom retained
  for the React 20 upgrade path).
- `sentry`: actual 257 kB → budget 300 kB (tight; any growth here should be
  treated as a regression).
- `supabase`: actual 173 kB → budget 200 kB.
- `PWA precache`: actual 2530 kB → budget 3700 kB (keeps 1.2 MB slack for
  additional fonts / PWA assets without breaching the platform 4 MB cap).

Chunks left with wider budgets (either because they're lazy, or because
future features will grow them):

- `mapbox-gl` (lazy).
- `phosphor` (adding new icons is cheap; keep some room).
- `index-*.css` (Tailwind output grows with every new utility combination).
