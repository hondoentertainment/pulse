# Recommended Next 10 Features

Generated: March 17, 2026

These recommendations build on the existing NEXT_STEPS.md roadmap and focus on high-impact, user-facing features that leverage code already in the codebase. Each feature is scoped to be implementable with the current client-side architecture while being backend-ready when Phase 1 arrives.

---

## 1. Live Activity Feed with Real-Time Simulation

**What:** A scrolling feed on the Discover tab showing a real-time stream of anonymized activity — "3 people just checked in at Neon Lounge", "The Rooftop is surging right now", "DJ set starting at Club Vinyl in 30 min".

**Why:** The app has `use-simulated-activity.ts` and a notification system, but there's no ambient sense of *liveness*. A live feed creates FOMO and makes the app feel populated even before real users arrive. This is the single best way to demonstrate value on first open.

**Builds on:** `use-simulated-activity.ts`, `notification-grouping.ts`, `venue-trending.ts`

**Effort:** 3-4 days

---

## 2. Venue Comparison Mode

**What:** Let users long-press two venue pins (or select from search) to see a side-by-side comparison card: energy score, wait time estimate, crowd vibe tags, distance, trending direction, and friends present.

**Why:** The #1 decision users make is "which place should I go?" — this directly answers it. The scoring engine, social graph, and venue data are all ready; this is purely a UI feature.

**Builds on:** `pulse-engine.ts`, `venue-recommendations.ts`, `social-graph.ts`, map `MapSmartRoute.tsx` (already has a compare tray concept)

**Effort:** 3-5 days

---

## 3. "Going Tonight" RSVP & Friends Coordination

**What:** A one-tap "I'm going tonight" button on venue pages that broadcasts intent to friends. Friends see a "Sarah + 2 others are heading to The Rooftop" notification and can tap to join. Include a mini-chat or reaction thread per venue per night.

**Why:** Social coordination is the killer feature for nightlife apps. `social-coordination.ts` and `crew-mode.ts` exist but aren't surfaced in a lightweight way. This is simpler than full crew management and solves the "where is everyone going?" problem.

**Builds on:** `social-coordination.ts`, `presence-engine.ts`, `crew-mode.ts`, notification system

**Effort:** 5-7 days

---

## 4. Personalized "Tonight's Pick" Card

**What:** A prominent card at the top of the home screen that recommends one venue for tonight based on the user's history, preferences, current time, day of week, friend activity, and trending data. Includes a one-line explanation ("Your favorite cocktail bar is surging — 4 friends nearby").

**Why:** Reduces decision fatigue to zero. The personalization engine (`personalization-engine.ts`), contextual intelligence (`contextual-intelligence.ts`), and recommendation engine (`venue-recommendations.ts`) are all built — they just need a hero UI surface.

**Builds on:** `personalization-engine.ts`, `contextual-intelligence.ts`, `venue-recommendations.ts`, `time-contextual-scoring.ts`

**Effort:** 2-3 days

---

## 5. Venue Energy History Timeline

**What:** On the venue detail page, add a 24-hour energy timeline chart showing how the venue's pulse score has changed throughout the day. Include a "Best time to visit" marker and a "Compared to last week" overlay.

**Why:** Users want to know *when* a place gets good, not just if it's good right now. This turns Pulse from a snapshot tool into a planning tool. Recharts and D3 are already dependencies; `venue-analytics-pro.ts` has the data model.

**Builds on:** `venue-analytics-pro.ts`, `time-contextual-scoring.ts`, `predictive-surge.ts`, Recharts

**Effort:** 3-4 days

---

## 6. Quick Pulse Reactions (Emoji Burst)

**What:** Replace the current reaction system with a TikTok/Instagram-style emoji burst. When viewing a venue page or pulse, users can rapid-tap emoji reactions (🔥🎶💃🍸⚡) that float up the screen with physics animation. Aggregate counts show on the venue card.

**Why:** Micro-interactions drive engagement loops. The reaction handler (`handleReaction`) exists but the UI is utilitarian. Framer Motion is already in the stack — this is a polish feature that dramatically increases perceived quality and fun.

**Builds on:** `handleReaction` in `use-app-handlers.ts`, Framer Motion, existing reaction types

**Effort:** 2-3 days

---

## 7. Neighborhood Heatmap Walkthrough

**What:** A guided "explore mode" where users can tap a neighborhood on the map and get an auto-generated walking route hitting the top 3-4 venues, with estimated walk times, energy scores, and a "Start Route" button that opens native maps.

**Why:** `neighborhood-scores.ts` calculates area vibrancy and `MapSmartRoute.tsx` already has route rendering logic. Combining them creates a unique feature no competitor has — curated neighborhood bar crawls generated in real-time based on what's hot right now.

**Builds on:** `neighborhood-scores.ts`, `MapSmartRoute.tsx`, `interactive-map.ts` (smart routing), `night-planner.ts`

**Effort:** 4-5 days

---

