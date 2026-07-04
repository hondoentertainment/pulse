# Lib Modules

Reference for domain logic in `src/lib/`. All modules here are **pure TypeScript** — no React imports. Fully unit-testable.

Tests live in `src/lib/__tests__/`.

---

## Scoring & recommendations

| Module | Exports | Purpose |
|--------|---------|---------|
| `pulse-engine.ts` | `calculatePulseScore`, `getEnergyLabel`, `isWithinRadius` | Core 0–100 venue energy algorithm |
| `venue-trending.ts` | `calculateScoreVelocity`, surge detection | Trending Now / Just Popped / Gaining Energy |
| `venue-recommendations.ts` | Personalized venue suggestions | User preference + proximity ranking |
| `personalization-engine.ts` | Preference learning | Category/time affinity |
| `time-contextual-scoring.ts` | Time-of-day normalization | Friday night vs Tuesday afternoon |
| `predictive-surge.ts` | Upcoming surge prediction | Pre-trending labels |
| `neighborhood-scores.ts` | Area-level aggregation | Neighborhood heat |
| `weather-boost.ts` | Weather-aware ranking | Rain/clear adjustments |
| `wait-time-estimator.ts` | Wait time heuristics | Client-side estimate display |
| `credibility.ts` | Trust weight calculation | 0.5x–2.0x pulse influence |
| `right-now-decisions.ts` | "Go now" heuristics | Urgency scoring |

See [Scoring Algorithm](scoring-algorithm.md) for algorithm detail.

## Social

| Module | Purpose |
|--------|---------|
| `social-pulse-engine.ts` | X/Twitter hashtag correlation with venue energy |
| `social-graph.ts` | Friend connections, suggestions |
| `social-coordination.ts` | Group planning, meet-ups |
| `presence-engine.ts` | Privacy-safe "who's here" |
| `crew-mode.ts` | Group check-ins and crew activity |
| `retention-engine.ts` | Streaks, engagement mechanics |
| `notification-grouping.ts` | Group reactions on same pulse |

## Content & media

| Module | Purpose |
|--------|---------|
| `stories.ts` | Story creation and viewing |
| `video-compression.ts` | Client-side video compression |
| `video-client.ts` | Video upload/publish API client |
| `video-offline-queue.ts` | Offline video pulse queue |
| `video-feature-flag.ts` | Video feed flag resolution |
| `seeded-hashtags.ts` | Contextual hashtag suggestions |
| `demo-hashtags.ts` | Demo hashtag data |
| `content-moderation.ts` | Report and review logic |
| `moderation-client.ts` | Server moderation API client |
| `sanitize.ts` | Input sanitization |

## Features

| Module | Purpose |
|--------|---------|
| `events.ts` | Event listings and management |
| `playlists.ts` | Curated venue playlists |
| `achievements.ts` | Badges, streaks, challenges |
| `night-planner.ts` | Night planning with friends |
| `ticketing.ts` | Ticket domain logic |
| `ticketing-client.ts` | Ticketing API client |
| `table-booking.ts` | Table reservation logic |
| `reservations-client.ts` | Reservations API client |
| `integrations.ts` | Spotify, Uber, Lyft bridges (legacy client) |
| `concierge-client.ts` | AI Concierge API client |
| `safety-client.ts` | Safety Kit API client |
| `staff-scanner-client.ts` | Door scan API client |
| `creators-client.ts` | Creator economy API client |
| `venue-admin-client.ts` | Venue metadata admin client |

## Venue & platform

| Module | Purpose |
|--------|---------|
| `venue-owner.ts` | Owner permissions and analytics |
| `venue-analytics-pro.ts` | Advanced venue analytics |
| `venue-platform.ts` | Platform-level venue tools |
| `venue-operator-live.ts` | Live operator dashboard data |
| `venue-freshness.ts` | Stale venue detection |
| `venue-challenges.ts` | Venue challenge mechanics |
| `venue-storytelling.ts` | Narrative content generation |
| `venue-action-ctas.ts` | Contextual venue CTAs |
| `venue-surge-watch.ts` | Surge watch subscriptions |
| `venue-integration-seeds.ts` | Integration seed data |
| `promoted-discoveries.ts` | Promoted venue slots |
| `brand-partnerships.ts` | Brand partnership tools |
| `live-intelligence.ts` | Live report aggregation client |

