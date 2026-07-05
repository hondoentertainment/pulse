# Pulse — Recommended Next Steps

> Originally generated 2026-04-04 from a full codebase audit. Updated 2026-06-11
> after the production-readiness pass (telemetry pipeline, CSP, security
> headers, lint ratchet). Prioritized by impact and unblock potential.

## Current Health Snapshot (2026-06-11)

| Metric | Status |
|--------|--------|
| **Build** | Passes (route-split; largest chunk `react-vendor` ~576 KB / 159 KB gzip) |
| **Lint** | 0 errors, ~158 warnings (all `no-explicit-any`, mostly test mocks; budget ratcheted to 160) |
| **Unit tests** | 1145 passing, 19 skipped (90 files) |
| **E2E** | Smoke suite passing |
| **Backend** | Supabase data layer wired behind `USE_SUPABASE_BACKEND` flag (`src/lib/data/`); falls back to mock fixtures without credentials |
| **Observability** | Sentry lazy-init after first paint via `sentry-lazy`; buffered telemetry flushes on init |
| **Security headers** | CSP (meta + Vercel header), HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy |

---

## Completed (April–June 2026)

- ~~Fix component test icon mock~~ — all component suites green
- ~~Fix interactive-map clustering test~~ — passing
- ~~Dead code audit~~ — `white-label.ts` removed (see NOTES.md); unused `AppBootstrap.tsx` / `AppProviders.tsx` parallel bootstrap removed
- ~~Bundle optimization~~ — Sentry dynamically imported post-paint; routes lazy-loaded; vendor chunks split
- ~~Route-based code splitting~~ — Settings, Achievements, Events, Playlists, Night Planner, dashboards, moderation queue all lazy
- ~~Supabase data layer~~ — `src/lib/data/*` reads/writes Supabase when `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` are set
- ~~Sentry telemetry pipeline~~ — `main.tsx` now initialises through `sentry-lazy.initSentry()`, so events queued by `logger.ts`/`web-vitals.ts`/`analytics.ts` are flushed instead of dropped
- ~~CSP correctness~~ — policy now allows Stripe.js (PCI-required CDN), Stripe payment iframes, Mapbox API + blob workers, Sentry ingest, and Vercel vitals while staying default-deny
- ~~HSTS + header-level CSP~~ — added to `vercel.json` (including `frame-ancestors 'none'`)
- ~~Lint ratchet~~ — unused vars/imports and a11y defects fixed; `--max-warnings` lowered 500 → 160

---

## Remaining Path to Launch

### 1. Production environment & data seeding (highest priority)

The code path exists; production config does not. To go live:

- [ ] Provision production Supabase project; set `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` in Vercel
- [ ] Apply migrations (`npx supabase db push`), including `20260429000000_realtime_venue_intelligence.sql` (see docs/PRODUCTION_DATA_PATH.md)
- [ ] Seed nationwide venue catalog into the `venues` table (replaces `us-venues.ts` prototype coverage)
- [ ] Set `VITE_SENTRY_DSN`, `VITE_MAPBOX_TOKEN`, `VITE_STRIPE_PUBLISHABLE_KEY` and server-side Stripe/webhook secrets
- [ ] Verify per docs/PRODUCTION_DATA_PATH.md checklist

### 2. Security hardening (before public launch)

Tracked in SECURITY.md:

- [x] Enforce auth on all write paths server-side — comprehensive RLS in
  `supabase/migrations/20260417000002_rls_policies_enforcement.sql`
  (owner-only writes via `auth.uid()`, admin bypass via `is_admin()`, anon
  write GRANTs revoked). Verify against the live DB after provisioning.
- [x] Server-verified roles — `verifySupabaseJwt` + `SUPABASE_ADMIN_EMAILS`
  gate admin routes; `is_admin()` gates admin RLS.
- [x] Retire `src/lib/public-api.ts` client prototype — removed 2026-07-05;
  `api/keys/generate.ts` + `api/webhooks/sign.ts` own it server-side.
- [ ] Server-side content moderation before persistence (client-side exists)
- [ ] Rate limiting on public API routes — server limiter exists in
  `api/_lib/rate-limit.ts`; confirm it's applied on every public route.
- [ ] Tighten lint `no-explicit-any` budget toward zero (currently ~158, all in tests/mocks)

### 3. State management split (scalability)

`src/hooks/use-app-state.tsx` is still a monolithic provider (~729 lines, 57
state hooks, 5 component consumers of `ALL_USERS`). Split into VenueContext /
SocialContext / UIContext to reduce re-renders. This is an optimization, not a
launch blocker — sequence it behind a compatibility shim (keep `useAppState`'s
public shape) so the existing suite stays green.

- [x] Removed the duplicated mock-friends lists — the entire dead
  `src/hooks/api/` subtree (a parallel TanStack Query layer with zero
  consumers, superseded by `use-app-state` + `src/lib/data/`) was deleted,
  which is where `MOCK_USERS` duplicated `ALL_USERS`.

### 4. Integration tests for critical flows

- [x] Supabase auth flow — `src/__tests__/integration/auth-flow.test.ts`,
  `src/hooks/__tests__/use-supabase-auth.test.tsx`
- [x] Offline queue → Supabase sync — `src/__tests__/integration/offline-queue.test.ts`,
  `src/lib/__tests__/offline-queue-replay.test.ts`
- [x] Real-time subscription lifecycle — `src/hooks/__tests__/use-realtime-subscription.test.tsx`
  (added 2026-07-05; covers enable/disable/cleanup + batched pulse-insert mapping)
- [ ] Stripe checkout happy path (test mode) in E2E — needs test-mode keys

### 5. Ops & compliance

- [ ] Uptime monitoring + alerting (docs/observability.md)
- [x] Enable Dependabot — `.github/dependabot.yml` (npm daily, devcontainers weekly)
- [ ] App Store / Play Store submission per docs/native/release-checklist.md
- [ ] Privacy policy + ToS review for payment and location data

---

## Related Docs

- [NEXT_PHASES.md](NEXT_PHASES.md) — detailed phase plan
- [ARCHITECTURE.md](ARCHITECTURE.md) — system design
- [PRODUCTION_ROLLOUT.md](PRODUCTION_ROLLOUT.md) — rollout plan
- [SECURITY.md](SECURITY.md) — security priorities
- [RELEASE_CHECKS.md](RELEASE_CHECKS.md) — pre-deploy checklist
- [docs/PRODUCTION_DATA_PATH.md](docs/PRODUCTION_DATA_PATH.md) — Supabase production data path