## 8. Streak-Powered Check-In Rewards

**What:** Surface the existing achievements system with a visible streak counter on the profile tab. "You've checked in 3 Fridays in a row!" with a progress ring toward the next badge. Add a weekly leaderboard among friends.

**Why:** `achievements.ts` has a full badge/streak system that's barely visible in the UI. Streaks are the single most effective retention mechanic in consumer apps. A friend leaderboard adds social pressure without requiring new backend logic.

**Builds on:** `achievements.ts`, `credibility.ts`, `social-graph.ts`, `AchievementsPage.tsx`

**Effort:** 3-4 days

---

## 9. Venue Owner Quick Boost

**What:** A streamlined 3-tap flow for venue owners: "Boost this venue for 2 hours" → select a promotion type (Happy Hour, Live Music, Special Event) → confirm. The venue gets a highlighted pin, a feed card, and push-style notifications to nearby users.

**Why:** `promoted-discoveries.ts`, `venue-platform.ts`, and `CreatorDashboard.tsx` exist but the boost flow requires navigating a complex dashboard. A quick-boost shortcut from the venue page makes the monetization path frictionless — this is how the app makes money.

**Builds on:** `promoted-discoveries.ts`, `venue-platform.ts`, `venue-owner.ts`, `brand-partnerships.ts`

**Effort:** 3-4 days

---

## 10. Offline Mode with Smart Prefetch

**What:** When the user has connectivity, prefetch and cache venue data, scores, and map tiles for their current neighborhood and favorited venues. When offline, show cached data with a "Last updated 5 min ago" badge and queue any check-ins or pulses for sync when back online.

**Why:** `offline-queue.ts` and `use-offline-mode.ts` exist but aren't connected to the venue/map data layer. Nightlife happens in basements, crowded venues, and transit — exactly where connectivity drops. This is table-stakes for a mobile-first app.

**Builds on:** `offline-queue.ts`, `use-offline-mode.ts`, `pwa.ts`, service worker infrastructure

**Effort:** 5-7 days

---

## Priority Matrix

| # | Feature | Effort | User Impact | Revenue Impact | Retention Impact |
|---|---------|--------|-------------|----------------|------------------|
| 1 | Live Activity Feed | 3-4 days | ★★★★★ | — | ★★★☆☆ |
| 2 | Venue Comparison | 3-5 days | ★★★★☆ | — | ★★★☆☆ |
| 3 | "Going Tonight" RSVP | 5-7 days | ★★★★★ | — | ★★★★★ |
| 4 | Tonight's Pick Card | 2-3 days | ★★★★★ | — | ★★★★☆ |
| 5 | Energy History Timeline | 3-4 days | ★★★★☆ | — | ★★★☆☆ |
| 6 | Quick Pulse Reactions | 2-3 days | ★★★☆☆ | — | ★★★★☆ |
| 7 | Neighborhood Walkthrough | 4-5 days | ★★★★☆ | — | ★★★★☆ |
| 8 | Streak Rewards | 3-4 days | ★★★☆☆ | — | ★★★★★ |
| 9 | Venue Owner Quick Boost | 3-4 days | ★★☆☆☆ | ★★★★★ | ★★☆☆☆ |
| 10 | Offline Mode | 5-7 days | ★★★★☆ | — | ★★★☆☆ |

## Suggested Implementation Order

**Sprint 1 (Quick Wins — 1 week):**
- #4 Tonight's Pick Card (2-3 days) — highest impact, lowest effort
- #6 Quick Pulse Reactions (2-3 days) — polish that makes everything feel better

**Sprint 2 (Core Engagement — 1 week):**
- #1 Live Activity Feed (3-4 days) — makes the app feel alive
- #8 Streak Rewards (3-4 days) — retention mechanic

**Sprint 3 (Social & Discovery — 1.5 weeks):**
- #3 "Going Tonight" RSVP (5-7 days) — the social killer feature
- #2 Venue Comparison (3-5 days) — decision-support

**Sprint 4 (Depth & Monetization — 1.5 weeks):**
- #5 Energy History Timeline (3-4 days) — planning power
- #9 Venue Owner Quick Boost (3-4 days) — revenue path

**Sprint 5 (Polish & Resilience — 1.5 weeks):**
- #7 Neighborhood Walkthrough (4-5 days) — unique differentiator
- #10 Offline Mode (5-7 days) — reliability for real-world use

---

## Relationship to Existing Roadmap

These features are designed to run **in parallel** with the NEXT_STEPS.md and PRODUCTION_ROLLOUT.md work:

- **Phase 0 items** (CVE fixes, smoke tests, bundle tracking) should complete first
- **These 10 features** can be built on the client-side during Phase 0-1
- **Phase 1 backend work** will make features 1, 3, and 10 production-ready with real persistence
- **Phase 2 observability** will enable measuring the impact of all 10 features

Each feature is designed to work with mock/simulated data today and transition seamlessly to real backend data when available.