## Data & persistence

| Module | Purpose |
|--------|---------|
| `data/` | Backend adapters (venues, pulses, events, etc.) |
| `mock-data.ts` | Seeded prototype fixtures |
| `prototype-catalog.ts` | Prototype catalog loader |
| `supabase.ts` | Supabase JS client |
| `supabase-api.ts` | Typed Supabase queries |
| `api-client.ts` | `/api/*` Edge Function client |
| `server-api.ts` | Legacy server API stubs |
| `public-api.ts` | Legacy public API (migrate to api-client) |
| `query-client.ts` | TanStack Query client config |
| `offline-queue.ts` | Offline pulse write queue |
| `realtime-batcher.ts` | Batch realtime updates |
| `auth-profile.ts` | Profile fetch/create helpers |

## Infrastructure

| Module | Purpose |
|--------|---------|
| `types.ts` | Shared TypeScript interfaces |
| `feature-flags.ts` | Feature flag resolution |
| `utils.ts` | General utilities (`cn`, etc.) |
| `rate-limiter.ts` | Client-side rate limiting |
| `analytics.ts` | Event tracking facade |
| `observability/` | Logger, analytics adapters |
| `sentry-bridge.ts` / `sentry-lazy.ts` | Sentry integration |
| `pwa.ts` | Service worker, install prompt |
| `haptics.ts` / `sound-design.ts` | Tactile/audio feedback |
| `accessibility.ts` | A11y helpers |
| `i18n.ts` | Internationalization stubs |
| `units.ts` | Imperial/metric conversion |
| `sharing.ts` | Share sheet helpers |
| `qr.ts` | QR code generation |
| `deep-links` | (in hooks) URL scheme parsing |
| `cdn-optimizer.ts` | CDN URL optimization |
| `performance-engine.ts` | Performance metrics |
| `interactive-map.ts` | Map clustering, heatmap helpers |

## Markets & geo

| Module | Purpose |
|--------|---------|
| `us-venues.ts` | US venue seed data |
| `us-markets.ts` | City/market definitions |
| `global-venues.ts` | Global venue catalog |

## Signal product (alternate shell)

| Module | Purpose |
|--------|---------|
| `signal-data.ts` | Signal app data layer |
| `signal-insights.ts` | Daily check-in insights |

## Platform & native

| Module | Purpose |
|--------|---------|
| `platform/` | Capacitor platform detection |
| `native-bridge.ts` | Native ↔ web bridge |
| `payment-processing.ts` | Payment flow helpers |
| `stripe-client.ts` / `stripe-loader.ts` | Stripe.js loading |
| `white-label.ts` | White-label configuration |

## Config flags

| Module | Purpose |
|--------|---------|
| `data/config.ts` | `USE_SUPABASE_BACKEND` resolution |

---

## Module conventions

- **Named exports** preferred over default exports
- **No React** — import hooks from `@/hooks/`, not the reverse
- **Types** in `types.ts` for shared shapes; feature-specific types can live in the module
- **Tests** required for scoring, recommendations, and auth-sensitive logic

## Adding a new module

1. Create `src/lib/my-feature.ts`
2. Add types to `types.ts` if shared
3. Create `src/lib/__tests__/my-feature.test.ts`
4. Wire via hook in `src/hooks/` and component in `src/components/`

## Related docs

- [Scoring Algorithm](scoring-algorithm.md)
- [Data Layer](data-layer.md)
- [API Reference](api-reference.md)
- [ARCHITECTURE.md](../ARCHITECTURE.md)
