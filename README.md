# Pulse

**Pulse Signal — a daily check-in that reveals your best patterns.**

Pulse ships two products from one codebase, selected at build time by
[`VITE_APP_MODE`](docs/feature-flags.md):

| Mode | Value | What it is |
|------|-------|------------|
| **Signal** *(default)* | `signal` | A daily well-being check-in: rate energy, mood, stress, and sleep, tag the day, and watch trends, streaks, and patterns emerge over time. |
| **Venue** | `venue` | The original real-time venue-energy discovery app for nightlife (below). Used for E2E/staging of the full venue surface. |

The production app is **Pulse Signal**. The venue product remains in the tree
behind the flag; its documentation continues below.

## Pulse Signal — how it works

1. **Check in** — a 10-second slider pass on energy, mood, stress, and sleep quality, plus a couple of tags
2. **Get your signal** — a single 0–100 score, a plain-language insight, and one recovery/next-step recommendation
3. **Build the streak** — check in once a day; the streak and 7-day average keep the loop honest
4. **See your patterns** — the app correlates your tags with your score ("what lifts you / what drains you"), tracks personal records, and recaps each week

Signal state lives locally (zustand + persisted storage) and syncs to Supabase
when configured, so the app is fully usable offline and without a backend.

### Signal feature surface

- Onboarding (tracking focus + goal) → daily check-in → first-win moment
- Trends: 7-day chart, average, direction, streak
- **Weekly summary** — average, best day, top lift tag, and movement vs. last week
- **Pattern discovery** — per-tag correlation with signal score, plus lifetime personal records
- **CSV export** — download your full check-in history
- History log, reminder preference, research/pilot CTAs

## Venue product (mode: `venue`)

**Real-time venue energy discovery for nightlife.**

A mobile-first PWA that shows where the energy is happening right now. Check into
venues, post short-lived "pulses" with energy ratings, and discover what's
buzzing nearby through live scores, interactive maps, social feeds, and crew
coordination. Pulses decay after 90 minutes, so scores reflect what's happening
now — not last night.

**Venue surface:**

- Multi-tab app shell — map, discover, trending, notifications, profile
- Venue pages with live energy scores, score breakdowns, pulse feeds, and stories
- Pulse creation with energy ratings, media, pending states, and sharing
- Interactive map with clustering, compare mode, route-aware previews, accessibility controls
- Social features — crews, presence, stories, playlists, friend activity, venue following
- Venue owner dashboards, analytics, social pulse correlation, and moderation tools

## Current status

The combined codebase carries **1,100+ unit tests** (scoring, recommendations,
analytics, sharing, moderation, map helpers, Signal patterns/summary/export, and
UI components), a CI pipeline (lint, test, build, per-mode Playwright smoke,
dependency audit), and PWA support with an offline queue and service worker.

Still prototype-grade on the venue side: mock-seeded venue/user data, simulated
location fallback, and client-side reverse geocoding.

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Framework** | React 19, TypeScript, Vite 7 |
| **Styling** | Tailwind CSS 4, CSS variables, dark theme |
| **UI Components** | Shadcn/Radix UI primitives, Lucide icons, Phosphor icons |
| **State** | Spark KV hooks, TanStack React Query v5, custom hooks |
| **Forms** | React Hook Form, Zod validation |
| **Maps** | Supercluster (clustering), interactive canvas with heatmaps |
| **Animations** | Framer Motion, Embla Carousel, React Parallax Tilt |
| **Charts** | Recharts, D3, Three.js |
| **Backend** | Supabase (PostgreSQL, Auth, Realtime, Storage) |
| **Testing** | Vitest (unit), Playwright (E2E smoke) |
| **Quality** | ESLint, TypeScript strict mode |
| **PWA** | Vite PWA plugin, service worker, offline queue |
| **Monitoring** | Vercel Analytics, Sentry error tracking, Lighthouse CI |
| **Integrations** | Spotify, Uber, Lyft, X/Twitter social pulse (library-level prototypes) |

