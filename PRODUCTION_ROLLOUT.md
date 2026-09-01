# Production Rollout Plan

This document turns remaining production gaps into a practical rollout plan. **Pulse Signal is the default / shipping product** (`VITE_APP_MODE=signal`). Venue discovery is parked behind `VITE_APP_MODE=venue` — do not treat venue map, onboarding, or pulse-creation work as the live product.

> Last verified 2026-09-01. Checklists below match `npm test` / `npm run lint` / `npm run build` / `npm run test:smoke:signal` on current `main`, not older review notes.

## Rollout Phases at a Glance

| Phase | Goal | Status |
|-------|------|--------|
| **Phase 0** | Stabilize the prototype | **Gates green** — lint warnings + human ops remain |
| **Phase 1** | Build production foundations | In progress (Signal schema/auth in code; prod migrate is #64) |
| **Phase 2** | Harden for beta | Not started |
| **Phase 3** | Launch readiness | Not started |

## Current Starting Point

Signal is the live loop (check-in → score → streak → trends). Remaining production work is mostly **human ops**, not missing unit tests:

- Production Supabase migrations + env (#64) — out of scope for agents
- GitHub branch protection / required checks (#65)
- Real-device Web Push proof (#66)
- Venue mock data and Spark KV still exist for the **flag-gated** venue shell only

## Phase 0: Stabilize The Prototype

**Goal:** Keep the shipping Signal app consistent, testable, and easy to evolve. Venue smoke stays advisory.

### Work Items

- [x] Fix the previously cited test failures (`analytics.test.ts`, `interactive-map.test.ts`) — both already green; do not reopen
- [x] Zero lint **errors** (`npm run lint`; ~194 warnings remain — do not raise `--max-warnings`)
- [x] CI jobs exist for `lint`, `test`, `build`, `smoke-preview-signal` (+ `smoke-preview` alias)
- [x] Document local setup, release checks, and conventions ([RELEASE_CHECKS.md](RELEASE_CHECKS.md), [CONTRIBUTING.md](CONTRIBUTING.md))
- [x] Signal Playwright smoke (`e2e/smoke.spec.ts` / `npm run test:smoke:signal`) — onboarding, Today, Trends, History, check-in
- [x] Bundle-size script + CI `bundle-size` job; Signal first-paint: Sentry on its own async chunk, Phosphor out of `react-vendor`, Spark `proxy.js` serve-only, venue shell lazy
- [ ] Remaining lint warnings / unused exports (trend down; not a merge blocker)
- [ ] Make `lint` / `test` / `build` / `smoke-preview` **required** on `main` — human GitHub admin (#65)
- [ ] Venue Playwright (map, pulse creation, venue page) — **parked**; do not expand unless a Signal smoke is missing

### Current Progress

- Unit tests: 1216 passing (2026-09-01)
- Release check documentation completed ([RELEASE_CHECKS.md](RELEASE_CHECKS.md))
- Contributing guide added ([CONTRIBUTING.md](CONTRIBUTING.md))
- Architecture documentation added ([ARCHITECTURE.md](ARCHITECTURE.md))
- CI includes Signal smoke as the required-check alias; venue smoke is `continue-on-error`

### Exit Criteria

- [x] Build, test, and lint-error baselines are stable and documented
- [x] Signal critical path has browser smoke coverage
- [ ] CI is required for merges on GitHub (workflow exists; branch protection is #65)
- [x] Bundle size is tracked (`npm run bundle-size` after `build`)

## Phase 1: Build Production Foundations

**Goal:** Replace prototype-only infrastructure with real backend and account boundaries.

### Work Items

- [ ] Introduce real authentication, sessions, and role-based authorization via Supabase Auth
- [ ] Replace mock venue, user, pulse, and notification state with durable Supabase tables
- [ ] Design and implement database schema (venues, pulses, users, reactions, stories, notifications)
- [ ] Move geocoding, API key issuance, webhook signing, and rate limiting behind Supabase Edge Functions
- [ ] Define environment configuration for dev, staging, and production
- [ ] Separate server state (TanStack Query + Supabase), offline cache, and local preferences
- [ ] Implement Row Level Security (RLS) policies in Supabase for all tables

### Exit Criteria

- No required core flow depends on seeded mock data
- Privileged actions are authorized on the server
- Sensitive logic and secrets are no longer trusted to the client
- Database migrations are repeatable across environments

## Phase 2: Harden For Beta

**Goal:** Prepare for a limited real-user beta with monitoring, supportability, and safer rollout controls.

### Work Items

- [ ] Add error monitoring with proper Sentry error boundaries on all routes
- [ ] Add structured logging for backend functions
- [ ] Add product analytics for activation, retention, pulse creation, and venue engagement
- [ ] Add moderation workflows for reports, abuse, and content review (server-enforced)
- [ ] Create a staging deployment with seeded but realistic test data
- [ ] Add feature flags for risky or incomplete surfaces
- [ ] Run device and browser QA on real mobile hardware (iOS Safari, Android Chrome)
- [ ] Load test read-heavy discovery and write-heavy pulse flows
- [ ] Set up uptime monitoring and alerting

### Exit Criteria

- Incidents can be detected, triaged, and reproduced
- Beta users can be supported without direct database access
- Risky features can be disabled without redeploying the entire app
- App performs acceptably on mid-range mobile devices

## Phase 3: Launch Readiness

**Goal:** Reach a public-launch bar with clear operating procedures and policy coverage.

### Work Items

- [ ] Finalize privacy policy, terms of service, and data-retention behavior
- [ ] Create launch runbooks, rollback steps, and on-call expectations
- [ ] Triage dependency vulnerabilities and finalize release candidate checks
- [ ] Validate scaling assumptions for read-heavy venue discovery and write-heavy pulse flows
- [ ] Review security posture of auth, webhook, media, and public API surfaces
- [ ] Define support ownership for product, engineering, and moderation events
- [ ] Implement GDPR/CCPA data export and deletion flows
- [ ] Final accessibility audit (target Lighthouse score 0.95+)
- [ ] Performance budget enforcement (target LCP < 2.5s on 4G)

### Exit Criteria

- Launch checklist is complete and signed off
- Recovery and rollback steps are tested
- Security, privacy, and support documentation are in place
- Performance meets mobile targets

## Priority Workstreams

### 1. Backend and Data

**Target outcomes:**
- Durable models for users, venues, pulses, reactions, stories, events, and notifications
- Server-owned derived data such as venue scores and analytics summaries
- Migrations and seed data that are repeatable across environments
- PostgREST pagination for large payloads (>5 MB venue lists)

### 2. Auth and Permissions

**Target outcomes:**
- User login and session lifecycle via Supabase Auth
- Protected admin and venue-owner experiences
- Clear permission checks for internal and public API surfaces
- Session refresh and expiry handling

### 3. Client Hardening

**Target outcomes:**
- Faster startup on mobile devices (code splitting, lazy loading)
- Better offline behavior and queue recovery
- Reduced bundle size (target: <3 MB total precache)
- Safer third-party dependency usage

### 4. Reliability and Ops

**Target outcomes:**
- Actionable Sentry alerts with proper error boundaries
- Structured logs and traces for backend functions
- Release checklists and rollback paths
- On-call runbook (see [docs/SUPPORT_RUNBOOK.md](docs/SUPPORT_RUNBOOK.md))

### 5. Quality Assurance

**Target outcomes:**
- Unit, component, and end-to-end coverage for the critical path
- Staging verification before every release
- Regression checks for map, score updates, and pulse submission flows
- Visual regression testing for key UI states

## Recommended Order Of Execution

1. ~~Fix remaining test failures and lint errors~~ — tests green, lint **errors** at zero (warnings remain)
2. ~~Browser smoke for Signal critical flows~~ — `test:smoke:signal` exists; do not expand venue E2E
3. **Human ops:** apply production Signal migrations + env (#64), prove live loop
4. **Human ops:** branch protection / required checks (#65), real-device Web Push (#66)
5. Further Signal-only bundle / dead-export cleanup (keep venue code flag-gated)
6. Monitoring, moderation, and staging environment
7. Launch policy and operational readiness

Do **not** schedule venue-default flip, Apple Health, AI concierge, ticketing, or Stripe/Pro pricing as the next slice.

## References

- [README.md](README.md) — project overview and current status
- [PRD.md](PRD.md) — product scope and feature definitions
- [ARCHITECTURE.md](ARCHITECTURE.md) — system architecture and data flow
- [NEXT_PHASES.md](NEXT_PHASES.md) — detailed codebase review and phase work plan
- [RELEASE_CHECKS.md](RELEASE_CHECKS.md) — pre-deployment checks
- [SECURITY.md](SECURITY.md) — security policy and priorities
- [docs/SUPPORT_RUNBOOK.md](docs/SUPPORT_RUNBOOK.md) — operational procedures
