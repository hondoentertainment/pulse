# Pulse — Codebase Review & Next Phases of Work

> Last verified 2026-09-01 after the ESM + Signal-test cycle. **Pulse Signal is the shipping product** (`VITE_APP_MODE=signal`). Venue discovery stays in-repo behind `VITE_APP_MODE=venue`. See [PRD_SIGNAL.md](PRD_SIGNAL.md). Do not merge a default-mode flip.

## Current State Assessment

### Project Overview

**Pulse Signal** is a twice-daily check-in PWA (energy, mood, stress, sleep → a 0–100 signal, streak, and one next step). The older nightlife/venue discovery shell remains flag-gated and is not the live product.

### Scale

| Metric | Count |
|--------|-------|
| Unit / component test files | 108 passing + 2 skipped (Vitest) |
| Total unit tests | 1216 passing + 20 skipped |
| Signal smoke | `npm run test:smoke:signal` (`e2e/smoke.spec.ts`) |
| Venue smoke | advisory (`test:smoke:venue`, CI `continue-on-error`) |
| CI/CD workflows | 4 |

### Build Status (2026-09-01)

- **Tests:** Green — including `analytics.test.ts` and `interactive-map.test.ts` (the old “failing tests” bullets were stale).
- **Lint:** **0 errors**, ~194 warnings. Do not raise `--max-warnings`.
- **Build:** Passes. First-paint work in this cycle: keep Sentry off the Signal critical path, stop Phosphor leaking into `react-vendor`, gate Spark `proxy.js` to `vite serve`, lazy-load the venue shell.
- **Bundle:** `react-vendor` no longer includes `@phosphor-icons/react`; Sentry is its own async chunk (not shared with `@vercel/analytics`). PWA precache ignores `proxy.js` / Mapbox.

For architecture details, see [ARCHITECTURE.md](ARCHITECTURE.md).

---

## Phase 1: Stabilization & Code Health

**Priority:** Critical
**Goal:** Green CI, zero lint errors, passing tests.

### 1.1 Fix Failing Tests

- [x] `src/lib/__tests__/analytics.test.ts` — passing (11 tests). The failure note was stale.
- [x] `src/lib/__tests__/interactive-map.test.ts` — passing (7 tests). The failure note was stale.
- [x] `npm test` — 108 files / 1216 tests passing on current `main` (2026-09-01)

### 1.2 Resolve Lint Errors

- [x] Zero lint **errors** (`npm run lint` → 0 errors)
- [x] Unused import/var warnings trimmed this cycle (prefix `_` or delete). Do not raise `--max-warnings`.
- [x] Target: zero errors. Remaining warnings are mostly `any` / a11y; keep trending down.

### 1.3 Bundle Size Optimization

Measured 2026-09-01 after this slice (`vite build` / Signal default):

| Chunk | Raw | First paint? |
|-------|-----|----------------|
| `react-vendor` | ~193 kB | yes |
| `index` | ~120 kB | yes |
| `supabase` | ~174 kB | yes (auth) |
| `observability` (`@vercel/*` only) | ~7.5 kB | yes |
| `phosphor` | ~349 kB | **no** — loaded with Login/Signal/Venue |
| `sentry` | ~448 kB | **no** — idle / error path |
| `VenueApp` | ~111 kB | **no** — `VITE_APP_MODE=venue` only |
| PWA precache | **~2.57 MB** (was ~4.1 MB) | under 3 MB |

- [x] Lazy-load Sentry (idle init + separate chunk; do not bucket with Vercel analytics)
- [x] Keep venue routes off the Signal entry graph (`VenueApp` lazy)
- [x] PWA precache ignores Spark `proxy.js` and map vendor chunks
- [x] Precache under 3 MB (~2.57 MB)

---

## Phase 2: Test Coverage Expansion

**Priority:** High
**Goal:** Meaningful test coverage for critical user flows.

### 2.1 Component Testing

Priority components needing tests:

