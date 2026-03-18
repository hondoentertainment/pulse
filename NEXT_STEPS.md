# Recommended Next Steps

Updated: March 18, 2026

This document provides prioritized, actionable next steps for Pulse based on the current state of the codebase. Items are grouped into immediate wins, near-term work, and strategic milestones.

## What's Been Completed Since Last Review

The following items from the previous next-steps list have been fully shipped:

- **Dependency vulnerabilities**: `npm audit` reports 0 vulnerabilities
- **Playwright smoke tests**: Expanded from 4 to 14 test cases covering critical flows
- **Bundle size tracking**: CI job enforces a 500KB gzipped-per-chunk budget
- **My Spots Feed UI**: `MySpotsFeed.tsx` implemented, wired into DiscoverTab and TrendingTab
- **Component decomposition**: InteractiveMap split into 9 sub-modules (map/), GlobalSearch split into 5 (search/), App.tsx reduced from 1,100 to 115 lines, VenuePlatformDashboard decomposed
- **Time-contextual scoring**: `time-contextual-scoring.ts` integrated
- **Voice search guardrails**: Implemented in `use-voice-search.ts`
- **Map progressive disclosure**: Implemented in decomposed map components
- **Backend architecture doc**: Written with API proxy started (`api-proxy.ts`)
- **10 new engagement features**: TonightsPickCard, LiveActivityFeed, GoingTonightButton, EmojiReactions, BoostBadge, EnergyTimeline, VenueComparison, StreakDashboard, NeighborhoodWalkthrough, OfflineIndicator
- **Accessibility**: Comprehensive a11y improvements across all new features
- **Performance**: React.memo, memoization, lazy loading added with perf tests
- **CI pipeline**: Lint, test, build, audit, bundle-size, and e2e smoke as separate jobs

---

## Immediate Wins (This Week)

### 1. Clean Up 175 Lint Warnings

The build passes with 0 errors but carries 175 warnings, almost all `@typescript-eslint/no-unused-vars`. A single sweep to prefix unused imports with `_` or remove dead exports would:

- Make CI output readable (real issues won't be lost in noise)
- Reduce bundle size slightly by removing dead code
- Prevent the warning count from creeping higher

### 2. Fix the 2 Oversized Chunks

The build reports chunks exceeding 600KB pre-minification:

| Chunk | Size (gzip) |
|-------|-------------|
| `react-vendor` | 187KB |
| `index` | 107KB |
| `charts` | 101KB |

Actions:
- Lazy-load the charts library (recharts/visx) so it only loads on dashboard pages
- Split `react-vendor` by separating framer-motion (39KB gzip) into its own chunk via `manualChunks`
- Move Radix UI primitives into a shared UI chunk

Target: no chunk above 150KB gzipped.

### 3. Add Error Boundaries Around New Features

The 10 new engagement features are wired into pages but lack isolated error boundaries. A crash in EmojiReactions or LiveActivityFeed will take down the entire page. Wrap each lazy-loaded feature in a `<Suspense>` + `<ErrorBoundary>` so failures degrade gracefully.

---

## Near-Term Work (Next 2-4 Weeks)

### 4. End-to-End Tests for New Engagement Features

The 14 smoke tests cover navigation and core flows, but none of the 10 new engagement features have Playwright coverage. Add E2E tests for:

- Tonight's Pick card renders on Discover tab
- Going Tonight RSVP button toggles state
- Emoji reactions appear and animate
- Venue comparison mode loads two venues side-by-side
- Streak dashboard shows on profile page
- Offline indicator appears when network is disconnected

### 5. Real-Time Data Layer

All data still lives in client-side Spark KV storage. The backend architecture doc exists but no real backend has been built. The minimum viable backend needs:

- **Auth**: OAuth with at least one provider (Google or Apple)
- **Persistence**: Postgres for users, venues, pulses, reactions
- **Real-time**: WebSocket or SSE for live score updates
- **API**: REST endpoints for the core CRUD operations the client already performs

This is the single biggest blocker to any kind of beta.

### 6. Move Sensitive Operations Server-Side

Before any public deployment, these must move behind server routes:

- Reverse geocoding (currently calls Nominatim from the browser)
- Webhook signing logic (exists as library code in `public-api.ts`)
- Any API key management

The `api-proxy.ts` stub exists — it needs to become a real server endpoint.

### 7. Observability Foundation

Before beta users touch the app:

- **Error tracking**: Sentry or equivalent, wired into React error boundaries
- **Structured logging**: Server-side request logs with correlation IDs
- **Product analytics**: Track activation (first pulse created), retention (weekly active), and engagement (pulses per session)
- **Uptime monitoring**: Health check endpoint with external ping

---

## Strategic Milestones (Next Quarter)

### 8. Performance Audit on Real Devices

The app has grown significantly with 10 new features. Run Lighthouse and real-device profiling (especially mid-range Android) to identify:

- Time to interactive on the map view
- Memory usage with all engagement features loaded
- Animation jank from framer-motion on lower-end GPUs

### 9. Moderation & Abuse Prevention

Before public beta, implement:

- Content reporting workflow for pulses
- Rate limiting on pulse creation (prevent spam)
- Review queue for flagged content
- Automatic detection of suspicious patterns (same user, rapid-fire pulses)

### 10. Feature Flags & Staged Rollout

With 10+ engagement features shipping at once, add a feature flag system so individual features can be:

- Toggled off if they cause issues in production
- A/B tested against control groups
- Gradually rolled out to percentages of users

### 11. User Onboarding for New Features

Users landing in the app now see Tonight's Pick, Live Activity, Emoji Reactions, Going Tonight, Streaks, Neighborhood Walkthrough, and more — all at once. Design a progressive disclosure onboarding that introduces features over the first few sessions rather than overwhelming on day one.

---

## Execution Priority Summary

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| P0 | Clean up 175 lint warnings | 1-2 hours | Medium (code health) |
| P0 | Fix oversized chunks | 1 day | High (load performance) |
| P0 | Error boundaries for new features | Half day | High (resilience) |
| P1 | E2E tests for engagement features | 2-3 days | High (quality gate) |
| P1 | Real-time data layer / backend | 2-3 weeks | Critical (production blocker) |
| P1 | Server-side sensitive operations | 1 week | High (security) |
| P2 | Observability foundation | 1 week | High (operability) |
| P2 | Real-device performance audit | 2-3 days | Medium (UX quality) |
| P3 | Moderation & abuse prevention | 1-2 weeks | High (trust & safety) |
| P3 | Feature flags & staged rollout | 1 week | Medium (operational safety) |
| P3 | User onboarding for new features | 1 week | Medium (activation) |

---

## Relationship to Existing Plans

This document reflects the current state after significant Phase 0 completion:

- **Phase 0 (Stabilize)**: ~90% complete. Remaining: lint warning cleanup, chunk optimization, error boundaries
- **Phase 1 (Production Foundations)**: Backend architecture is documented. Implementation has not started. This is the critical path.
- **Phase 2 (Harden for Beta)**: Observability, moderation, and feature flags are next after the backend exists

The engagement feature sprint (10 features) was not in the original rollout plan but significantly enriches the product surface. The priority now shifts from feature breadth to production depth — backend, auth, observability, and resilience.
