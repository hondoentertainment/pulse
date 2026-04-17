# Bundle Optimization (Wave 2 — Performance)

This document captures the before/after numbers, the techniques applied, and
the remaining opportunities for squeezing more bytes out of the production
bundle. The goal of this wave was to move Lighthouse Performance from ~0.73
toward 0.85+.

## Before / after

All sizes are the **raw (minified, not gzipped)** bytes emitted by
`bun run build` on the same commit, with and without the optimisations in
this wave. Gzipped numbers are in parens.

| Chunk / asset                 | Before             | After              | Δ (raw)      |
| ----------------------------- | ------------------ | ------------------ | ------------ |
| `index` (main/entry)          | 204 kB (60.85 kB)  | 102 kB (33.41 kB)  | **−50 %**    |
| `react-vendor`                | 710 kB (201 kB)    | 193 kB (60.5 kB)   | **−73 %**    |
| `sentry` (lazy)               | 257 kB (85 kB)     | 258 kB (85 kB)     | unchanged *  |
| `supabase`                    | 173 kB             | 173 kB             | unchanged    |
| `radix` (new chunk)           | (bundled in index) | 127 kB (40.9 kB)   | isolated     |
| `framer-motion`               | 118 kB             | 118 kB             | unchanged    |
| `icons` (new chunk)           | (bundled in index) | 298 kB (70 kB)     | isolated     |
| `router` (new chunk)          | (in react-vendor)  | 36 kB (13 kB)      | isolated     |
| `tanstack-query` (new chunk)  | (in react-vendor)  | 38 kB (11.5 kB)    | isolated     |
| `mapbox`                      | 1 704 kB           | 1 714 kB           | unchanged    |
| **PWA precache size**         | 5 726 kB (50 files)| **3 741 kB** (54)  | **−35 %**    |

\* The `sentry` chunk is identical in byte-count, but is now **lazy-loaded
after first paint** (see below) so it no longer blocks TTI.

### Why `react-vendor` shrank so much

The previous `manualChunks` matcher used `id.includes('react')` which matched
every single package that had the word `react` anywhere in its path: this
pulled `react-router-dom`, `react-hook-form`, `react-error-boundary`,
`@tanstack/react-query`, `@vercel/analytics/react`, `@radix-ui/react-*`,
`lucide-react`, `react-markdown`, etc. into a single ~700 kB chunk.

The new matcher anchors on the exact directory (`/node_modules/react/`,
`/node_modules/react-dom/`, `/node_modules/scheduler/`,
`/node_modules/react-is/`) so only the React runtime itself lands in
`react-vendor`. Everything else is routed into its own semantically-named
chunk (`radix`, `icons`, `router`, `forms`, …).

## What's now lazy-loaded

### Sentry SDK (`@sentry/react`)

- **Before:** `Sentry.init()` ran **synchronously** at module scope in
  `main.tsx`, pulling ~250 kB into the critical path.
- **After:** Sentry init is deferred into `src/AppBootstrap.tsx`, scheduled
  via `requestIdleCallback` (fallback: `setTimeout(2000)`). The SDK itself
  lives in a separate chunk (`dist/assets/sentry-*.js`) that loads only
  after first paint.
- `trackError()` in `src/lib/analytics.ts` likewise forwards to Sentry via a
  dynamic `import('./sentry-lazy')` — so no module that calls `trackError`
  drags the SDK into its chunk.
- The `PWA` service worker `globIgnores` now exclude `sentry-*.js` from the
  precache, so it isn't paid for at install time.

### Mock venue fixtures

- `src/lib/mock-data.ts`, `src/lib/us-venues.ts`, and `src/lib/global-venues.ts`
  used to ship **~45 kB (raw) of venue arrays** into every production bundle
  (1 100+ lines of Seattle data, ~400 lines of US expansion data, plus 200
  international venues).
- The full fixture tables have been moved to `src/lib/__fixtures__/` and are
  no longer statically imported by anything in `src/` or `src/components/`.
- The remaining `mock-data.ts` / `us-venues.ts` / `global-venues.ts` modules
  are now prod-safe wrappers that expose:
  - The same public API shape (`MOCK_VENUES`, `US_EXPANSION_VENUES`,
    `getSimulatedLocation`, `US_CITY_LOCATIONS`, `getNearestCity`, …) — so no
    consumer broke.
  - `loadMockVenueFixtures()` / `loadUSVenueFixtures()` /
    `loadGlobalVenueFixtures()` helpers that dynamically import the
    fixtures **only when `import.meta.env.DEV` is true**.
- `useAppState` seeds `venues` with an empty array and hydrates it via the
  lazy loader inside a `useEffect` gated by `DEV`. In production the app
  relies on Supabase (`fetchVenuesFromSupabase`) for its venue list.

### Heavy pages (route-level code splitting)

All of the following were already wrapped in `React.lazy()` in this branch
and the Suspense fallback is now the shared `<PageSkeleton />` (see
`src/components/PageSkeleton.tsx`):

- `OnboardingFlow`, `AuthGate`, `StoryViewer`, `CreatePulseDialog`
- `SocialPulseDashboard` (admin/analytics, 61 kB raw)
- `InteractiveMap` (50 kB raw)
- `VenuePage` (55 kB)
- `AchievementsPage`, `EventsPage`, `CrewPage`, `InsightsPage`,
  `NeighborhoodView`, `PlaylistsPage`, `SettingsPage`, `IntegrationHub`,
  `ModerationQueuePage`
- `TrendingTab`, `DiscoverTab`, `ProfileTab`, `NotificationFeed`

The initial `/` route only loads `react-vendor` + `index` + `radix` +
`router` + `tanstack-query` + `framer-motion`, plus the `trending` /
`ProfileTab` chunks once the tab renders.

