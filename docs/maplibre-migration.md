# mapbox-gl → maplibre-gl migration plan

_Status: **investigation only** — no code changes in this wave._

## Why consider the swap

- `mapbox-gl@3.20.0` ships as a **1704 kB** (470 kB gzip) chunk — by far the
  heaviest dependency in the app, even after being fully lazy-loaded.
- Recent Mapbox SDKs are **proprietary** (non-OSS). Shipping the non-OSS
  `mapbox-gl-js` v2+ requires paid Mapbox account enrolment for commercial
  use. MapLibre GL JS is the hard fork of the last BSD-3 Mapbox release and
  remains OSI-licensed.
- MapLibre GL JS v5 weighs ~900 kB min / ~260 kB gzip — roughly **45–55 %
  smaller** than the current mapbox bundle. Most of the savings come from
  the removed Mapbox telemetry, RTL-text plugin bootstrap, billing/telemetry
  pipeline, and proprietary style/sprite helpers.

## What we actually use today (APIs in scope)

The entire coupling lives in **two files**:

- `src/hooks/use-mapbox.ts`
- `src/components/MapboxBaseLayer.tsx` (thin wrapper that delegates to the
  hook and exposes an imperative `flyTo` / `easeTo` ref)

Usage inventory inside `use-mapbox.ts`:

| API | Where | MapLibre equivalent | Notes |
| --- | --- | --- | --- |
| `import mapboxgl from 'mapbox-gl'` (dynamic) | line 64 | `import maplibregl from 'maplibre-gl'` | Identity API surface. |
| `mapboxgl.accessToken = …` | line 68 | **n/a** — MapLibre uses per-style transform or raw style URLs | See "tile source" below. |
| `new mapboxgl.Map({…})` | line 71 | `new maplibregl.Map({…})` | Same constructor shape. |
| `style: 'mapbox://styles/mapbox/dark-v11'` | line 73 | A style URL (e.g. Stadia Alidade Dark, Protomaps, MapTiler, or self-hosted) | Biggest migration decision. |
| `attributionControl`, `logoPosition`, `fadeDuration`, `maxPitch` | line 78–82 | All supported | `logoPosition` is a no-op in MapLibre (no logo). |
| `dragRotate`, `touchPitch` constructor opts | line 83–85 | Identical | |
| `map.on('load' / 'moveend' / 'zoomend' / 'move' / 'zoom')` | line 91–150 | Identical | Event system unchanged. |
| `map.getStyle().layers` + `map.addLayer({ type: 'fill-extrusion' …})` | line 97–124 | Supported, **but** requires a style with a `composite` source that exposes a `building` source-layer. The Mapbox Streets vector tiles have this out of the box. MapLibre-compatible styles that ship building extrusions: OpenMapTiles (maptiler), Protomaps `Nextzen`, or self-hosted OpenFreeMap planet tiles. | Largest functional risk — see "3D buildings" section. |
| `map.scrollZoom.disable()` etc. (interaction handlers) | line 154–162 | Identical | |
| `map.jumpTo`, `map.flyTo`, `map.easeTo`, `map.getCenter`, `map.getZoom`, `map.getPitch`, `map.getBearing`, `map.remove` | 183–250 | Identical | |
| `mapbox-gl.css` via CDN `<link>` | line 59 | Swap URL to `https://unpkg.com/maplibre-gl@<ver>/dist/maplibre-gl.css` or vendor the CSS locally | CSS class names (`.mapboxgl-…` vs `.maplibregl-…`) differ — a global `@import` rewrite or aliasing would be needed if we relied on those class names. We currently do **not**. |

The only `mapboxgl`-specific type import is `import type mapboxgl from 'mapbox-gl'` on line 2. MapLibre ships equivalent ambient types (`import type maplibregl from 'maplibre-gl'`).

No direct mapbox usage in `InteractiveMap.tsx`; it consumes only the
`MapboxBaseLayerHandle` (`flyTo` + `easeTo`) which is our own interface.

## API-surface delta (short)

| Concept | mapbox-gl | maplibre-gl |
| --- | --- | --- |
| Access token | `mapboxgl.accessToken` | None; use style URL with embedded key (e.g. MapTiler `?key=…`) or `transformRequest` to inject auth headers. |
| Default style | `mapbox://styles/...` | `https://…/style.json` (any TileJSON 3 compatible) |
| 3D buildings source | Built into Mapbox Streets v8 (`composite` + `building` source-layer) | Only available on styles that ship it (MapTiler Streets v2, Protomaps v4, OpenFreeMap). Self-hosted Planet tiles also support it. |
| Telemetry / billing | On by default | None; no account needed for OSS tiles |
| CSS class prefix | `.mapboxgl-…` | `.maplibregl-…` |
| RTL text plugin | Remote plugin loader | Same plugin, different URL (Open-Source fork) |
| TypeScript types | `@types/mapbox-gl` | Bundled with `maplibre-gl` |