## Local Development

**Prerequisites:** Node.js 20+, npm

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Production build
npm run build

# Run unit tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run Playwright smoke tests
npm run test:smoke

# Lint
npm run lint

# Full release check (lint + test + build + audit)
npm run release-check

# Preview production build
npm run preview
```

## Project Structure

```
src/
├── App.tsx                 # App shell, state orchestration, tab routing
├── main.tsx                # React 19 entry point
├── components/             # 125 UI views and feature components
│   ├── ui/                 # Shadcn/Radix UI primitives
│   └── __tests__/          # Component test suites
├── lib/                    # 69 domain logic modules
│   ├── __tests__/          # 34 unit test files
│   ├── types.ts            # Shared TypeScript interfaces
│   ├── mock-data.ts        # Seeded venue and user data (prototype)
│   ├── pulse-engine.ts     # Core pulse scoring algorithm
│   ├── venue-trending.ts   # Trending and surge detection
│   ├── social-pulse-engine.ts  # Social correlation scoring
│   └── ...                 # Recommendations, analytics, moderation, etc.
├── hooks/                  # 19 custom React hooks
│   ├── use-app-state.tsx   # Main app state provider
│   ├── use-app-handlers.ts # Event handlers
│   ├── use-realtime-location.ts
│   ├── use-supabase-auth.tsx
│   └── ...                 # Social pulse, offline, voice, haptics, etc.
└── styles/                 # Global styles

public/                     # PWA manifest, service worker, privacy policy
e2e/                        # Playwright smoke tests
api/                        # API utilities
supabase/                   # Supabase configuration
.github/workflows/          # CI (ci.yml), Deploy (deploy.yml), Lighthouse (lighthouse.yml)
docs/                       # Documentation hub (see docs/README.md)
```

## Features

### Core Experience

- **Venue Discovery** — browse trending venues by map or list, with "Trending Now", "Just Popped Off", and "Gaining Energy" categories
- **Live Energy Scores** — real-time 0–100 score per venue based on pulse volume, ratings, engagement, and velocity; auto-decays after 90 minutes
- **Score Transparency** — expandable "Why this score?" panel showing pulse count, average energy, recent change, and last pulse time
- **Pulse Creation** — quick posts with energy rating (Dead/Chill/Buzzing/Electric), optional photos/video, contextual hashtags, haptic feedback
- **Interactive Map** — clustering, energy heatmap, compare mode, voice search, route-aware previews, accessibility controls

### Social

- **Friend Activity** — follow friends and venues, see recent pulses, add emoji reactions
- **Crews** — group check-ins, coordination, meet-up suggestions
- **Stories** — venue and user stories with reactions
- **Presence** — privacy-first "who's here" with jittered counts and familiar-face detection
- **Impact Notifications** — "Your pulse pushed [Venue] into Electric" when your contribution crosses a threshold

### Venue Owner & Admin

- **Venue Owner Dashboard** — analytics, guest list, engagement metrics
- **Social Pulse Dashboard** — X/Twitter hashtag correlation with venue energy
- **Moderation Queue** — content reports and takedown tools
- **Analytics** — creator economy metrics, brand partnership tools

### Platform

- **Events & Tickets** — event listings, ticket management
- **Playlists** — curated venue playlists
- **Night Planner** — plan nights with friends, suggest meet-up venues
- **Achievements** — badges, streaks, milestones, venue challenges
- **Settings** — imperial/metric toggle, notification preferences, accessibility options

## Testing

The test suite covers:

- **Library logic** (34 test files) — scoring, recommendations, trending, analytics, sharing, moderation, social pulse, interactive map helpers
- **UI components** (component test files) — UI primitives, cards, navigation, venue features, presentational components, feeds/lists
- **E2E smoke** (Playwright) — app load, basic navigation

See [docs/testing.md](docs/testing.md) for the full testing guide.

```bash
# Run all tests
npm run test