- [x] Signal: LoginScreen heading / auth-gated path
- [x] Signal: AM/PM check-in writes `day_key` + `check_in_window`; same window cannot save twice; evening after noon
- [x] Signal: weekly summary / tag patterns, CSV of this account’s rows, delete-my-data, pilot email
- [ ] `OnboardingFlow` — first-run experience (venue; parked)
- [ ] `InteractiveMap` — core map interactions (venue; parked)
- [ ] `VenuePage` — venue detail rendering and actions (venue; parked)
- [ ] `BottomNav` / `MainTabRouter` — navigation (venue; parked)
- [ ] `CreatePulseDialog` — content creation flow (venue; parked)
- [ ] `GlobalSearch` — search experience (venue; parked)
- [ ] `NotificationFeed` — notifications rendering (venue; parked)

**Progress:** UI primitives, cards, navigation, venue features, presentational components, and feeds/lists test files have been created and are passing.

### 2.2 Integration Testing

- [ ] Supabase auth flow (`use-supabase-auth.tsx`)
- [ ] Offline queue sync behavior (`offline-queue.ts`)
- [ ] Real-time subscription handling (`use-realtime-subscription.ts`)

### 2.3 E2E Test Expansion

- [ ] Venue search and selection flow
- [ ] Pulse creation flow
- [ ] Social interactions (favorites, follows, crew)
- [ ] Offline/online transition behavior

### 2.4 CI Enhancements

- [ ] Add code coverage reporting and minimum thresholds
- [ ] Add Prettier formatting enforcement
- [ ] Add bundle size budget check to CI

---

## Phase 3: Architecture & Performance

**Priority:** High
**Goal:** Reduce complexity, improve performance, prepare for scale.

### 3.1 State Management Refactor

- [ ] `use-app-state.tsx` is a monolithic state provider — split into domain-specific contexts (venue, social, UI)
- [ ] `App.tsx` passes many props — colocate state closer to consumers
- [ ] Fully adopt TanStack Query for server state (partially set up via `query-client.ts`)

### 3.2 Code Splitting & Lazy Loading

- [ ] Route-based splitting for sub-pages (settings, achievements, events, playlists)
- [ ] Lazy load heavy integrations (Spotify, maps, analytics dashboards)
- [ ] Defer Three.js loading until 3D features are accessed

### 3.3 Mock Data Decoupling

- [ ] `mock-data.ts`, `global-venues.ts`, `us-venues.ts` contain hardcoded venue data
- [ ] Transition to API-driven data; mock data should only exist in test fixtures
- [ ] Replace `use-simulated-activity.ts` with real data sources

### 3.4 Dead Code Audit

- [x] Signal startup: Sentry/Vercel chunk split, Phosphor/`react-vendor` leak, Spark plugin serve-only, venue shell lazy-load (2026-09-01)
- [x] Signal entry no longer mounts TanStack persist or Spark on the default path (`QueryClientProvider` only; Spark is `import.meta.env.DEV`; venue persist stays in `AppProviders`)
- [ ] Audit venue-only modules with no Signal consumers (candidates: `white-label.ts`, `public-api.ts`, `twitter-ingestion.ts`) — **do not delete**; they stay flag-gated
- [ ] Remove unused exports identified by remaining lint warnings

---

## Phase 4: Backend & Data Layer

**Priority:** Medium-High
**Goal:** Move from client-side mock data to real backend services.

### 4.1 Supabase Integration

- [ ] Design database schema for venues, pulses, users, reactions, stories, events, notifications
- [ ] Implement real authentication flow (replace mock user `nightowl`)
- [ ] Set up Row Level Security (RLS) policies
- [ ] Enable real-time subscriptions for live venue activity

### 4.2 API Layer

- [ ] Implement real endpoints in Supabase Edge Functions
- [ ] Define API contracts for venue CRUD, pulse creation, social actions
- [ ] Move rate limiting to server-side enforcement
- [ ] Implement webhook HMAC signing on the server

