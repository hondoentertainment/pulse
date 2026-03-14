# Production Rollout Plan

This document turns the current prototype gaps into a practical rollout plan for getting Pulse to a launch-ready state.

## Current Execution Status

As of March 14, 2026, work has started on Phase 0.

Current priorities:
- Tighten release gates so lint, test, and build are visible as separate CI checks
- Document a repeatable pre-deploy release check flow
- Add browser smoke coverage next

Near-term execution order:
1. Phase 0: release gates and release documentation
2. Phase 0: browser smoke tests for critical flows
3. Phase 1: backend and auth foundation
4. Phase 1: move trusted integrations behind server routes
5. Phase 2: observability, moderation, and staging hardening

## Current Starting Point

The app already has a strong feature surface and a healthy unit-test baseline, but several core production needs are still missing:

- Venue data is seeded from mock datasets and client state bootstrapping
- User and app state are heavily managed in client-side Spark KV hooks
- Reverse geocoding is called directly from the browser
- Public API and webhook support exist as library logic rather than deployed services
- End-to-end coverage, CI policy, auth, and observability are still incomplete

## Phase 0: Stabilize The Prototype

Goal:
Make the existing app consistent, testable, and easier to evolve without changing the product scope yet.

Work items:
- Remove remaining low-value lint warnings and dead code
- Add Playwright smoke coverage for onboarding, map, pulse creation, venue page, and notifications
- Set up CI to block merges on `npm run lint`, `npm run test`, and `npm run build`
- Document local setup, release checks, and repository conventions
- Add bundle-size tracking and performance budgets

Current progress:
- In progress: CI release gates are being tightened and documented
- Next up: browser smoke coverage for critical user flows

Exit criteria:
- CI is required for merges
- Core user flows have browser smoke coverage
- Build, test, and lint baselines are stable and documented

## Phase 1: Build Production Foundations

Goal:
Replace prototype-only infrastructure with real backend and account boundaries.

Work items:
- Introduce real authentication, sessions, and role-based authorization
- Replace mock venue, user, pulse, and notification state with durable server-side persistence
- Move geocoding, API key issuance, webhook signing, and rate limiting behind server routes
- Define environment configuration for dev, staging, and production
- Separate server state, offline cache, and local preferences intentionally

Exit criteria:
- No required core flow depends on seeded mock data
- Privileged actions are authorized on the server
- Sensitive logic and secrets are no longer trusted to the client

## Phase 2: Harden For Beta

Goal:
Prepare for a limited real-user beta with monitoring, supportability, and safer rollout controls.

Work items:
- Add error monitoring, structured logging, and uptime checks
- Add product analytics for activation, retention, pulse creation, and venue engagement
- Add moderation workflows for reports, abuse, and content review
- Create a staging deployment with seeded but realistic test data
- Add feature flags for risky or incomplete surfaces
- Run device and browser QA on real mobile hardware

Exit criteria:
- Incidents can be detected, triaged, and reproduced
- Beta users can be supported without direct database access
- Risky features can be disabled without redeploying the entire app

## Phase 3: Launch Readiness

Goal:
Reach a public-launch bar with clear operating procedures and policy coverage.

Work items:
- Finalize privacy policy, terms, and data-retention behavior
- Create launch runbooks, rollback steps, and on-call expectations
- Triage dependency vulnerabilities and finalize release candidate checks
- Validate scaling assumptions for read-heavy venue discovery and write-heavy pulse flows
- Review security posture of auth, webhook, media, and public API surfaces
- Define support ownership for product, engineering, and moderation events

Exit criteria:
- Launch checklist is complete and signed off
- Recovery and rollback steps are tested
- Security, privacy, and support documentation are in place

## Priority Workstreams

### 1. Backend And Data

Target outcomes:
- Durable models for users, venues, pulses, reactions, stories, events, and notifications
- Server-owned derived data such as venue scores and analytics summaries
- Migrations and seed data that are repeatable across environments

### 2. Auth And Permissions

Target outcomes:
- User login and session lifecycle
- Protected admin and venue-owner experiences
- Clear permission checks for internal and public API surfaces

### 3. Client Hardening

Target outcomes:
- Faster startup on mobile devices
- Better offline behavior and queue recovery
- Reduced bundle size and safer third-party dependency usage

### 4. Reliability And Ops

Target outcomes:
- Actionable alerts
- Structured logs and traces
- Release checklists and rollback paths

### 5. Quality Assurance

Target outcomes:
- Unit, integration, and end-to-end coverage for the critical path
- Staging verification before release
- Regression checks for the map, score updates, and pulse submission flows

## Recommended Order Of Execution

1. CI plus browser smoke tests
2. Real backend and auth
3. Server-side API boundaries and persistence cleanup
4. Monitoring, moderation, and staging
5. Launch policy and operational readiness

## Started In Repository

The following work has now been started directly in this repository:

- Phase 0 release-gate documentation
- CI refinement for separate lint, test, and build checks

The next implementation slice should be browser smoke coverage, followed immediately by backend and auth design.

## References In This Repository

- [README.md](C:/Users/kyle/OneDrive/Desktop/pulse/README.md): project overview and current limitations
- [PRD.md](C:/Users/kyle/OneDrive/Desktop/pulse/PRD.md): product scope and feature definitions
- [src/App.tsx](C:/Users/kyle/OneDrive/Desktop/pulse/src/App.tsx): current app orchestration and seeded state usage
- [src/lib/mock-data.ts](C:/Users/kyle/OneDrive/Desktop/pulse/src/lib/mock-data.ts): prototype venue seed data
- [src/lib/public-api.ts](C:/Users/kyle/OneDrive/Desktop/pulse/src/lib/public-api.ts): public API and webhook prototype logic
- [src/lib/offline-queue.ts](C:/Users/kyle/OneDrive/Desktop/pulse/src/lib/offline-queue.ts): current offline queue persistence behavior
