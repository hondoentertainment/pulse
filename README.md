# Pulse

**Real-time venue energy discovery for nightlife.**

Pulse is a mobile-first PWA that shows users where the energy is happening right now. Check into venues, post short-lived "pulses" with energy ratings, and discover what's buzzing nearby through live scores, interactive maps, social feeds, and crew coordination.

## How It Works

1. **Open the app** — see nearby venues ranked by live energy scores
2. **Check in** — post a pulse with an energy rating (Chill → Buzzing → Electric)
3. **Score updates** — your pulse raises the venue's live score, triggering friend and surge notifications
4. **Friends discover** — the cycle repeats, amplifying where the energy is right now

Pulses decay after 90 minutes, so scores always reflect what's happening now — not last night.

## Current Status

Pulse is an **advanced product prototype**. The feature surface is broad and functional, but production infrastructure (backend persistence, auth, observability) is not yet complete.

**Working today:**

- Multi-tab app shell — map, discover, trending, notifications, profile
- Venue pages with live energy scores, score breakdowns, pulse feeds, and stories
- Pulse creation with energy ratings, media, pending states, and sharing
- Interactive map with clustering, compare mode, route-aware previews, accessibility controls
- Social features — crews, presence, stories, playlists, friend activity, venue following
- Venue owner dashboards, analytics, social pulse correlation, and moderation tools
- 470+ unit tests across scoring, recommendations, analytics, sharing, moderation, map helpers, and UI components
- CI pipeline with lint, test, build, smoke checks, and dependency audit
- PWA support with offline queue and service worker

**Still prototype-grade:**

- Venue and user data seeded from mock datasets and Spark KV storage
- Simulated location fallback still present
- Reverse geocoding called directly from the client
- Auth, backend APIs, durable persistence, and production observability not fully implemented

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
docs/                       # Operational runbooks
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

```bash
# Run all tests
npm run test

# Run with coverage
npx vitest run --coverage

# Run specific test file
npx vitest run src/lib/__tests__/pulse-engine.test.ts
```

## CI/CD

Three GitHub Actions workflows:

| Workflow | Trigger | Steps |
|----------|---------|-------|
| **ci.yml** | Push/PR | Lint, unit tests, build |
| **deploy.yml** | Push to main | Production deployment |
| **lighthouse.yml** | Scheduled | Performance, accessibility, best practices audits |

## Production Readiness

See [PRODUCTION_ROLLOUT.md](PRODUCTION_ROLLOUT.md) for the full phased plan. Key gaps:

1. **Backend** — replace mock data with Supabase-backed persistence
2. **Auth** — real account flows, sessions, role-based permissions
3. **Server boundaries** — move geocoding, API keys, webhooks behind server routes
4. **Persistence** — clear split between server state, offline cache, local preferences
5. **Observability** — error tracking, structured logging, uptime monitoring
6. **Release engineering** — environment management, rollback procedures

## Documentation

| Document | Description |
|----------|-------------|
| [PRD.md](PRD.md) | Product requirements, feature specs, design direction, edge cases |
| [PRODUCTION_ROLLOUT.md](PRODUCTION_ROLLOUT.md) | Phased rollout from prototype to launch |
| [NEXT_PHASES.md](NEXT_PHASES.md) | Codebase review and phase-by-phase work plan |
| [RELEASE_CHECKS.md](RELEASE_CHECKS.md) | Pre-deployment automated and manual checks |
| [SECURITY.md](SECURITY.md) | Security policy and vulnerability reporting |
| [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) | Core loop, score transparency, impact notifications |
| [SOCIAL_PULSE_IMPLEMENTATION.md](SOCIAL_PULSE_IMPLEMENTATION.md) | Social pulse correlation system details |
| [docs/SUPPORT_RUNBOOK.md](docs/SUPPORT_RUNBOOK.md) | Operational procedures, rollback, moderation |
| [CONTRIBUTING.md](CONTRIBUTING.md) | How to contribute, code style, PR process |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System architecture, data flow, module boundaries |

## License

Private repository. All rights reserved.