### 4.3 Data Persistence

- [ ] Offline queue needs real sync target (Supabase)
- [ ] User preferences should persist to backend
- [ ] Implement cache invalidation strategy with TanStack Query

---

## Phase 5: Production Readiness

**Priority:** Medium
**Goal:** Security, monitoring, and operational readiness.

See [PRODUCTION_ROLLOUT.md](PRODUCTION_ROLLOUT.md) for the detailed rollout plan and [SECURITY.md](SECURITY.md) for security priorities.

### 5.1 Security

- [ ] Content moderation with server-side enforcement
- [ ] Payment processing with PCI-compliant integration
- [ ] Input sanitization audit across all user-input surfaces
- [ ] Auth token handling and session management

### 5.2 Monitoring & Observability

- [ ] Verify Sentry error boundary coverage across all routes
- [ ] Add structured logging for backend functions
- [ ] Performance monitoring (Web Vitals via Lighthouse CI)
- [ ] Uptime monitoring and alerting

### 5.3 Accessibility

- [ ] Raise Lighthouse accessibility target from 0.85 to 0.95+
- [ ] Full keyboard navigation audit
- [ ] Screen reader testing for critical flows
- [ ] Color contrast verification for all energy level indicators

### 5.4 Internationalization

- [ ] Audit `i18n.ts` for completeness
- [ ] Externalize all user-facing strings
- [ ] RTL layout support if targeting international markets

---

## Phase 6: Feature Polish & UX

**Priority:** Medium
**Goal:** Refine existing features before adding new ones.

### 6.1 Map Experience

- [ ] Fix clustering algorithm edge cases
- [ ] Time-aware category boosting
- [ ] Performance optimization with 240+ venues at high zoom

### 6.2 Social Features

- [ ] End-to-end crew mode verification
- [ ] Friend suggestions and activity feed
- [ ] Story creation and viewing flow
- [ ] Real-time presence system

### 6.3 Creator & Venue Owner Tools

- [ ] Connect dashboards to real data sources
- [ ] Verify rendering of VenueOwnerDashboard and CreatorDashboard
- [ ] Analytics dashboards with real metrics

---

## Recommended Execution Order

| Priority | Phase | Status | Impact |
|----------|-------|--------|--------|
| 1 | Phase 1: Stabilization | **Done for gates** — tests/lint-errors/build/Signal smoke. Unused-var warnings trimmed. | Unblocks CI |
| 2 | Phase 3.4: Dead Code / Signal bundle | **Done for Signal entry** — persist/Spark off default path; venue modules stay. | Signal startup |
| 3 | Phase 2.1–2.2: Core Test Coverage | **Signal flows covered this cycle**; venue component tests stay parked | Prevents regressions |
| 4 | Phase 3.1–3.3: Architecture | Later | Enables scaling |
| 5 | Phase 4: Backend Integration | Human ops for prod migrations (#64); code already Signal-first | Moves beyond prototype |
| 6 | Phase 5: Production Readiness | Later — do not block on Apple Health / ticketing / Stripe | Launch bar |
| 7 | Phase 6: Feature Polish | Parked for venue map/onboarding/pulse-creation | Venue UX only |
| 8 | Phase 2.3–2.4: E2E & CI | Signal smoke exists; do not expand venue E2E unless a Signal smoke is missing | Long-term quality |

---

## Related Documentation

- [README.md](README.md) — project overview and setup
- [ARCHITECTURE.md](ARCHITECTURE.md) — system architecture and module boundaries
- [PRODUCTION_ROLLOUT.md](PRODUCTION_ROLLOUT.md) — phased rollout plan
- [RELEASE_CHECKS.md](RELEASE_CHECKS.md) — pre-deployment checks
- [CONTRIBUTING.md](CONTRIBUTING.md) — development workflow and code style
- [SECURITY.md](SECURITY.md) — security policy and priorities
