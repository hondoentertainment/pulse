# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install                  # install (Node 20+, npm; CI also supports bun)
npm run dev                  # Vite dev server on port 5000 (`npm run kill` frees it)
npm run build                # tsc -b --noCheck && vite build → dist/
npm run typecheck            # tsc -b --noCheck (build script reuses this)
npm run lint                 # eslint . --max-warnings=500 (warning budget is intentional)
npm run test                 # vitest run (jsdom, globals on)
npm run test:watch           # vitest watch
npm run test:coverage        # vitest run --coverage
npm run test:smoke           # Playwright; builds + runs preview at 127.0.0.1:4176
npm run release-check        # lint + test + build + npm audit (high)
npm run bundle-size          # scripts/check-bundle-size.mjs
npm run cap:sync             # capacitor sync (after cap:build)
npm run cap:build            # vite build && cap sync
```

Run a single test: `npx vitest run src/lib/__tests__/pulse-engine.test.ts`
Run a single Playwright spec: `npx playwright test e2e/smoke.spec.ts`

Playwright auto-builds and previews; do not start `npm run dev` in parallel on the same port. The preview server is launched with `VITE_E2E_AUTH_BYPASS=true` and `VITE_VISUAL_PREVIEW=true` so the suite can boot without Supabase credentials.

## Path Aliases

`@/*` → `src/*` (defined in `tsconfig.json` and `vite.config.ts`). Shadcn aliases also map `@/components`, `@/components/ui`, `@/lib`, `@/lib/utils`, `@/hooks`.

## Big-Picture Architecture

Pulse is a mobile-first React 19 PWA mid-transition from a Spark-KV prototype to a Supabase-backed product, with Capacitor wrappers for iOS/Android and Vercel serverless functions for the trusted server boundary. The codebase is layered so the transition can happen incrementally without rewrites.

### Three-Tier Layout

- **`src/components/` (UI)** — feature components plus Shadcn/Radix primitives in `src/components/ui/`. Lazy-loaded route shells (`AppShell`, `LoginScreen`, `OnboardingFlow`) are mounted by `src/App.tsx` behind `SupabaseAuthProvider` + `AppStateProvider`.
- **`src/hooks/` (bridge)** — React hooks that bind domain logic to UI. The provider hierarchy is `SupabaseAuthProvider` → `AppStateProvider` (`use-app-state.tsx`); `use-app-handlers.ts` owns mutations; `use-realtime-location`, `use-realtime-subscription`, `use-offline-mode`, `use-feature-flag` and friends wrap platform/Supabase concerns.
- **`src/lib/` (domain)** — pure TypeScript, no React imports. This is where scoring, recommendations, moderation, social correlation, and integrations live and where the bulk of tests sit (~60 test files in `src/lib/__tests__/`). Key engines: `pulse-engine.ts`, `venue-trending.ts`, `social-pulse-engine.ts`, `personalization-engine.ts`, `presence-engine.ts`, `crew-mode.ts`.

### Data Layer Switch (important)

`src/lib/data/` is the canonical read/write surface for venues, pulses, reactions, check-ins, follows, notifications, tickets, etc. Components/hooks should import from `@/lib/data` (the barrel), not from individual modules.

`src/lib/data/config.ts` exposes `USE_SUPABASE_BACKEND` / `hasSupabaseEnv()` / `resolveBackend()`. Behavior:

- If `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` are real (non-placeholder), reads/writes go to Supabase.
- Otherwise the data layer transparently falls back to local mock fixtures (`src/lib/mock-data.ts`, `prototype-catalog.ts`).
- `VITE_USE_SUPABASE_BACKEND` (`true`/`false`) can force the choice; without credentials, "force on" still resolves to off.

When adding a new persisted entity, follow the same pattern: a typed module in `src/lib/data/<entity>.ts` that branches on `resolveBackend()`, with both Supabase and mock paths.

### State Strategy (in transition)

- Client cache / preferences / offline queue → `@github/spark/hooks` `useKV` (Spark KV, see `src/hooks/use-app-state.tsx`).
- Server state → TanStack React Query (`src/lib/query-client.ts`), with `@tanstack/react-query-persist-client` for offline replay.
- Supabase real-time subscriptions are wired through `use-realtime-subscription.ts`.
- Offline writes are queued by `src/lib/offline-queue.ts`; the service worker uses Workbox `backgroundSync` for `POST /rest/v1/pulses` (see `vite.config.ts`).

Always use functional updates with `useKV` setters. Don't replace Spark KV en masse — the target is to keep KV for local state only as Supabase coverage grows.

### Server Boundary

- **`api/`** — Vercel-style serverless functions (TypeScript). Shared helpers live in `api/_lib/` (`anthropic.ts`, `auth.ts`, `stripe.ts`, `supabase-server.ts`, `rate-limit.ts`, `validate.ts`, `notify.ts`, `push.ts`, `moderation.ts`, `ticket-verify.ts`, etc.). New trusted-server work (API keys, webhook signing, geocoding proxy, payment processing) belongs here, not in `src/lib/`.
- **`supabase/`** — `config.toml`, `migrations/` (timestamped SQL, including RLS policies, soft-delete, realtime, ticketing, safety kit, AI concierge, creator economy, video pulses), and `functions/geocode` Edge Function.
- **`vercel.json`** — security headers, SPA rewrites, and cron schedules (`/api/wait-time/recompute` every 10 min; `/api/safety/cron/check-expired` every minute).
- **`src/lib/public-api.ts`** is tracked as a known prototype to migrate server-side (see `SECURITY.md` and `NOTES.md`).

### Auth Flow

`SupabaseAuthProvider` (`src/hooks/use-supabase-auth.tsx`) gates the app. `App.tsx` shows `LoginScreen` when there's no session, `OnboardingFlow` when `hasCompletedOnboarding === false`, and `AppShell` otherwise. `VITE_E2E_AUTH_BYPASS=true` or `VITE_VISUAL_PREVIEW=true` short-circuits the gate (used by Playwright). Supabase enforcement isn't yet across all writes — assume any write you add still needs server-side guards.

### Feature Flags

`src/lib/feature-flags.ts` reads `VITE_FF_*` / `VITE_*_ENABLED` env vars with defaults. Use `isFeatureEnabled('flagName')` — don't read `import.meta.env` directly in feature code. New flags: add to the `FeatureFlag` union, defaults map, and reader map.

### Native (Capacitor)

`capacitor.config.ts` configures iOS/Android (appId `com.hondoentertainment.pulse`, webDir `dist`). Platform-aware code goes through `src/lib/native-bridge.ts` and `src/lib/platform/`; never import Capacitor packages directly from components. Native sync runs via the `Native Sync` workflow on `native-*` tags (uses bun).

### Build / Bundle

`vite.config.ts` defines manual chunks: `react-vendor`, `motion-vendor`, `radix-vendor`, `data-vendor` (TanStack + Supabase), `observability` (Sentry + Vercel). The Spark Vite plugin and Phosphor icon proxy are required — do not remove them. Image optimizer runs in build. The PWA plugin auto-updates and uses Workbox runtime caching tuned for Supabase pulse posts.

## Conventions That Matter

- **Lint budget is real.** ESLint runs with `--max-warnings=500`; warnings are tolerated but the count is gated. Don't add new `any` casually (`@typescript-eslint/no-explicit-any` is a warning, not an error). Unused-var escape hatch is the `_` prefix.
- **TypeScript is `strictNullChecks: true`** but not full `strict`. `tsBuildInfoFile` is in `node_modules/.tmp/`; clear it if you hit incremental build oddities.
- **Mid-transition repo.** Several migrations (auth, Supabase data, Capacitor) are happening at once. Check `git status` before editing — there may be in-progress work. Prefer small, verifiable changes; don't revert unrelated local changes.
- **No React in `src/lib/`.** Keep domain modules React-free so they stay testable in vitest's jsdom env and portable to Edge/Node.
- **Named exports** over default exports outside of lazy-loaded screens.
- **Shared types** live in `src/lib/types.ts`; data-layer types are colocated with their module.
- **Animations** use Framer Motion, not CSS transitions. Dark theme with purple/cyan accents; tokens in `src/index.css` / `src/main.css`.
- **Shadcn config** (`components.json`): style `new-york`, base color `neutral`, icon library `lucide`. Both Lucide and Phosphor icons are used; pick one per surface for consistency.
- **Mobile-first.** Design for phones first; the app is installable as a PWA and runs under Capacitor.
- **Privacy-first presence.** When touching "who's here" features, preserve jittered counts and minimum-threshold logic in `presence-engine.ts`.

## Tests

- Unit/component tests: vitest with jsdom (`src/test-setup.ts`), excluded paths: `e2e/`, `tests/`, `dist/`, `node_modules/`.
- Library tests in `src/lib/__tests__/`, component tests in `src/components/__tests__/`. Fixtures under `src/lib/__fixtures__/`, server-side tests under `api/**/__tests__/`.
- E2E in `e2e/` with Playwright (chromium project only, parallel, retries 2 in CI).
- When adding a new `src/lib/` module, add a matching `<module>.test.ts`. When adding a new data-layer module, mock the Supabase client rather than internal modules.

## CI

`.github/workflows/ci.yml` runs four jobs on push/PR: `lint`, `test`, `build`, `smoke-preview` (uploads Playwright report), plus a non-blocking `dependency-audit`. Required checks per `RELEASE_CHECKS.md`: `lint`, `test`, `build`, `smoke-preview`. `deploy.yml` is manual (`workflow_dispatch`) and deploys to Vercel preview/production after a quality gate. `lighthouse.yml` runs scheduled performance audits. `native-sync.yml` syncs Capacitor on `native-*` tags.

## Where to Look

| Need to… | Start here |
|---|---|
| Add a venue/pulse/etc. read or write | `src/lib/data/<entity>.ts` + barrel in `index.ts` |
| Add scoring/recommendation logic | `src/lib/pulse-engine.ts`, `venue-trending.ts`, `personalization-engine.ts` |
| Wire a new screen | Lazy-load from `src/components/AppShell.tsx`; state via `use-app-state` / `use-app-handlers` |
| Add a server route | `api/<area>/<route>.ts` with shared helpers from `api/_lib/` |
| Add a Supabase table/policy | New timestamped migration in `supabase/migrations/` |
| Toggle a feature | Extend `src/lib/feature-flags.ts`; read with `isFeatureEnabled` |
| Native platform code | `src/lib/native-bridge.ts` or `src/lib/platform/` (never import `@capacitor/*` from components) |
| Background docs | `ARCHITECTURE.md`, `PRD.md`, `PRODUCTION_ROLLOUT.md`, `NEXT_PHASES.md`, `SECURITY.md`, `docs/` |
