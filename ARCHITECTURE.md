# Pulse Architecture

This document describes the system architecture, data flow, and module boundaries of the Pulse application.

## System Overview

Pulse is a client-heavy PWA built with React 19 and Vite. The current architecture runs almost entirely in the browser, with Supabase as the planned backend. The app is designed to transition from a prototype (mock data, client state) to a production system (server persistence, real auth) without major structural rewrites.

```
┌─────────────────────────────────────────────────┐
│                   Browser (PWA)                  │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │   React   │  │  Hooks   │  │  Domain Logic │  │
│  │Components │──│  Layer   │──│   (src/lib)   │  │
│  │  (125+)   │  │  (19)    │  │    (69)       │  │
│  └──────────┘  └──────────┘  └───────────────┘  │
│        │              │              │            │
│        └──────────────┼──────────────┘            │
│                       │                           │
│              ┌────────┴────────┐                  │
│              │   State Layer   │                  │
│              │  Spark KV / RQ  │                  │
│              └────────┬────────┘                  │
│                       │                           │
│              ┌────────┴────────┐                  │
│              │  Service Worker │                  │
│              │  Offline Queue  │                  │
│              └────────┬────────┘                  │
└───────────────────────┼─────────────────────────┘
                        │
              ┌─────────┴─────────┐
              │     Supabase      │
              │  PostgreSQL/Auth  │
              │  Realtime/Storage │
              └───────────────────┘
```

## Layer Responsibilities

### Components (`src/components/`)

125+ React components organized by feature area:

| Group | Examples | Responsibility |
|-------|---------|----------------|
| **Navigation** | BottomNav, AppHeader, MainTabRouter | App shell, routing, page transitions |
| **Pages** | DiscoverTab, TrendingTab, VenuePage, ProfileTab | Top-level page views |
| **Venue** | VenueCard, VenueCompareSheet, VenueLivePanel | Venue display and interaction |
| **Social** | SocialPulseDashboard, FriendActivityTimeline, CrewPanel | Social feeds and coordination |
| **Content** | CreatePulseDialog, StoryViewer, AudioVibePreview | Content creation and viewing |
| **Search** | GlobalSearch, MapSearch, InteractiveMap | Discovery and exploration |
| **Admin** | VenueOwnerDashboard, ModerationQueuePage, AnalyticsDashboard | Management tools |
| **UI Primitives** | Button, Card, Dialog, Sheet, Tabs, etc. | Shadcn/Radix design system |

### Hooks (`src/hooks/`)

19 custom hooks bridging domain logic and UI:

| Hook | Purpose |
|------|---------|
| `use-app-state` | Main state provider — venues, pulses, users, notifications |
| `use-app-handlers` | Event handlers — pulse submission, reactions, check-ins |
| `use-realtime-location` | GPS tracking with accuracy indicators |
| `use-supabase-auth` | Authentication flow |
| `use-social-pulse` | Social dashboard state and polling |
| `use-offline-mode` | Offline detection and queue management |
| `use-realtime-subscription` | Supabase real-time subscriptions |
| `use-venue-surge-tracker` | Monitor venues for energy surges |
| `use-voice-search` / `use-voice-filter` | Voice input via Web Speech API |
| `use-simulated-activity` | Demo data generation (prototype) |

### Domain Logic (`src/lib/`)

69 pure TypeScript modules. No React dependencies. Fully testable.

**Scoring and Recommendations:**

```
pulse-engine.ts          → Core pulse score calculation (0-100)
venue-trending.ts        → Trending detection, surge alerts
venue-recommendations.ts → Personalized venue suggestions
personalization-engine.ts → User preference learning
time-contextual-scoring.ts → Time-of-day normalization
predictive-surge.ts      → Predict upcoming surges
neighborhood-scores.ts   → Area-level scoring
```

**Social:**

```
social-pulse-engine.ts   → Social media correlation scoring
social-graph.ts          → Friend connections, suggestions
social-coordination.ts   → Group planning, coordination
presence-engine.ts       → "Who's here" with privacy controls
crew-mode.ts             → Group check-ins and activity
retention-engine.ts      → Engagement and retention mechanics
creator-economy.ts       → Creator tools and metrics
```

**Features:**

```
stories.ts               → Story creation and viewing
playlists.ts             → Curated venue playlists
events.ts                → Event listings and management
achievements.ts          → Badges, streaks, challenges
night-planner.ts         → Night planning with friends
ticketing.ts             → Ticket management
table-booking.ts         → Table reservation logic
integrations.ts          → Spotify, Uber, Lyft bridges
```

**Infrastructure:**

