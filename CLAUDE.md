# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Snapshot

Pulse is a mobile-first PWA that shows where nightlife energy is happening right now. The app is an **advanced prototype**: the feature surface is broad and tested, but several production concerns (real auth enforcement everywhere, full Supabase persistence, server-side integration proxies) are still being migrated off client stubs. Treat work as evolving a prototype toward production rather than a green-field build — see `PRODUCTION_ROLLOUT.md` and `NEXT_PHASES.md` for the phased plan.

Native iOS/Android wrappers are thin Capacitor shells around the same web bundle (`capacitor.config.ts`, `ios/`, `android/`).

## Common Commands

All scripts are defined in `package.json`. Node 20+, npm is the primary package manager (`package-lock.json` is canonical; `bun.lock` exists for the `load-test` script only).

```bash
npm run dev              # Vite dev server on :5000 (kill with `npm run kill`)
npm run build            # tsc -b --noCheck && vite build (produces dist/)
npm run typecheck        # tsc -b --noCheck  (no emit)
npm run lint             # eslint . --max-warnings=500
npm run test             # vitest run (unit + component)
npm run test:watch       # vitest (watch)
npm run test:coverage    # vitest run --coverage (enforces thresholds)
npm run test:smoke       # playwright test (builds + previews first, baseURL :4173)
npm run bundle-size      # enforce per-chunk budget (scripts/check-bundle-size.mjs)
npm run release-check    # lint → test → build → audit, all must pass
npm run preview          # serve built dist/ locally
npm run cap:sync         # vite build && cap sync (iOS/Android bundle)
```

Single-test runs use vitest path matching:

```bash
npx vitest run src/lib/__tests__/pulse-engine.test.ts
npx vitest run -t 'calculates decay'   # filter by test name
```

The vitest config (`vite.config.ts`) **excludes** `e2e/**`, `tests/**`, and `.claude/worktrees/**`. Coverage is **scoped to `src/lib/**`** (UI components, fixtures, data stubs, and `auth/` / `observability/` / `a11y/` shims are intentionally excluded). Thresholds live in `vite.config.ts` and are set ~2% below actuals — if you drop coverage, raise it back rather than lowering thresholds.

## Architecture

`src/App.tsx` is a thin composition root:

```
AppProviders  → ErrorBoundary, PersistQueryClientProvider, BrowserRouter,
                SupabaseAuthProvider, AppStateProvider, Analytics/SpeedInsights
AppBootstrap  → one-shot lifecycle (Sentry init, global error listeners)
AppRoutes     → tab / sub-page / modal switcher; heavy surfaces are React.lazy()
```

The three-layer separation is load-bearing — keep it that way:

- **`src/lib/`** — pure TypeScript domain logic. **No React imports.** Scoring (`pulse-engine.ts`), recommendations, trending, social, moderation, integrations, analytics, etc. This is what the unit tests cover and what coverage thresholds enforce.
- **`src/hooks/`** — bridges between `lib/` and the UI. `use-app-state.tsx` is the main state provider; `use-app-handlers.ts` owns the event handlers for pulse submission, reactions, check-ins, etc.
- **`src/components/`** — React views. Shadcn/Radix primitives live under `src/components/ui/`. Feature subfolders exist for `ai-concierge`, `creator`, `filters`, `safety`, `ticketing`, `venue-admin`, `video`.

Shared types live in `src/lib/types.ts`. The path alias `@/*` → `src/*` is set in both `tsconfig.json` and `vite.config.ts`.

### State model

- **App state (prototype default):** Spark KV hooks (`useKV` from `@github/spark/hooks`) in `use-app-state.tsx`, bootstrapped from `mock-data.ts` / `us-venues.ts` / `global-venues.ts`. Always use functional updates with `useKV` setters.
- **Server state (target):** TanStack Query v5 with IndexedDB persistence (`query-client.ts`, wired in `AppProviders`). The `USE_SUPABASE_BACKEND` flag in `src/lib/data` gates whether reads go to Supabase or to seeded fixtures.
- **Offline queue:** `src/lib/offline-queue.ts` queues writes (pulse creation, reactions) while offline; the service worker also has a `pulse-sync-queue` background-sync rule (`vite.config.ts`).

### Score engine

