# Recommended Next Steps

Generated: March 16, 2026

This document provides prioritized, actionable next steps for Pulse based on the current state of the codebase. Items are grouped into immediate wins, near-term work, and strategic milestones.

---

## Immediate Wins (This Week)

These require no architectural changes and directly improve quality.

### 1. Fix Dependency Vulnerabilities

```bash
npm audit fix
```

There are 8+ high/moderate severity CVEs (flatted, minimatch, rollup, lodash, qs). Run `npm audit fix` and pin any packages that cannot be auto-fixed. This is the single lowest-effort, highest-impact security action available.

### 2. Expand Playwright Smoke Tests

The current `e2e/smoke.spec.ts` has only 4 test cases covering map controls and navigation. Add smoke tests for the critical user flows:

- **Venue page open** — tap a venue pin, verify venue detail loads
- **Pulse creation** — open create dialog, fill fields, submit, verify pulse appears
- **Check-in flow** — trigger check-in, confirm success feedback
- **Notifications** — verify notification list renders and items are tappable
- **Search** — open global search, type a query, verify results appear
- **Settings** — open settings page, toggle a preference, confirm persistence

Target: 10-15 total smoke tests covering every primary navigation path.

### 3. Add Bundle Size Tracking

Add `rollup-plugin-visualizer` or `source-map-explorer` to the build and record the output in CI. Set a budget (e.g., 500 KB gzipped for the main chunk) so regressions are caught early. This is called out in Phase 0 of `PRODUCTION_ROLLOUT.md` but not yet started.

---

## Near-Term Work (Next 2-4 Weeks)

### 4. Ship the My Spots Feed UI

The venue-following backend logic is already wired (`handleToggleFollow` in App.tsx, `followedVenues` on the User type). What remains:

- Follow/unfollow button on `VenuePage.tsx`
- "My Spots" tab in the bottom navigation or discovery view
- Filtered feed showing only followed venues
- Badge or indicator showing followed status on map pins

This is the highest-impact engagement feature not yet shipped.

### 5. Decompose Large Components

Several components are well past the point where they should be split:

| Component | Lines | Suggested Splits |
|-----------|-------|------------------|
| `InteractiveMap.tsx` | 1,849 | Extract clustering logic, heatmap overlay, venue sheet, and map controls into separate files |
| `App.tsx` | 1,102 | Extract route definitions, global state providers, and handler functions |
| `VenuePlatformDashboard.tsx` | 894 | Split analytics charts, boost controls, and settings into sub-components |
| `GlobalSearch.tsx` | 853 | Separate search input, filter panel, and results list |

Start with `InteractiveMap.tsx` since it is the largest and most complex.

### 6. Add Time-Contextual Scoring

The scoring engine (`pulse-engine.ts`) does not account for venue category or time of day. A coffee shop at 7 AM and a nightclub at 7 AM should not be scored on the same curve. Add:

- Category-specific peak hour definitions
- Score normalization relative to expected activity
- Labels like "Electric for this time of day"

Utility code already exists at `src/lib/time-contextual-scoring.ts` — it needs integration into the main scoring path and UI surfaces.

### 7. Voice Search Guardrails

The voice search hook (`use-voice-search.ts`) accepts open-ended input. Limit to 3 supported command types (search venue, filter by category, navigate), show inline examples on first use, and add a fallback message when input cannot be parsed.

---

## Strategic Milestones (Next Quarter)

### 8. Design the Backend Architecture

This is the single biggest blocker to production. All data lives in client-side Spark KV storage with no multi-device sync, no real auth, and no server-side validation. Before writing backend code, produce an architecture document covering:

- **Data models**: users, venues, pulses, reactions, stories, events, notifications, crews
- **Auth strategy**: OAuth provider selection, session management, role-based access (user / venue-owner / admin)
- **API surface**: which endpoints are needed, REST vs GraphQL, rate limiting
- **Persistence**: database selection (Postgres is a safe default), migration strategy
- **Real-time**: WebSocket or SSE for live score updates and presence

### 9. Move Secrets Server-Side

These client-exposed operations must move behind server routes before any public beta:

- Reverse geocoding (currently calls OpenStreetMap Nominatim from the browser)
- Webhook signing logic (exists as library code in `public-api.ts`)
- Any future payment or ticketing API keys

### 10. Add Observability

Before beta users touch the app:

- **Error tracking**: Sentry or equivalent, wired into React error boundaries
- **Structured logging**: server-side request logs with correlation IDs
- **Uptime monitoring**: health check endpoint with external ping
- **Product analytics**: track activation (first pulse created), retention (weekly active), and engagement (pulses per session)

### 11. Map Progressive Disclosure

The map currently renders all venues at once, which overwhelms new users. Default to showing the top 5 nearby surging venues, with a "Show full heatmap" button to reveal everything. This reduces cognitive load and improves first-session experience.

---

## Execution Priority Summary

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| P0 | Fix dependency vulnerabilities | 1 hour | High (security) |
| P0 | Expand smoke tests to 10-15 cases | 2-3 days | High (quality gate) |
| P1 | Bundle size tracking | 1 day | Medium (prevents regression) |
| P1 | My Spots Feed UI | 3-5 days | High (engagement) |
| P1 | Decompose InteractiveMap | 2-3 days | Medium (maintainability) |
| P2 | Time-contextual scoring | 3-5 days | Medium (fairness) |
| P2 | Voice search guardrails | 1-2 days | Low-Medium (polish) |
| P3 | Backend architecture design | 1-2 weeks | Critical (production blocker) |
| P3 | Server-side secrets | 1 week | High (security) |
| P3 | Observability | 1 week | High (operability) |
| P3 | Map progressive disclosure | 2-3 days | Medium (UX) |

---

## Relationship to Existing Plans

This document aligns with and refines the phased plan in `PRODUCTION_ROLLOUT.md`:

- **Immediate wins** correspond to remaining Phase 0 work
- **Near-term work** bridges Phase 0 completion and Phase 1 preparation
- **Strategic milestones** map to Phase 1 (backend/auth) and Phase 2 (observability/hardening)

The feature priorities (My Spots, time-contextual scoring, voice guardrails, map disclosure) align with the order recommended in `IMPLEMENTATION_SUMMARY.md`.
