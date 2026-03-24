# Pulse — Codebase Review & Next Phases of Work

## Current State Assessment

### Project Overview
Pulse is a nightlife/venue discovery PWA built with React 18 + TypeScript + Vite. It features an interactive map, real-time venue pulse scores, social features, crew coordination, stories, integrations (Spotify, Uber, Lyft), and a comprehensive venue analytics platform.

### Scale
- **60,243** lines of TypeScript/TSX source code
- **68** library modules (`src/lib/`)
- **125** components (`src/components/`) + UI primitives (`src/components/ui/`)
- **19** custom hooks (`src/hooks/`)
- **34** unit test files, **1** E2E smoke test
- **3** CI/CD workflows (CI, Deploy, Lighthouse)

### Build Status
- **Build**: Passes with chunk size warning (react-vendor 672 KB)
- **Lint**: 1 error, 107 warnings (mostly unused vars)
- **Tests**: 2 failing test files (5 failures / 472 total tests)
  - `analytics.test.ts` — 3 failures (event tracking/filtering/clearing)
  - `interactive-map.test.ts` — 2 failures (time-aware boost, clustering)

---

## Phase 1: Stabilization & Code Health (Priority: Critical)

**Goal**: Green CI, zero lint errors, passing tests.

### 1.1 Fix Failing Tests
- [ ] `src/lib/__tests__/analytics.test.ts` — 3 failing tests (trackEvent/getEvents)
- [ ] `src/lib/__tests__/interactive-map.test.ts` — 2 failing tests (time-aware category boost, clustering)

### 1.2 Resolve Lint Errors
- [ ] Fix the 1 lint error blocking clean CI
- [ ] Triage the 107 warnings — fix unused imports/vars or prefix with `_`

### 1.3 Bundle Size Optimization
- [ ] `react-vendor` chunk is 672 KB (exceeds 600 KB warning)
- [ ] `sentry` chunk is 257 KB — evaluate lazy loading Sentry
- [ ] `index` chunk is 202 KB — audit for code that should be lazy-loaded
- [ ] Total precache is ~4 MB — review PWA caching strategy

---

## Phase 2: Test Coverage Expansion (Priority: High)

**Goal**: Meaningful test coverage for critical user flows.

### 2.1 Component Testing (Current: ~1% coverage)
Priority components needing tests:
- [ ] `OnboardingFlow` — first-run experience
- [ ] `InteractiveMap` — core map interactions
- [ ] `VenuePage` — venue detail rendering and actions
- [ ] `BottomNav` / `MainTabRouter` — navigation
- [ ] `CreatePulseDialog` — content creation flow
- [ ] `GlobalSearch` — search experience
- [ ] `NotificationFeed` — notifications rendering

### 2.2 Integration Testing
- [ ] Supabase auth flow (`use-supabase-auth.tsx`)
- [ ] Offline queue sync behavior (`offline-queue.ts`)
- [ ] Real-time subscription handling (`use-realtime-subscription.ts`)

### 2.3 E2E Test Expansion
- [ ] Venue search and selection flow
- [ ] Pulse creation flow
- [ ] Social interactions (favorites, follows, crew)
- [ ] Offline/online transition behavior
- [ ] Integration flows (Spotify, ride-share)

### 2.4 CI Enhancements
- [ ] Add code coverage reporting and thresholds
- [ ] Add `npm audit` to CI pipeline
- [ ] Add Prettier formatting enforcement

---

## Phase 3: Architecture & Performance (Priority: High)

**Goal**: Reduce complexity, improve performance, prepare for scale.

### 3.1 State Management Refactor
- [ ] `use-app-state.tsx` is a monolithic state provider — evaluate splitting into domain-specific contexts (venue state, social state, UI state)
- [ ] `App.tsx` passes many props through — consider colocating state closer to consumers
- [ ] Evaluate React Query / TanStack Query for server state (partially set up via `query-client.ts` but underutilized)

### 3.2 Code Splitting & Lazy Loading
- [ ] Many large components loaded eagerly — audit import graph
- [ ] Route-based splitting for sub-pages (settings, achievements, events, playlists, etc.)
- [ ] Lazy load heavy integrations (Spotify, maps, analytics dashboards)

### 3.3 Mock Data Decoupling
- [ ] `mock-data.ts`, `global-venues.ts`, `us-venues.ts` contain hardcoded venue data
- [ ] Transition to API-driven data; mock data should only exist in test fixtures
- [ ] `use-simulated-activity.ts` — replace simulation hooks with real data sources

