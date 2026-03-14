# Pulse

Pulse is a mobile-first social nightlife discovery app prototype built with React, TypeScript, Vite, and Spark storage hooks. It helps users discover nearby venues, view live energy signals, post short-lived "pulses", and explore maps, events, crews, insights, and social activity.

## Current Status

This repository is an advanced product prototype, not a production deployment yet.

What is working today:
- Multi-tab app shell for map, discovery, trending, notifications, and profile flows
- Venue pages, pulse creation, stories, events, playlists, and crew features
- A richer interactive map with clustering, compare mode, smart preview ranking, fit-to-view, and accessibility controls
- A large unit test suite for core scoring, recommendations, analytics, sharing, moderation, and map helper logic

What is still prototype-grade:
- Venue and user state are seeded from mock data and Spark KV storage
- Simulated location fallback is still present
- Reverse geocoding is called directly from the client
- Auth, backend APIs, durable persistence, and production observability are not fully implemented

## Tech Stack

- React 19
- TypeScript
- Vite 7
- Tailwind CSS 4
- Vitest
- Spark hooks for local app state

## Local Development

Prerequisites:
- Node.js 20+
- npm

Install dependencies:

```bash
npm install
```

Start the app:

```bash
npm run dev
```

Create a production build:

```bash
npm run build
```

Run the test suite:

```bash
npm run test
```

Run browser smoke tests:

```bash
npm run test:smoke
```

Run linting:

```bash
npm run lint
```

Preview the production build locally:

```bash
npm run preview
```

## Scripts

- `npm run dev`: start the Vite dev server
- `npm run build`: type-check build inputs and create a production bundle
- `npm run test`: run the Vitest suite once
- `npm run test:watch`: run tests in watch mode
- `npm run test:smoke`: run Playwright smoke tests against a local preview build
- `npm run lint`: run ESLint
- `npm run audit`: fail on high/critical dependency vulnerabilities
- `npm run release-check`: lint + unit tests + build + audit
- `npm run preview`: serve the built app locally

## Project Structure

- [src/App.tsx](C:/Users/kyle/OneDrive/Desktop/pulse/src/App.tsx): main app shell, state orchestration, tab routing, and seeded app flows
- [src/components](C:/Users/kyle/OneDrive/Desktop/pulse/src/components): UI views and feature components
- [src/lib](C:/Users/kyle/OneDrive/Desktop/pulse/src/lib): domain logic, scoring, analytics, moderation, utilities, and testable helpers
- [src/hooks](C:/Users/kyle/OneDrive/Desktop/pulse/src/hooks): location, notifications, unit preferences, and other client hooks
- [public](C:/Users/kyle/OneDrive/Desktop/pulse/public): PWA assets and service worker

## Notable Product Areas

- Discovery and trending venue exploration
- Live venue energy scoring and score breakdowns
- Pulse creation, reactions, pending states, and sharing
- Interactive map exploration with clustering and route-oriented previews
- Presence, social graph, stories, crews, playlists, and notifications
- Venue-owner, analytics, and developer-platform experiments

## Testing and Quality

Current baseline:
- `npm run build` passes
- `npm run test` passes
- `npm run lint` passes with warnings only

The test suite currently covers a broad set of pure logic modules in [src/lib](C:/Users/kyle/OneDrive/Desktop/pulse/src/lib), including the extracted interactive map helpers in [src/lib/interactive-map.ts](C:/Users/kyle/OneDrive/Desktop/pulse/src/lib/interactive-map.ts).

Remaining quality gaps:
- Smoke-level browser coverage exists, but critical flow depth is still limited
- CI exists with lint, unit tests, build, smoke checks, and dependency audit
- Existing lint warnings remain in some older components and shared UI files

## Production Readiness Gaps

The biggest blockers to shipping this as a production app are:

1. Real backend services
Replace mock and local-first state with durable persistence for users, venues, pulses, notifications, moderation actions, and analytics.

2. Authentication and authorization
Add real account flows, sessions, protected admin surfaces, and role-based permissions for venue-owner and developer features.

3. Server-side API boundaries
Move external API calls, webhook signing, API key issuance, and rate limiting behind server routes instead of handling them only in the client or utility modules.

4. Persistence upgrades
Replace prototype localStorage behavior and Spark-only state with a clear split between server state, offline cache, and local preferences.

5. Release engineering
Add CI, environment management, deployment documentation, and end-to-end regression coverage.

6. Observability and security
Add error tracking, logs, performance monitoring, dependency remediation, and a repository-specific security policy.

## Known Prototype Assumptions

- The app seeds venues from mock and expansion datasets in [src/lib/mock-data.ts](C:/Users/kyle/OneDrive/Desktop/pulse/src/lib/mock-data.ts).
- App state is heavily driven by `useKV` in [src/App.tsx](C:/Users/kyle/OneDrive/Desktop/pulse/src/App.tsx).
- Reverse geocoding currently calls OpenStreetMap Nominatim directly from the client.
- Public API and webhook helpers in [src/lib/public-api.ts](C:/Users/kyle/OneDrive/Desktop/pulse/src/lib/public-api.ts) are library-level prototypes, not deployed production services.

## Suggested Next Milestones

1. Stand up a backend and real data model for venues, pulses, users, and notifications.
2. Add authentication, session handling, and admin authorization.
3. Replace mock bootstrapping with seeded server data and feature flags.
4. Add Playwright smoke tests for onboarding, map, pulse creation, and venue flows.
5. Reduce bundle size and set performance budgets for mobile devices.
6. Add deploy, rollback, monitoring, and incident-response documentation.

## Related Docs

- [PRD.md](C:/Users/kyle/OneDrive/Desktop/pulse/PRD.md): product requirements and scope
- [IMPLEMENTATION_SUMMARY.md](C:/Users/kyle/OneDrive/Desktop/pulse/IMPLEMENTATION_SUMMARY.md): recent feature implementation notes
- [SECURITY.md](C:/Users/kyle/OneDrive/Desktop/pulse/SECURITY.md): repository security policy and disclosure guidance
- [PRODUCTION_ROLLOUT.md](C:/Users/kyle/OneDrive/Desktop/pulse/PRODUCTION_ROLLOUT.md): phased rollout plan from prototype to launch readiness
- [RELEASE_CHECKS.md](C:/Users/kyle/OneDrive/Desktop/pulse/RELEASE_CHECKS.md): minimum automated and manual checks to run before deployment