```
supabase.ts / supabase-api.ts → Database client and queries
server-api.ts / public-api.ts → API stubs (prototype)
offline-queue.ts              → Offline action queue
rate-limiter.ts               → Client-side rate limiting
analytics.ts                  → Event tracking
content-moderation.ts         → Report and review logic
mock-data.ts                  → Seeded venues/users (prototype)
types.ts                      → Shared TypeScript interfaces
```

## Data Flow

### Pulse Creation Flow

```
User taps "Create Pulse"
    │
    ▼
CreatePulseDialog (component)
    │ validates energy rating, media, caption
    ▼
use-app-handlers.handleSubmitPulse (hook)
    │ creates pulse object with isPending: true
    │ adds to state optimistically
    ▼
pulse-engine.calculatePulseScore (lib)
    │ recalculates venue score with new pulse
    ▼
Impact detection (handler)
    │ checks if score crossed threshold (50→Buzzing, 75→Electric)
    │ generates impact notification if so
    ▼
State update via Spark KV
    │ persists venues, pulses, notifications
    ▼
UI re-renders with updated score + pending indicator
    │ after confirmation, clears isPending flag
```

### Venue Score Calculation

The pulse score algorithm in `pulse-engine.ts` weights:

1. **Recency** — pulses from the last 90 minutes, exponentially weighted toward the most recent
2. **Energy ratings** — Dead (1), Chill (2), Buzzing (3), Electric (4)
3. **Volume** — more pulses increase the score
4. **Velocity** — rapid pulse creation boosts the score
5. **Engagement** — reactions on pulses contribute
6. **Credibility** — trusted users' pulses carry more weight (0.5x–2.0x)

Scores auto-decay as pulses age past 90 minutes.

### State Architecture

```
┌──────────────────────────────────────┐
│           App State (Spark KV)       │
│                                      │
│  venues[]     pulses[]    users[]    │
│  notifications[]  currentUser        │
│  socialPosts[]  trackedHashtags[]    │
└──────────────┬───────────────────────┘
               │
    ┌──────────┼──────────┐
    │          │          │
    ▼          ▼          ▼
use-app-state  TanStack   localStorage
(main state)   Query      (preferences)
               (server)
```

**Current (prototype):** Most state lives in Spark KV hooks, bootstrapped from mock data on first load.

**Target (production):** Server state managed by TanStack Query with Supabase as the source of truth. Spark KV retains offline cache and local preferences only.

## Build and Bundle

Vite bundles the app with manual chunk splitting:

| Chunk | Contents | Size |
|-------|----------|------|
| `react-vendor` | React, React DOM | ~672 KB |
| `framer-motion` | Framer Motion | ~180 KB |
| `charts` | Recharts, D3 | ~150 KB |
| `three` | Three.js | ~140 KB |
| `radix` | Radix UI primitives | ~120 KB |
| `sentry` | Sentry SDK | ~257 KB |
| `index` | App code | ~202 KB |

Total precache is approximately 4 MB. Bundle size optimization is tracked in [NEXT_PHASES.md](NEXT_PHASES.md).

## PWA Architecture

- **Service Worker** (`public/sw.js`) — precaches app shell and assets
- **Offline Queue** (`src/lib/offline-queue.ts`) — queues pulse creation, reactions, and other writes when offline; syncs on reconnection
- **Manifest** (`public/manifest.json`) — installable PWA with app icons and splash screen

## Security Boundaries

See [SECURITY.md](SECURITY.md) for the full policy. Key architectural considerations:

- **Client trust boundary** — the browser is untrusted. Scoring, moderation, and API key logic in `src/lib/` are prototypes that must move server-side before production.
- **Auth** — Supabase Auth is integrated but not yet enforced across all surfaces. Role-based access (user, venue owner, admin) is defined in types but not gated on the server.
- **Secrets** — no API keys or secrets should exist in the client bundle. Integrations that require keys must proxy through server routes.

## Key Design Decisions

1. **Domain logic separated from React** — all scoring, recommendation, and analytics code is in pure `src/lib/` modules with no React imports, making it testable and portable.

2. **Optimistic UI** — pulses appear instantly with a pending indicator, then confirm asynchronously. This makes the app feel responsive even on slow connections.

3. **Privacy-first presence** — the "who's here" feature uses jittered counts, minimum thresholds (2+ familiar faces), and per-venue suppression to prevent tracking.

4. **Score transparency without gamification** — the "Why this score?" panel shows enough to build trust without revealing weights that could be gamed.

5. **Mobile-first PWA** — designed for phones first, installable without app stores, works offline with queued syncing.