# Run with coverage
npx vitest run --coverage

# Run specific test file
npx vitest run src/lib/__tests__/pulse-engine.test.ts
```

## CI/CD

Three GitHub Actions workflows plus Lighthouse on PRs. Full reference: [docs/github-workflows.md](docs/github-workflows.md).

| Workflow | Trigger | Steps |
|----------|---------|-------|
| **ci.yml** | Push/PR | Lint, unit tests, build, per-mode Playwright smoke, bundle-size, dependency audit |
| **deploy.yml** | Manual (`workflow_dispatch`, target `preview`/`production`) | Quality gate → Vercel deploy |
| **lighthouse.yml** | Pull requests | Performance, accessibility, best-practices audits |

## Production Readiness

See [PRODUCTION_ROLLOUT.md](PRODUCTION_ROLLOUT.md) for the full phased plan. Key gaps:

1. **Backend** — replace mock data with Supabase-backed persistence
2. **Auth** — real account flows, sessions, role-based permissions
3. **Server boundaries** — move geocoding, API keys, webhooks behind server routes
4. **Persistence** — clear split between server state, offline cache, local preferences
5. **Observability** — error tracking, structured logging, uptime monitoring
6. **Release engineering** — environment management, rollback procedures

## Documentation

Full documentation index: **[docs/README.md](docs/README.md)**

### Start here

| Document | Description |
|----------|-------------|
| [docs/getting-started.md](docs/getting-started.md) | Install, env setup, Supabase local, scripts |
| [docs/component-catalog.md](docs/component-catalog.md) | React components by domain and routing |
| [docs/hooks-catalog.md](docs/hooks-catalog.md) | Custom hooks reference |
| [docs/lib-modules.md](docs/lib-modules.md) | Domain logic modules |
| [docs/database-schema.md](docs/database-schema.md) | Supabase tables, relationships, RLS |
| [docs/deployment.md](docs/deployment.md) | Vercel deploy, env vars, rollback |
| [docs/testing.md](docs/testing.md) | Unit, E2E, and coverage |
| [CONTRIBUTING.md](CONTRIBUTING.md) | How to contribute, code style, PR process |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System architecture, data flow, module boundaries |
| [docs/data-layer.md](docs/data-layer.md) | Mock fixtures vs Supabase backend |
| [docs/api-reference.md](docs/api-reference.md) | Server routes under `/api/*` |
| [docs/feature-flags.md](docs/feature-flags.md) | Feature toggles and env vars |
| [docs/environment-variables.md](docs/environment-variables.md) | Master env var reference |
| [docs/glossary.md](docs/glossary.md) | Term definitions |

### Product & release

| Document | Description |
|----------|-------------|
| [PRD.md](PRD.md) | Product requirements, feature specs, design direction |
| [PRODUCTION_ROLLOUT.md](PRODUCTION_ROLLOUT.md) | Phased rollout from prototype to launch |
| [NEXT_PHASES.md](NEXT_PHASES.md) | Codebase review and phase-by-phase work plan |
| [RELEASE_CHECKS.md](RELEASE_CHECKS.md) | Pre-deployment automated and manual checks |
| [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) | Core loop, score transparency, impact notifications |
| [SOCIAL_PULSE_IMPLEMENTATION.md](SOCIAL_PULSE_IMPLEMENTATION.md) | Social pulse correlation system details |

### Operations

| Document | Description |
|----------|-------------|
| [docs/SUPPORT_RUNBOOK.md](docs/SUPPORT_RUNBOOK.md) | Operational procedures, rollback, moderation |
| [docs/secrets-and-integrations.md](docs/secrets-and-integrations.md) | Third-party keys and rotation |
| [docs/backend-migration.md](docs/backend-migration.md) | Supabase migrations and rollout |
| [SECURITY.md](SECURITY.md) | Security policy and vulnerability reporting |

## License

Private repository. All rights reserved.