The intersection that we exercise is ~95 % overlapping. No call on our side is "Mapbox-only".

## Estimated savings

Based on public bundle dashboards for `maplibre-gl@5.x` vs `mapbox-gl@3.20`:

| Build metric | mapbox-gl now | maplibre-gl projected | Delta |
| --- | --- | --- | --- |
| Raw JS | 1704 kB | **≈ 900 kB** | **−804 kB** |
| Gzip JS | 470 kB | **≈ 260 kB** | **−210 kB** |
| Brotli JS | ~390 kB | ~220 kB | −170 kB |
| CSS | ~30 kB (CDN) | ~29 kB (CDN) | ≈ 0 |

Neither bundle ships on first paint (both are behind
`import('mapbox-gl')` / `import('maplibre-gl')`), so the saving is for users
who actually open the map — but for those users the saving is material on
mobile 4G.

## Effort estimate

| Task | Effort (person-days) |
| --- | --- |
| Add `maplibre-gl` dep (dev prod), remove `mapbox-gl` + `@types/mapbox-gl` | 0.1 |
| Update `use-mapbox.ts` — rename types, drop `accessToken`, swap import, swap CSS URL | 0.5 |
| Pick + wire a replacement style JSON + API key story (env var rename `VITE_MAPBOX_TOKEN` → `VITE_MAP_STYLE_URL` + optional `VITE_MAP_API_KEY`) | 0.5 |
| Recreate 3D-buildings layer on the new style (may require different source-layer name depending on tile provider) | 0.5–1 |
| Visual QA — dark-mode look parity for streets, labels, water, park polygons | 1–2 |
| Update `vite.config.ts` `manualChunks` entry (`mapbox-gl` → `maplibre-gl`) | 0.1 |
| Update `vite.config.ts` PWA `globIgnores` regex | 0.1 |
| Update `docs/bundle-budget.md` thresholds | 0.1 |
| E2E smoke: open map, pan, zoom, tap venue, 3D building render, offline PWA warm-load | 0.5 |
| **Total** | **3–5 days** for a single engineer (median 3.5 d) |

## Risks

1. **Style fidelity.** Our current Mapbox style is the polished
   `mapbox/dark-v11`. Free MapLibre-compatible replacements are close but not
   identical. Design review required; budget ≥ 1 day of tuning.
2. **3D buildings source-layer mismatch.** Depending on the style JSON we
   switch to, `source-layer: 'building'` may be named `buildings`,
   `building_3d`, or may not exist at all on small tile sets. Mitigation:
   evaluate 2–3 style providers with 3D buildings (MapTiler Streets v2,
   Protomaps v4, OpenFreeMap Liberty).
3. **API-key rotation.** Moving from Mapbox's billed token model to a
   MapTiler/Protomaps token changes our secret-management rotation. The
   `.env.example` + runbook must be updated.
4. **`flyTo` / `easeTo` animation feel.** Subtle timing differences exist
   between mapbox-gl 3.x and maplibre-gl 5.x due to divergent
   camera-easing math. Probably unnoticeable but worth a snapshot.
5. **RTL text fallback.** We do not currently load the RTL plugin for
   Arabic/Hebrew place labels. If/when we do, MapLibre needs a separate
   plugin URL — not blocking this migration.
6. **Telemetry loss.** Mapbox's telemetry gives us view-count analytics we
   don't actually consume, but if the product team ever starts using it,
   we'd need a replacement. Not currently an issue.
7. **@types drift.** `@types/mapbox-gl` ships externally; `maplibre-gl`
   ships its own types. Anything that references mapbox-gl-specific types
   directly (we have one `import type mapboxgl from 'mapbox-gl'`) must be
   updated.
8. **Workbox precache.** The current PWA precache already excludes
   `mapbox-gl-*.js`; we'll need to add `maplibre-gl-*.js` to the same
   `globIgnores`. (Already pre-added in this wave's `vite.config.ts`.)
9. **Open-source compliance.** Confirm our chosen tile provider's TOS allows
   the commercial volume we expect. This is a legal touchpoint, not a code
   change.

## Recommendation

Proceed with the swap in a dedicated wave. The savings (~800 kB raw / 210 kB
gzip per map-opening session) justify the ~3.5 days of effort, and the
decoupling from the Mapbox proprietary pipeline is a strategic win.

Unblocking steps (not part of this wave):

1. Pick a tile provider (MapTiler, Protomaps hosted, or self-hosted
   OpenFreeMap) and obtain credentials.
2. Spike a branch that swaps `use-mapbox.ts` only, renders the existing
   canvas-only fallback under it, and ship to `preview.pulse.app` for
   design review.
3. Cut over once the style parity review passes.
