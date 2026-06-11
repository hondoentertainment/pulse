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

- [ ] Enforce auth on all write paths server-side (RLS policy audit across tables)
- [ ] Server-verified roles for admin/moderation/owner surfaces
- [ ] Retire `src/lib/public-api.ts` client prototype once `api/keys/generate.ts` fully replaces it (tracked in NOTES.md)
- [ ] Server-side content moderation before persistence (client-side exists)
- [ ] Rate limiting on public API routes (client-side limiter exists; server enforcement needed)
- [ ] Tighten lint `no-explicit-any` budget toward zero (currently ~158, all in tests/mocks)

### 3. State management split (scalability)

`src/hooks/use-app-state.tsx` is still a monolithic provider. Split into
VenueContext / SocialContext / UIContext to reduce re-renders. Also remove the
duplicated mock-friends lists in `use-app-state.tsx` and `hooks/api/use-user.ts`.

### 4. Integration tests for critical flows

- [ ] Supabase auth flow (OAuth + magic link) against a local Supabase
- [ ] Offline queue → Supabase sync on reconnect
- [ ] Real-time subscription lifecycle
- [ ] Stripe checkout happy path (test mode) in E2E

### 5. Ops & compliance

- [ ] Uptime monitoring + alerting (docs/observability.md)
- [ ] Enable Dependabot/Renovate
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