## Vite config changes (`vite.config.ts`)

- **Narrow `manualChunks` matchers** (see "Why `react-vendor` shrank"):
  isolate `sentry`, `supabase`, `tanstack-query`, `radix`, `icons`
  (`@phosphor-icons` + `lucide-react`), `framer-motion`, `charts` (recharts
  + d3), `three`, `mapbox` (+ `supercluster`, `kdbush`), `markdown`
  (react-markdown + remark + rehype + micromark), `dates`, `sonner`,
  `octokit`, `vercel`, `storage` (localforage + idb), `forms` (zod +
  react-hook-form), `spark`, `router`, `error-boundary`.
- `build.cssCodeSplit = true` (default in Vite 7, kept explicit for clarity).
- `build.chunkSizeWarningLimit = 300` so any future chunk over ~300 kB raw
  surfaces loudly in CI.
- PWA `globIgnores` now excludes `mapbox-*.js`, `three-*.js`, and
  `sentry-*.js` from the precache, plus a 3 MB `maximumFileSizeToCacheInBytes`
  ceiling to keep the install footprint tight.

## `App.tsx` decomposition

`App.tsx` used to be the single place where providers, lifecycle side-effects,
and routing coexisted — tightly prop-threading state and blocking code
splitting. It has been split into three explicit layers:

| File                        | Responsibility                                           |
| --------------------------- | -------------------------------------------------------- |
| `src/AppProviders.tsx`      | `ErrorBoundary` → query client → router → Supabase auth → app state, plus `<Analytics/>` + `<SpeedInsights/>`. Zero side-effects. |
| `src/AppBootstrap.tsx`      | One-shot `useEffect` that registers global error listeners and schedules the Sentry dynamic import via `requestIdleCallback`. |
| `src/AppRoutes.tsx`         | Tab / sub-page / modal switcher. Wraps every heavy page in `React.lazy()` + `<Suspense>`. |
| `src/App.tsx`               | Three-line composition: `<AppProviders><AppBootstrap><AppRoutes/></AppBootstrap></AppProviders>`. |
| `src/main.tsx`              | Just renders `<App/>`. No Sentry init, no global listeners, no providers. |

## Files added / moved in this wave

**New files**

- `src/AppProviders.tsx`
- `src/AppBootstrap.tsx`
- `src/AppRoutes.tsx`
- `src/components/PageSkeleton.tsx`
- `src/lib/sentry-lazy.ts`
- `src/lib/__fixtures__/mock-data.ts` (moved from `src/lib/mock-data.ts`)
- `src/lib/__fixtures__/us-venues.ts` (moved from `src/lib/us-venues.ts`)
- `src/lib/__fixtures__/global-venues.ts` (moved from `src/lib/global-venues.ts`)
- `docs/bundle-optimization.md` (this file)

**Rewritten to thin prod-safe wrappers**

- `src/lib/mock-data.ts`
- `src/lib/us-venues.ts`
- `src/lib/global-venues.ts`
- `src/App.tsx`
- `src/main.tsx`
- `src/lib/analytics.ts` (Sentry import moved off module scope)

**Touched**

- `src/hooks/use-app-state.tsx` (dev-only lazy venue seed)
- `src/components/MainTabRouter.tsx` (shared `<PageSkeleton/>` fallback)
- `src/components/SubPageRouter.tsx` (shared `<PageSkeleton/>` fallback)
- `vite.config.ts` (manual chunks + PWA precache policy)

## Remaining opportunities

The two biggest targets left on the table:

1. **`mapbox-gl` (1.71 MB raw / 474 kB gzipped)** — still the single largest
   asset in the build. It is already lazy (dynamic `import('mapbox-gl')`
   inside `useMapbox`), so it never blocks first paint, but the chunk itself
   is enormous. Options worth exploring:
   - Swap to `maplibre-gl` (fork of mapbox v1) — drops to ~800 kB raw.
   - Or move the map to a server-rendered tile + DOM-based overlays for
     everything but the `/map` tab.
   - Either direction is a standalone PR; this wave intentionally left
     mapbox alone so the diff stays reviewable.
2. **`icons` chunk (298 kB raw / 70 kB gzipped)** — `@phosphor-icons/react`
   ships every icon even with tree-shaking, because the app uses a wide
   vocabulary (~100 distinct icons across 124 components). Options:
   - Adopt the existing `vitePhosphorIconProxyPlugin` output (already
     configured, but "Fallback icon not found" during build suggests it's
     not actually proxying — worth a follow-up).
   - Audit `PulseCard`, `VenueCard`, `BottomNav` for icons that could be
     consolidated.
3. **CSS (700 kB raw / 102 kB gzipped)** — Tailwind's default output is
   already pruned by `@tailwindcss/vite` content scanning, but 700 kB is
   still large. A follow-up could audit `src/styles/theme.css` and
   `src/index.css` for unused custom utilities.
4. **Sentry** — if the 258 kB async chunk still shows up as a problem in
   real-user metrics, the `replayIntegration()` alone is ~150 kB. Dropping
   replay (keeping only `browserTracingIntegration`) would take the sentry
   chunk under 110 kB.
5. **`@github/spark` proxy.js (1.57 MB raw)** — emitted by the spark plugin
   outside of normal chunk routing. It's an HMR helper that shouldn't be in
   the prod build at all; worth filing an issue upstream or gating the
   plugin behind `command === 'serve'` in a follow-up.

## Verification

- `bun run build` succeeds (only a warning about `icons` and `mapbox` being
  over the 300 kB chunk-size threshold — expected, see above).
- `bun run test src/lib` passes 33/34 test files (1 pre-existing failure in
  `interactive-map.test.ts` unrelated to this change).
- `tsc -b --noEmit` reports no new type errors in any file touched by this
  wave.
