# Pulse Documentation

Central index for all Pulse project documentation. Start with [Getting Started](getting-started.md) if you are new to the repo.

## Quick Links

| I want to… | Start here |
|------------|------------|
| Run the app locally | [Getting Started](getting-started.md) |
| Understand the architecture | [ARCHITECTURE.md](../ARCHITECTURE.md) |
| Find a React component | [Component Catalog](component-catalog.md) |
| Understand the database | [Database Schema](database-schema.md) |
| Deploy to Vercel | [Deployment Guide](deployment.md) |
| Contribute code | [CONTRIBUTING.md](../CONTRIBUTING.md) |
| Ship a release | [RELEASE_CHECKS.md](../RELEASE_CHECKS.md) |
| Configure env vars & secrets | [Secrets & Integrations](secrets-and-integrations.md) |
| Call server APIs | [API Reference](api-reference.md) |
| Toggle features | [Feature Flags](feature-flags.md) |
| Look up a term | [Glossary](glossary.md) |
| Run or write tests | [Testing Guide](testing.md) |
| Switch mock → Supabase data | [Data Layer](data-layer.md) + [Backend Migration](backend-migration.md) |

---

## Developer Guides

| Document | Description |
|----------|-------------|
| [Getting Started](getting-started.md) | Prerequisites, install, env setup, Supabase local, scripts |
| [Component Catalog](component-catalog.md) | React components by domain, routing, feature packages |
| [Hooks Catalog](hooks-catalog.md) | Custom React hooks and context providers |
| [Lib Modules](lib-modules.md) | Domain logic modules in `src/lib/` |
| [Routing & Navigation](routing.md) | URL routes, tabs, deep links, auth gates |
| [Scoring Algorithm](scoring-algorithm.md) | Pulse score calculation and trending |
| [Database Schema](database-schema.md) | Supabase tables, relationships, RLS, realtime |
| [Data Layer](data-layer.md) | Mock fixtures vs Supabase backend, toggle behavior |
| [API Reference](api-reference.md) | Vercel serverless routes under `/api/*` |
| [Feature Flags](feature-flags.md) | All `VITE_*` flags and defaults |
| [Environment Variables](environment-variables.md) | Master env var reference (client + server) |
| [Testing Guide](testing.md) | Vitest, Playwright, coverage, CI integration |
| [PWA & Offline](pwa-offline.md) | Service worker, install prompt, offline queue |
| [Deployment Guide](deployment.md) | Vercel setup, env vars, CI/CD, rollback |
| [GitHub Workflows](github-workflows.md) | CI, deploy, Lighthouse, native sync pipelines |
| [Secrets & Integrations](secrets-and-integrations.md) | Third-party keys, rotation, server vs client scope |
| [Backend Migration](backend-migration.md) | Supabase migrations, seeding, RLS, rollout |
| [Bundle Budget](bundle-budget.md) | Chunk size limits and CI enforcement |
| [Bundle Optimization](bundle-optimization.md) | Strategies for reducing client bundle weight |
| [CI Gates](ci-gates.md) | Required checks and quality thresholds |
| [Observability](observability.md) | Logging, analytics adapters, Sentry |
| [Glossary](glossary.md) | Product and technical term definitions |

---

## Product & Design

| Document | Description |
|----------|-------------|
| [PRD.md](../PRD.md) | Product requirements, core loop, feature specs |
| [IMPLEMENTATION_SUMMARY.md](../IMPLEMENTATION_SUMMARY.md) | Core loop, score transparency, impact notifications |
| [SOCIAL_PULSE_IMPLEMENTATION.md](../SOCIAL_PULSE_IMPLEMENTATION.md) | Social pulse correlation system |
| [Differentiators](differentiators.md) | Weather boost, wait time, accessibility filter pack |
| [PRODUCTION_ROLLOUT.md](../PRODUCTION_ROLLOUT.md) | Phased rollout from prototype to launch |
| [NEXT_PHASES.md](../NEXT_PHASES.md) | Codebase review and phase-by-phase work plan |
| [RECOMMENDED_NEXT_STEPS.md](../RECOMMENDED_NEXT_STEPS.md) | Prioritized follow-up work |
| [VENTURE_NEXT_STEPS.md](VENTURE_NEXT_STEPS.md) | Venture-scale roadmap notes |

