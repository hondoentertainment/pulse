# Production Rollout Plan

This document turns the current prototype gaps into a practical rollout plan for getting Pulse to a launch-ready state.

## Rollout Phases at a Glance

| Phase | Goal | Status |
|-------|------|--------|
| **Phase 0** | Stabilize the prototype | In progress |
| **Phase 1** | Build production foundations | Not started |
| **Phase 2** | Harden for beta | Not started |
| **Phase 3** | Launch readiness | Not started |

## Current Starting Point

The app has a strong feature surface and a healthy test baseline, but several core production needs are still missing:

- Venue data is seeded from mock datasets and client state bootstrapping
- User and app state are managed in client-side Spark KV hooks
- Reverse geocoding is called directly from the browser
- Public API and webhook support exist as library logic rather than deployed services
- End-to-end coverage, CI policy, auth, and observability are still incomplete

## Phase 0: Stabilize The Prototype

**Goal:** Make the existing app consistent, testable, and easier to evolve without changing the product scope.

### Work Items

- [ ] Remove remaining low-value lint warnings and dead code
- [ ] Add Playwright smoke coverage for onboarding, map, pulse creation, venue page, and notifications
- [ ] Set up CI to block merges on `npm run lint`, `npm run test`, and `npm run build`
- [ ] Document local setup, release checks, and repository conventions
- [ ] Add bundle-size tracking and performance budgets
- [ ] Fix remaining test failures (analytics, interactive map)

### Current Progress

- CI release gates are being tightened and documented
- Release check documentation completed ([RELEASE_CHECKS.md](RELEASE_CHECKS.md))
- Contributing guide added ([CONTRIBUTING.md](CONTRIBUTING.md))
- Architecture documentation added ([ARCHITECTURE.md](ARCHITECTURE.md))
- Unit test coverage expanded (470+ tests across library and components)

### Exit Criteria

- CI is required for merges and all checks pass green
- Core user flows have browser smoke coverage
- Build, test, and lint baselines are stable and documented
- Bundle size is tracked with regression alerts

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

1. Fix remaining test failures and lint errors (Phase 0 completion)
2. Browser smoke tests for critical flows
3. Database schema design and Supabase table setup
4. Real auth integration and RLS policies
5. Server-side API boundaries and persistence migration
6. Monitoring, moderation, and staging environment
7. Launch policy and operational readiness

## References

- [README.md](README.md) — project overview and current status
- [PRD.md](PRD.md) — product scope and feature definitions
- [ARCHITECTURE.md](ARCHITECTURE.md) — system architecture and data flow
- [NEXT_PHASES.md](NEXT_PHASES.md) — detailed codebase review and phase work plan
- [RELEASE_CHECKS.md](RELEASE_CHECKS.md) — pre-deployment checks
- [SECURITY.md](SECURITY.md) — security policy and priorities
- [docs/SUPPORT_RUNBOOK.md](docs/SUPPORT_RUNBOOK.md) — operational procedures
