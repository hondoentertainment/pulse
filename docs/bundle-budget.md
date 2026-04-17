# Bundle-size budget

Enforced via `scripts/check-bundle-size.mjs`, wired into CI as the
`Bundle-size budget` step after `bun run build`.

## How it works

1. `vite build` emits JS chunks into `dist/assets/`.
2. The script reads every `*.js` chunk, gzips it in-memory, and compares
   the gzipped size against a named budget (when one matches) or the
   default per-chunk budget.
3. It also sums gzipped sizes and enforces a soft total cap.
4. Any overage exits non-zero and fails CI.

## Current budgets

All sizes are **gzipped**.

| Chunk (regex)          | Budget   | Rationale                                               |
| ---------------------- | -------- | ------------------------------------------------------- |
| `index-*.js` (main)    | 300 KB   | First-paint entry — keep lean.                          |
| `react-vendor-*.js`    | 250 KB   | React 19 + ReactDOM + Router + QueryClient.             |
| `mapbox-gl-*.js`       | 500 KB   | Huge, but lazy-loaded (only on `/map`).                 |
| `sentry-*.js`          | 120 KB   | Error reporting; lazy-init.                             |
| `supabase-*.js`        | 80 KB    | Client-only; acceptable.                                |
| `framer-motion-*.js`   | 60 KB    | Shared vendor chunk.                                    |
| **Any other JS chunk** | 120 KB   | Catch-all regression trip-wire for new routes/features. |
| **Total gzipped JS**   | 1.6 MB   | Soft upper bound across all chunks.                     |

Numbers roughly match the post-build inventory as of Wave 2a. Reality today:
main ~59 KB, react-vendor ~197 KB, mapbox ~459 KB, sentry ~83 KB,
supabase ~45 KB, framer-motion ~38 KB, total gzip ~1.0 MB. Plenty of
headroom, which is the point — we're gating against regressions, not
squeezing savings.

## How to raise a budget (emergency path)

1. Run `bun run build && bun run bundle-size` locally to confirm the
   violation and see current sizes.
2. Open `scripts/check-bundle-size.mjs`, bump the relevant budget, and
   update the table above in the same PR.
3. Justify the raise in the PR description. Prefer code-splitting,
   lazy-import, or removing the dependency before raising.

## How to tighten a budget

Good hygiene: when a chunk comes in ≥ 20% below its budget consistently
for a few releases, tighten the budget to ~110% of the observed size.
This keeps the gate useful as the app shrinks.

## Running locally

```bash
bun run build         # emits dist/assets/*
bun run bundle-size   # reads dist/assets and checks budgets
```

If you forget to build first, the script exits with a clear message.

## Bypass (not recommended)

To bypass in a true emergency, skip the CI step manually by pushing a
revert of the workflow change; do **not** comment out budgets and forget
about them. Track any temporary bypass as a ticket so we restore the
gate in the following release.
