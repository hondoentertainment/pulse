# Pulse — Codebase Review & Next Phases of Work

## Current State Assessment

### Project Overview

Pulse is a nightlife/venue discovery PWA built with React 19, TypeScript, and Vite. It features an interactive map, real-time venue pulse scores, social features, crew coordination, stories, integrations (Spotify, Uber, Lyft), and a comprehensive venue analytics platform.

### Scale

| Metric | Count |
|--------|-------|
| Lines of TypeScript/TSX | ~60,243 |
| Library modules (`src/lib/`) | 69 |
| Components (`src/components/` + `ui/`) | 125+ |
| Custom hooks (`src/hooks/`) | 19 |
| Unit test files | 34+ |
| Component test files | 6+ |
| E2E smoke tests | 1 |
| CI/CD workflows | 3 |
| Total tests | 470+ |

### Build Status

- **Build:** Passes with chunk size warning (`react-vendor` ~672 KB)
- **Lint:** Warnings present (mostly unused vars), tracked for cleanup
- **Tests:** Actively maintained with expanding coverage

For architecture details, see [ARCHITECTURE.md](ARCHITECTURE.md).

---

## Phase 1: Stabilization & Code Health

**Priority:** Critical
**Goal:** Green CI, zero lint errors, passing tests.

### 1.1 Fix Failing Tests

- [ ] `src/lib/__tests__/analytics.test.ts` — event tracking/filtering/clearing failures
- [ ] `src/lib/__tests__/interactive-map.test.ts` — time-aware boost and clustering failures

### 1.2 Resolve Lint Errors

- [ ] Fix any lint errors blocking clean CI
- [ ] Triage warnings — fix unused imports/vars or prefix with `_`
- [ ] Target: zero errors, warnings trending down each sprint

### 1.3 Bundle Size Optimization

| Chunk | Current Size | Target |
|-------|-------------|--------|
| `react-vendor` | ~672 KB | < 600 KB |
| `sentry` | ~257 KB | Lazy load |
| `index` | ~202 KB | Audit for code splitting |
| Total precache | ~4 MB | < 3 MB |

- [ ] Evaluate lazy loading Sentry (initialize after first render)
- [ ] Audit index chunk for components that should be route-split
- [ ] Review PWA precache strategy — not all routes need precaching

---

## Phase 2: Test Coverage Expansion

**Priority:** High
**Goal:** Meaningful test coverage for critical user flows.

### 2.1 Component Testing

Priority components needing tests:

- [ ] `OnboardingFlow` — first-run experience
- [ ] `InteractiveMap` — core map interactions
- [ ] `VenuePage` — venue detail rendering and actions
- [ ] `BottomNav` / `MainTabRouter` — navigation
- [ ] `CreatePulseDialog` — content creation flow
- [ ] `GlobalSearch` — search experience
- [ ] `NotificationFeed` — notifications rendering

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

- [ ] Audit modules with no component consumers (candidates: `white-label.ts`, `public-api.ts`, `twitter-ingestion.ts`)
- [ ] Remove unused exports identified by lint warnings
- [ ] Reduce bundle size through tree-shaking improvements

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

| Priority | Phase | Effort | Impact |
|----------|-------|--------|--------|
| 1 | Phase 1: Stabilization | 1–2 days | Unblocks CI, builds confidence |
| 2 | Phase 3.4: Dead Code Audit | 1 day | Reduces bundle, simplifies codebase |
| 3 | Phase 2.1–2.2: Core Test Coverage | 1–2 weeks | Prevents regressions |
| 4 | Phase 3.1–3.3: Architecture | 1–2 weeks | Enables scaling |
| 5 | Phase 4: Backend Integration | 2–4 weeks | Moves beyond prototype to product |
| 6 | Phase 5: Production Readiness | 1–2 weeks | Required for launch |
| 7 | Phase 6: Feature Polish | Ongoing | User experience refinement |
| 8 | Phase 2.3–2.4: E2E & CI | 1 week | Long-term quality |

---

## Related Documentation

- [README.md](README.md) — project overview and setup
- [ARCHITECTURE.md](ARCHITECTURE.md) — system architecture and module boundaries
- [PRODUCTION_ROLLOUT.md](PRODUCTION_ROLLOUT.md) — phased rollout plan
- [RELEASE_CHECKS.md](RELEASE_CHECKS.md) — pre-deployment checks
- [CONTRIBUTING.md](CONTRIBUTING.md) — development workflow and code style
- [SECURITY.md](SECURITY.md) — security policy and priorities