`pulse-engine.ts` weights recency (90-min decay), energy rating (Dead=1 … Electric=4), volume, velocity, engagement, and credibility (0.5×–2.0×). Pulses auto-expire after 90 minutes. Surge detection and trending live in `venue-trending.ts`; predictive surge in `predictive-surge.ts`; social correlation in `social-pulse-engine.ts`.

### Server surface (`api/`)

Vercel Edge Functions — NOT part of the Vite client bundle. Shared helpers in `api/_lib/` (auth, rate limit, Stripe, Supabase server client, anthropic, moderation, push, referral attribution, ticket verification, validation). Never prefix server-only env vars with `VITE_` or they will be inlined into the client bundle (see `.env.example`).

### Database

Supabase schema and RLS policies live in `supabase/migrations/` (timestamped SQL). Recent waves add soft-delete, ticketing, safety kit, AI concierge, video pulses, push tokens, and structured venue metadata. Migrations are additive; prefer new migrations over editing existing ones.

### Build / bundle

`vite.config.ts` defines aggressive manual chunk splitting (`react-vendor`, `radix`, `framer-motion`, `charts`, `three`, `mapbox`, `sentry`, `tanstack-query`, etc.). **Order matters** in `manualChunks()` — specific matchers must run before generic ones (see the comment about `react-error-boundary` previously being swallowed by a permissive `react` matcher). `npm run bundle-size` enforces per-chunk limits defined in `docs/bundle-budget.md` and runs in CI.

The dev-only `sparkPlugin()` emits a 1.5 MB `proxy.js` runtime that only belongs inside the Spark workbench — it is already gated behind `isDev`, so do not re-enable it for production builds.

## Conventions

- **TypeScript strict-null-checks is on.** Avoid `any`; add explicit interfaces in `src/lib/types.ts` for cross-module shapes.
- **Named exports preferred.** Path imports use the `@/` alias — not relative paths that climb out of `src/`.
- **ESLint cap:** `--max-warnings=500`. Don't bypass; fix or scope-suppress. `no-static-element-interactions`, `click-events-have-key-events`, and `no-noninteractive-element-interactions` are intentionally off because the app uses `motion.button` + custom gestures.
- **Animations:** Framer Motion, not CSS transitions.
- **Tests:** unit/component via Vitest, E2E via Playwright. File naming: `<module>.test.ts[x]`. Library tests in `src/lib/__tests__/`, component tests in `src/components/__tests__/`, fixtures in `src/lib/__fixtures__/`. Mock external deps, don't mock internal modules.
- **Commit style:** conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`). Subject ≤72 chars; add a body for non-trivial changes explaining the "why".
- **Branches:** feature work off `main`; this worktree's development branch is `claude/add-claude-documentation-g5Z6Y`.

## Things that look weird but are intentional

- `src/lib/public-api.ts` has no component/hook consumers and is flagged as "dead" — it's a **prototype** tracked in `SECURITY.md` that must move to `api/` server routes before launch. Leave it alone (see `NOTES.md`).
- `src/lib/twitter-ingestion.ts` is consumed only via `use-social-pulse.ts` re-exports; the module is alive, just indirect.
- `build` uses `tsc -b --noCheck` — type-checking is intentionally skipped during the bundle step to keep builds fast; rely on `npm run typecheck` and `npm run lint` (and IDE feedback) for type correctness.
- `lighthouse.yml`, `deploy.yml`, and `native-sync.yml` are additional CI workflows alongside `ci.yml`.

## Documentation map

- `README.md` — product overview, tech stack, local setup
- `ARCHITECTURE.md` — system diagram, data flow, layer responsibilities
- `CONTRIBUTING.md` — code style, branching, test conventions
- `PRD.md` — product requirements and feature specs
- `PRODUCTION_ROLLOUT.md` / `NEXT_PHASES.md` — phased work plan from prototype to launch
- `RELEASE_CHECKS.md` — pre-deploy automated and manual checks
- `SECURITY.md` — security policy, client-trust boundaries, items needing server migration
- `IMPLEMENTATION_SUMMARY.md`, `SOCIAL_PULSE_IMPLEMENTATION.md` — feature deep-dives
- `docs/` — operational runbooks (observability, payments, content safety, on-call, bundle budget, CI gates, native setup, etc.)
- `.cursor/skills/` — project-level ops agents (intake triage, release gates, incident response, quality gate, runbooks)