### Feature PRDs (`docs/prd/`)

| Document | Status |
|----------|--------|
| [AI Concierge](prd/ai-concierge.md) | Draft, behind `VITE_AI_CONCIERGE_ENABLED` |
| [Creator Economy](prd/creator-economy.md) | Behind `VITE_CREATOR_ECONOMY_ENABLED` |
| [Native Apps](prd/native-apps.md) | Capacitor iOS/Android |
| [Reservations & Ticketing](prd/reservations-ticketing.md) | Behind `VITE_TICKETING_ENABLED` |
| [Safety Kit](prd/safety-kit.md) | Behind `VITE_SAFETY_KIT_ENABLED` |
| [Video Feed](prd/video-feed.md) | Behind `VITE_VIDEO_FEED_ENABLED` |

---

## Feature Deep Dives

| Document | Topic |
|----------|-------|
| [AI Concierge](ai-concierge.md) | Claude-powered night planning assistant |
| [Creator Economy](creator-economy.md) | Referrals, payouts, creator dashboard |
| [Creator Fraud Playbook](creator-fraud-playbook.md) | Abuse detection and response |
| [Safety Kit](safety-kit.md) | Trusted contacts, safety sessions, Twilio SMS |
| [Video Feed](video-feed.md) | Vertical video pulses, upload, moderation |
| [Staff Scanner](staff-scanner.md) | Venue door staff ticket scanning |
| [Payments](payments.md) | Stripe ticketing integration |
| [Content Safety](content-safety.md) | Moderation pipeline and policies |
| [MapLibre Migration](maplibre-migration.md) | Map provider migration notes |
| [Storage Costs](storage-costs.md) | Media and Supabase storage estimates |
| [Production Data Path](PRODUCTION_DATA_PATH.md) | End-to-end data flow for production |

---

## Native Apps

| Document | Description |
|----------|-------------|
| [Native Setup](native/setup.md) | Capacitor iOS/Android project setup |
| [Live Activities](native/live-activities.md) | iOS widgets and Live Activities |
| [Release Checklist](native/release-checklist.md) | Pre-store submission checks |

---

## Operations & Reliability

| Document | Description |
|----------|-------------|
| [Support Runbook](SUPPORT_RUNBOOK.md) | Customer support procedures |
| [Incident Response](incident-response.md) | Severity levels and escalation |
| [On-Call](on-call.md) | Rotation and paging |
| [SLOs](slos.md) | Service level objectives |
| [Chaos Drills](chaos-drills.md) | Resilience testing exercises |
| [Backup & Restore](backup-and-restore.md) | Database backup procedures |
| [Accessibility Audit](accessibility-audit.md) | WCAG findings and remediation |

### Runbooks (`docs/runbooks/`)

| Runbook | Scenario |
|---------|----------|
| [Auth Outage](runbooks/auth-outage.md) | Supabase Auth unavailable |
| [Bad Deploy](runbooks/bad-deploy.md) | Roll back a broken release |
| [Content Moderation Bypass](runbooks/content-moderation-bypass.md) | Moderation pipeline failure |
| [Data Loss](runbooks/data-loss.md) | Data corruption or accidental deletion |
| [Supabase Outage](runbooks/supabase-outage.md) | Database or Realtime down |
| [Surge Traffic](runbooks/surge-traffic.md) | Traffic spike handling |

---

## Security & Compliance

| Document | Description |
|----------|-------------|
| [SECURITY.md](../SECURITY.md) | Vulnerability reporting and security policy |

---

## Repository Layout

```
pulse/
├── src/                  # React app — components, hooks, lib
├── api/                  # Vercel serverless routes (/api/*)
├── supabase/             # Migrations, seed, config
├── e2e/                  # Playwright smoke tests
├── docs/                 # This documentation tree
├── ios/ android/         # Capacitor native shells (when generated)
├── public/               # PWA manifest, service worker, static assets
└── .github/workflows/    # CI, deploy, Lighthouse
```
