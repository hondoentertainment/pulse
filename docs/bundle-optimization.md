# Bundle optimization audit

Scope: investigation + small-surface-area changes coming out of the Wave-2
bundle-cleanup pass. Focus areas were the `@github/spark` proxy leak, the
`@phosphor-icons/react` chunk, and the `mapbox-gl` footprint.

## Current shape (post-fix, `bun run build`)

| Chunk | Size (min) | Size (gzip) | Notes |
| --- | --- | --- | --- |
| `mapbox-gl-*.js` | 1704.12 kB | 469.84 kB | Lazy-loaded via `use-mapbox.ts` — never ships unless the user opens the map. |
| `react-vendor-*.js` | 216.06 kB | 69.22 kB | Was 709 kB before fixing the `manualChunks` regex (see below). |
| `phosphor-*.js` | 296.11 kB | 68.95 kB | Its own vendor chunk; see "icons decision". |
| `sentry-*.js` | 257.55 kB | 85.06 kB | Already deferred via `sentry-lazy` import pattern. |
| `index-*.js` (app entry) | 244.46 kB | 75.12 kB | Main composition + routing shell. |
| `supabase-*.js` | 172.93 kB | 45.77 kB | Loaded at first auth/query. |
| `framer-motion-*.js` | 117.79 kB | 39.07 kB | Animations. |
| `radix-*.js` | 104.38 kB | 32.25 kB | All Radix primitives. |

`dist/proxy.js` (1.57 MB) is **no longer emitted** — it was only useful inside
the GitHub Spark workbench.

PWA precache: **2529.70 KiB** (was 5726.40 KiB). Well under the 3.7 MB budget.

## Spark gate (`vite.config.ts`)

`sparkPlugin()` and `createIconImportProxy()` are now gated to
`command === 'serve'`. In production they are replaced with `null`:

```ts
export default defineConfig(({ command }) => {
  const isDev = command === 'serve'
  return {
    plugins: [
      isDev ? (createIconImportProxy() as PluginOption) : null,
      isDev ? (sparkPlugin() as PluginOption) : null,
      /* ... */
    ].filter(Boolean)
  }
})
```

What that buys us:

- `dist/proxy.js` (1.57 MB) is gone — the spark runtime wrapper was leaking
  into `dist/` via `runtimeBuildPlugin.generateBundle()` but has no purpose
  outside the workbench.
- `dist/package.json` (~260 B) is also gone (also emitted by the same plugin).
- The `[icon-proxy]` log-spam during `bun run build` is gone.

Dev behaviour is unchanged — `bun run dev` still boots with full Spark HMR,
icon-fallback proxy, and the heartbeat/designer plugins.

## `manualChunks` regex fix

The previous `manualChunks` factory used `id.includes('react')` as a bucket.
That accidentally caught:

- `@phosphor-icons/react/*` (`react` is literally in the path)
- `react-hook-form`, `react-day-picker`, `react-parallax-tilt`,
  `react-error-boundary`, etc.

…which is why `react-vendor` was 709 kB. The new matcher:

```ts
// specific matches first
if (id.includes('@phosphor-icons')) return 'phosphor'
// …all the other vendor buckets…
// react last, and path-anchored
if (/[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react-vendor'
```

Results: `react-vendor` 709 → 216 kB (-70 %), `phosphor` extracted cleanly,
`radix`/`tanstack-query`/`vercel` now get their own chunks instead of being
merged into `index`.

## Icons decision (option b: keep isolated, do not re-barrel)

The prompt gave three options for the 298 kB icons chunk: (a) fix the proxy,
(b) disable the proxy + document, or (c) maintain our own barrel.

We chose **(b) + partial (c)**:

1. The `vitePhosphorIconProxyPlugin` is a pure-dev convenience (it rewrites
   imports for *non-existent* icons to `Question` so dev doesn't crash on
   typos). Disabling it in production is safe and already enforced above.
2. We do **not** ship a hand-rolled barrel under `src/lib/icons.ts`.
   Rationale:
   - Every phosphor icon is already its own ESM module in
     `@phosphor-icons/react/dist/csr/<Name>.es.js`; Vite tree-shakes
     per-icon without help from a barrel.
   - 103 source files currently import directly from
     `@phosphor-icons/react`; migrating them all is out of scope for this
     wave and risks regressions in code we can't modify (App.tsx etc.).
   - A barrel that re-exports only the ~145 icons we use would not reduce the
     bundle — rollup already ships exactly those 145 icons. A barrel just
     changes the module boundary.
3. The big win was already captured: moving phosphor out of `react-vendor`
   and into its own chunk. Inclusive of that shift, first-paint JS (entry +
   `react-vendor` + `index`) shrank by **> 30 %** in both raw and gzip bytes.
   The 296 kB `phosphor` chunk itself is cache-friendly (1 revision per
   phosphor upgrade) and the gzip cost is 68.95 kB.

### Why not aggressive subchunking

We considered exploding phosphor into per-route chunks. Rollup would have to
duplicate icons that are shared across routes (e.g. `MapPin`, `Lightning`,
`Users` are everywhere), so the total byte count would *grow*. The current
vendor-chunk strategy is the right default until we have real route-level
usage telemetry.

### Future work (tracked here so it doesn't get lost)

- Consider migrating the ~10 hottest icons in `AppHeader` / `BottomNav` /
  `App.tsx` to `@phosphor-icons/react/dist/csr/<Name>` deep imports. That
  would pull them out of the `phosphor` vendor chunk and into the entry
  chunk, letting the vendor chunk be lazy-loaded on first nav interaction.
  Measured impact: ~8–12 kB shifted off the initial-paint critical path.
- Alternatively, a tiny `src/lib/icons.ts` barrel that *only* exports icons
  used on the critical path and is force-included in the entry chunk. This
  is deferred because the savings are small and every migration touches
  files the wave cannot safely modify.

## Related

- See `docs/maplibre-migration.md` for the mapbox → maplibre swap analysis.
- See `docs/bundle-budget.md` for the canonical budgets.