### 3.4 Dead Code Audit
- [ ] 107 lint warnings suggest significant unused code
- [ ] Several lib modules appear to have no component consumers (e.g., `white-label.ts`, `public-api.ts`, `twitter-ingestion.ts`)
- [ ] Audit and remove unused modules to reduce bundle size

---

## Phase 4: Backend & Data Layer (Priority: Medium-High)

**Goal**: Move from client-side mock data to real backend services.

### 4.1 Supabase Integration Completion
- [ ] `supabase.ts` and `supabase-api.ts` exist but usage appears limited
- [ ] Implement real authentication flow (currently mock user `nightowl`)
- [ ] Set up database tables for venues, pulses, users, social graph
- [ ] Real-time subscriptions for live venue activity

### 4.2 API Layer
- [ ] `server-api.ts` and `public-api.ts` exist as stubs — implement real endpoints
- [ ] Define API contracts for venue CRUD, pulse creation, social actions
- [ ] Rate limiting (`rate-limiter.ts`) needs server-side enforcement

### 4.3 Data Persistence
- [ ] Offline queue (`offline-queue.ts`) needs real sync target
- [ ] User preferences should persist to backend, not just local state
- [ ] Implement proper caching strategy with cache invalidation

---

## Phase 5: Production Readiness (Priority: Medium)

**Goal**: Security, monitoring, and operational readiness.

### 5.1 Security
- [ ] Content moderation (`content-moderation.ts`) — needs real moderation service
- [ ] Payment processing (`payment-processing.ts`) — needs PCI-compliant integration
- [ ] Input sanitization audit across all user-input surfaces
- [ ] Auth token handling and session management

### 5.2 Monitoring & Observability
- [ ] Sentry is integrated but verify error boundary coverage
- [ ] Analytics (`analytics.ts`) — currently broken (tests failing)
- [ ] Add structured logging for debugging
- [ ] Performance monitoring (Web Vitals already tracked via Lighthouse CI)

### 5.3 Accessibility
- [ ] `AccessibilityProvider.tsx` and `accessibility.ts` exist but coverage is unknown
- [ ] Lighthouse accessibility score target is only 0.85 — raise to 0.95+
- [ ] Keyboard navigation audit for all interactive elements
- [ ] Screen reader testing for critical flows

### 5.4 Internationalization
- [ ] `i18n.ts` exists — audit for completeness
- [ ] Ensure all user-facing strings are externalized
- [ ] RTL layout support if targeting international markets

---

## Phase 6: Feature Polish & UX (Priority: Medium)

**Goal**: Refine existing features before adding new ones.

### 6.1 Map Experience
- [ ] Fix clustering algorithm (test currently failing)
- [ ] Time-aware category boosting (test currently failing)
- [ ] Performance with 240+ venues at high zoom levels

### 6.2 Social Features
- [ ] Crew mode (`crew-mode.ts`) — verify end-to-end flow works
- [ ] Social graph (`social-graph.ts`) — friend suggestions, activity feed
- [ ] Stories (`stories.ts`) — creation and viewing flow
- [ ] Presence system (`presence-engine.ts`) — real-time "who's here"

### 6.3 Creator & Venue Owner Tools
- [ ] `creator-economy.ts`, `venue-owner.ts`, `venue-platform.ts` — large modules that need real backend
- [ ] `VenueOwnerDashboard.tsx`, `CreatorDashboard.tsx` — verify these render correctly
- [ ] Analytics dashboards need real data sources

---

## Recommended Execution Order

| Priority | Phase | Effort | Impact |
|----------|-------|--------|--------|
| 1 | Phase 1: Stabilization | 1-2 days | Unblocks CI, builds confidence |
| 2 | Phase 3.4: Dead Code Audit | 1 day | Reduces bundle, simplifies codebase |
| 3 | Phase 2.1-2.2: Core Test Coverage | 1-2 weeks | Prevents regressions |
| 4 | Phase 3.1-3.3: Architecture | 1-2 weeks | Enables scaling |
| 5 | Phase 4: Backend Integration | 2-4 weeks | Moves beyond demo to product |
| 6 | Phase 5: Production Readiness | 1-2 weeks | Required for launch |
| 7 | Phase 6: Feature Polish | Ongoing | User experience refinement |
| 8 | Phase 2.3-2.4: E2E & CI | 1 week | Long-term quality |

---

*Generated: 2026-03-24*
