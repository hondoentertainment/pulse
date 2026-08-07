# Pulse — Product Requirements Document

**Status:** Living document · **Last revised:** 2026-08-07
**Owner:** Hondo Entertainment
**Related:** [ARCHITECTURE.md](ARCHITECTURE.md) · [SECURITY.md](SECURITY.md) · [RELEASE_CHECKS.md](RELEASE_CHECKS.md) · [NEXT_PHASES.md](NEXT_PHASES.md) · [docs/](docs/)

---

## 0. Read this first — Pulse is two products

The single most important fact about this repository, and the one most often
missed: **it contains two distinct products behind one codebase**, selected at
build time by `VITE_APP_MODE`.

| | **Pulse Signal** | **Pulse Venue** |
|---|---|---|
| Mode | `VITE_APP_MODE=signal` (**default**) | `VITE_APP_MODE=venue` |
| Status | **Shipping product** | Staging / E2E surface |
| Mounted by | `App.tsx` → `SignalApp` | `App.tsx` → `AppRoutes` (via `isVenueAppMode()`) |
| What it is | Private daily self-tracking (energy, mood, stress, sleep) | Real-time nightlife venue energy network |
| Audience | Individual, single-player | Social, multi-player, location-based |
| Entry | `LoginScreen` → `SignalApp` | `OnboardingFlow` → `AppRoutes` |

Everything that reaches real users today is **Signal**. Venue is a large,
substantially-built product that is **not currently the shipped experience** —
it is exercised by CI smoke tests and kept warm for a future entry switch.

> **Requirement:** any change described in this PRD MUST state which product it
> targets. Historically this document described only Venue, which caused the
> shipped product to go effectively unspecified. That is corrected here.

---

## 1. Vision & positioning

**Pulse helps people read signal instead of noise — first in themselves, then in the world around them.**

- **Signal (shipped)** answers *"how am I actually doing, and what's driving it?"*
  A 30-second daily check-in that turns subjective states into a trend line
  honest enough to act on.
- **Venue (staged)** answers *"where is it actually good right now?"* — replacing
  stale star ratings and paid placement with live, decaying, crowd-sourced energy.

The through-line is the same primitive: **a score that decays**, so it reflects
*now* rather than accumulated history.

---

## 2. Problem & opportunity

### 2.1 Signal
- Wellness apps optimize for streaks and volume of data, not insight.
- Users abandon trackers when logging costs more than the insight returns.
- Most tools show *what* you logged, never *what it means* or *what to do next*.

**Opportunity:** ruthless brevity (one screen, ≤30s) plus an immediate,
plain-language read on trend and recommendation.

### 2.2 Venue
- Review platforms are historical and gameable; they tell you a place was good
  last year, not that it's dead tonight.
- Social feeds are unstructured and unlocatable.

**Opportunity:** a decaying, credibility-weighted, location-verified score that
is only ever about *right now*.

---

## 3. Users

| Persona | Product | Need | Success looks like |
|---|---|---|---|
| **The self-optimizer** | Signal | Understand energy/mood patterns without a research project | Logs most days; can name a driver of a bad week |
| **The burnout-avoider** | Signal | Early warning before a crash | Notices a downward trend and acts on it |
| **The night-planner** | Venue | Pick the right venue *tonight* | Chooses a venue and the vibe matches |
| **The scene regular** | Venue | Signal status; be first to a surge | Posts pulses, builds credibility |
| **The venue operator** | Venue | Visibility and live intel | Accurate live data, inbound traffic |

---

# PART A — Pulse Signal (shipped product)

## 4. Signal: core loop

```
Open app → one check-in (4 sliders + tags) → score + insight
        → trend line updates → streak increments → reminder tomorrow
```

Design constraint: **the entire loop must complete in under 30 seconds.**
Onboarding explicitly promises "Under 30s".

## 5. Signal: functional requirements

### 5.1 Onboarding (`SignalOnboarding.tsx`) — 3 steps
1. **Tracking focus** — exactly one of `energy | mood | focus | sleep`
   ("Pick your daily signal.")
2. **Goal** — one of `more_energy | less_stress | better_sleep | deeper_focus`
3. **Reminder** — optional `reminderTime`

Persisted as `SignalProfile { trackingFocus, goal, reminderTime? }`.

| Req | Requirement |
|---|---|
| S-ON-1 | Progress indicator shows step N of 3 and the "Under 30s" promise |
| S-ON-2 | Exactly one focus and one goal selectable; Continue disabled until chosen |
| S-ON-3 | Reminder is skippable — never a hard gate |
| S-ON-4 | Completing onboarding routes to `/home` and never re-prompts |

### 5.2 Daily check-in (`SignalCheckIn.tsx`, `/home`)
Four 1–10 metrics plus free tags:

| Field | Range | Default |
|---|---|---|
| `energy` | 1–10 | 7 |
| `mood` | 1–10 | 7 |
| `stress` | 1–10 (higher = worse) | 4 |
| `sleepQuality` | 1–10 | 7 |
| `tags` | string[] | `['calm']` |

| Req | Requirement |
|---|---|
| S-CI-1 | All values clamped to integer 1–10 (`clampScore`) |
| S-CI-2 | Draft is live-scored *before* save (`computeDraftScore`) so the user sees the consequence of each adjustment |
| S-CI-3 | One entry per calendar day; re-opening an already-logged day loads that entry (`getTodayEntry`) rather than creating a duplicate |
| S-CI-4 | Save is optimistic — local state first, remote write async; never block the UI on network |
| S-CI-5 | First-ever save triggers `FirstWinDialog` |

### 5.3 Score model (`signal-score.ts`)
- `computeDraftScore(draft) → number` — composite of the four metrics, with
  `stress` inverted (high stress lowers the score).
- `scoreBucket(score) → ScoreBucket`, with `scoreBucketLabel()` and
  `scoreBucketColor()` for consistent presentation.

| Req | Requirement |
|---|---|
| S-SC-1 | Score is deterministic and pure — same inputs, same output, no time/random dependence |
| S-SC-2 | Bucket label/color are the single source of truth for score presentation everywhere |

### 5.4 Insights (`signal-insights.ts`)
| Function | Output |
|---|---|
| `getStreakCount` | Consecutive-day streak |
| `getSevenDayAverage` | Rolling 7-day mean |
| `getTrendDirection` | `up \| down \| flat` |
| `generateInsight` | Plain-language read on recent entries |
| `getRecommendation` | Next action, informed by the user's `goal` |
| `calculateSignalMetrics` | Bundle: `{ sevenDayAverage, trendDirection, streakCount, recommendation }` |
| `buildChartSeries` | Chart points, each flagged `seeded` |

| Req | Requirement |
|---|---|
| S-IN-1 | All insight functions are pure and take an injectable `now` for testability |
| S-IN-2 | Seeded/demo chart points MUST be visually distinguishable from real entries (`seeded` flag) — never present synthetic data as the user's own |
| S-IN-3 | Copy is plain-language and non-clinical; Pulse makes **no medical claims** |

### 5.5 Screens
| Route | Screen | Contents |
|---|---|---|
| `/home` | Daily check-in | Sliders, tags, live score, save, streak |
| `/trends` | Trend chart | `SignalChart`, 7-day average, direction, insight |
| `/history` | History | Reverse-chronological entries |
| `/settings` | Settings | Reminder toggle/time, profile, honest reminder copy |

`/` and unknown paths redirect to `/home`.

### 5.6 State & persistence
- **Client:** `useSignalStore` (Zustand + `persist`) — offline-first, survives reload.
- **Remote:** `signal_entries`, `signal_profiles` (Supabase), written via
  `saveSignalEntry` / `saveSignalProfile`; `fetchSignalEntries` hydrates.
- **Merge:** `mergeRemoteEntries` reconciles remote into local.

| Req | Requirement |
|---|---|
| S-ST-1 | App is fully usable offline; remote writes are best-effort |
| S-ST-2 | Merge must not duplicate same-day entries or clobber a newer local entry |
| S-ST-3 | No Supabase credentials → app still works against local state |

### 5.7 Signal edge cases
- **No entries yet** — empty states invite the first check-in; trends degrade gracefully.
- **Already logged today** — surface today's entry; editing updates, never appends.
- **Gap in logging** — streak resets without shaming; averages ignore missing days.
- **Reminder unsupported/denied** — feature hides or degrades; never blocks the app.
- **Clock/timezone change** — day bucketing uses `toISOString().slice(0,10)`; must not double-count.
- **Sync failure** — entry stays local and retries; user is never shown data loss.

---

# PART B — Pulse Venue (staged product)

## 6. Venue: core loop

```
Detect location → verify at venue → post pulse (photo/video + energy)
              → score updates live → nearby users see surge → they go
```

Every pulse **decays over 90 minutes**, so the score always describes *now*.

## 7. Venue: functional requirements

### 7.1 Feature inventory

| Feature | Requirement summary |
|---|---|
| Onboarding & splash | First-launch welcome, location permission, persisted completion |
| Location check-in | GPS + Haversine distance verification against venue coords |
| Create pulse | Photos, video (≤30s, ≤10MB, client-compressed), energy rating, caption, hashtags |
| Real-time pulse score | Weighted, credibility-adjusted, 90-minute decay |
| Score transparency | "Why this score?" expandable breakdown |
| Venue discovery | Canvas map + list, heatmap, clustering, category icons, filters |
| Social layer | Friend following, emoji reactions (`fire`/`eyes`/`skull`/`lightning`) |
| Venue following | Follow venues; **cap 10**; "My Spots" feed |
| Credibility & badges | 6 badge types; new accounts weighted 0.5–0.7, rising with age/activity |
| Notifications | 5 types with grouping (≤3 avatars + overflow) |
| Presence ("Who's here") | Privacy-first proximity, jittered counts, minimum threshold |
| Voice search | Venue search + voice-activated filters |
| Contextual hashtags | Suggestions by category, time, energy |
| Social pulse correlation | Admin dashboard (simulated ingestion) |

### 7.2 Domain engines (`src/lib/`, React-free)
`pulse-engine` · `venue-trending` · `social-pulse-engine` · `personalization-engine` ·
`presence-engine` · `crew-mode` · `weather-boost` · `night-planner` · `interactive-map`

| Req | Requirement |
|---|---|
| V-EN-1 | Engines contain **no React imports** — pure, testable, portable to Edge/Node |
| V-EN-2 | Every new `src/lib/` module ships a matching `<module>.test.ts` |

### 7.3 Privacy-critical: presence
| Req | Requirement |
|---|---|
| V-PR-1 | Counts are **jittered** — never expose exact headcount |
| V-PR-2 | A **minimum threshold** of people is required before any count renders |
| V-PR-3 | Presence respects per-user visibility settings and sensitive-venue hiding |
| V-PR-4 | Any change touching `presence-engine.ts` MUST preserve V-PR-1..3 |

### 7.4 Venue routing
- Tabs: `/` (trending), `/discover`, `/map`, `/notifications`, `/profile`, `/video` (flagged)
- Sub-pages: `/events`, `/crews`, `/achievements`, `/insights`, `/neighborhoods`,
  `/playlists`, `/settings`, `/integrations`, `/moderation`, `/challenges`,
  `/my-tickets`, `/night-planner`
- Entities: `/venue/:venueId`, `/admin/venues/:id/metadata`

| Req | Requirement |
|---|---|
| V-RT-1 | URL is authoritative: a direct load/refresh of any route renders that route (URL → app-state sync) |
| V-RT-2 | Venue card taps are real navigations to `/venue/:id`, not URL-less overlays |

### 7.5 Venue edge cases (abridged; full list in git history)
First launch · location denied (browse-only) · cooldown active · no nearby venues ·
media upload failure · video too long/unsupported · haptics unavailable ·
voice unsupported/denied/no-speech/ambiguous · offline queue · stale data ·
empty venue · expired pulses · unit-system change · notification prefs off ·
grouped notifications · surge detection + duplicate-alert cooldown · out-of-range surge ·
impact notification · follow limit (10) · pending/failed pulse · new-user credibility ·
badge overflow (max 2) · pre-trending contextual labels.

---

# PART C — Cross-cutting

## 8. Architecture (summary)

Three-tier, so the Supabase migration can proceed incrementally:

| Tier | Path | Rule |
|---|---|---|
| UI | `src/components/` | Feature components + Shadcn/Radix primitives |
| Bridge | `src/hooks/` | Binds domain logic to UI; owns providers/mutations |
| Domain | `src/lib/` | Pure TS, **no React** |

- **Data layer:** `src/lib/data/` is the canonical read/write surface. Import from
  the `@/lib/data` barrel, never individual modules.
- **Backend switch:** `resolveBackend()` / `USE_SUPABASE_BACKEND`. Real Supabase
  credentials → Supabase; otherwise transparent fallback to mock fixtures.
- **Server boundary:** `api/` (Vercel functions) + `api/_lib/`. All trusted work
  (API keys, webhook signing, payments, geocoding) belongs here — never `src/lib/`.
- **Native:** Capacitor (`com.hondoentertainment.pulse`). Platform code goes
  through `src/lib/native-bridge.ts` / `src/lib/platform/`; components MUST NOT
  import `@capacitor/*` directly.

| Req | Requirement |
|---|---|
| X-AR-1 | New persisted entity → typed module in `src/lib/data/<entity>.ts` branching on `resolveBackend()`, with **both** Supabase and mock paths |
| X-AR-2 | Supabase enforcement is incomplete — assume any new write still needs a server-side guard |

## 9. Feature flags

Read exclusively via `isFeatureEnabled(flag)` — never `import.meta.env` in feature code.

`integrations` · `socialDashboard` · `smartMap` · `weatherBoost` · `waitTime` ·
`accessibilityFilter` · `safetyKit` · `ticketing` · `aiConcierge` · `creatorEconomy`

New flag → add to the `FeatureFlag` union, the defaults map, and the reader map.

## 10. Non-functional requirements

| Area | Requirement |
|---|---|
| **Performance** | Total JS ≤ **1.56 MB gzipped** (currently ~674 KB). Per-chunk budgets in `docs/bundle-budget.md`, enforced by `npm run bundle-size` |
| **Lighthouse** | Perf assertions are warnings, not blockers. Known debt: perf ~0.70, LCP/TTI ~5.0s — improving these is an open workstream |
| **Offline** | Writes queue via `offline-queue.ts`; Workbox `backgroundSync` for `POST /rest/v1/pulses`; PWA auto-update |
| **Accessibility** | Semantic landmarks, labelled controls, ≥4.5:1 contrast (documented pairings all pass), reduced-motion respected |
| **Privacy** | Presence jitter + threshold (V-PR-*); no medical claims in Signal |
| **Security** | Trusted work server-side only; RLS policies in `supabase/migrations/`. **`src/lib/public-api.ts` is a known prototype pending server-side migration** (see `SECURITY.md`, `NOTES.md`) |
| **Type safety** | `strictNullChecks: true`; `tsc -b` must report **0 errors** |
| **Lint** | ESLint `--max-warnings=500` — a deliberate ceiling, not a target |

## 11. Design system

**Direction:** a nightclub visualizer meets a live dashboard — dark, electric, urgent.

**Color** (dark-first)
- Primary: Electric Purple `oklch(0.65 0.25 300)`
- Accent: Neon Cyan `oklch(0.75 0.18 195)`
- Surfaces: Deep Black `oklch(0.15 0 0)`, Dark Gray `oklch(0.25 0 0)`, Mid Gray `oklch(0.45 0 0)`
- Energy ramp: Dead `oklch(0.35 0.05 240)` → Chill `oklch(0.60 0.15 150)` → Buzzing `oklch(0.70 0.22 60)` → Electric `oklch(0.65 0.28 340)`
- Verified contrast: Purple/Black 5.2:1 · White/Black 14.8:1 · LightGray/DarkGray 5.1:1 · Cyan/Black 7.9:1

**Type**
- H1 Space Grotesk Bold 32px (-0.02em) · H2 24px · H3 (score) 56px
- Body Inter Medium 15px / 1.6 · Label JetBrains Mono 12px, 0.05em, uppercase
- Button Space Grotesk SemiBold 16px

**Motion** — Framer Motion, not CSS transitions.

**Tokens** — `src/index.css`, `src/main.css`, `src/styles/theme.css`.

> **Hard-won constraint:** theme variables MUST be declared on `:root`.
> They were historically scoped to `#spark-app`, a wrapper element this app does
> not have, which silently killed **every spacing/sizing utility app-wide**
> (`h-16`, `p-4`, `gap-2`, `inset-0`…) because Tailwind compiles them to
> `var(--size-*)`. Never re-scope these to a selector that isn't guaranteed to
> exist.

## 12. Success metrics

### Signal
| Metric | Definition | Target |
|---|---|---|
| D1 / D7 / D30 retention | Return and log | D7 ≥ 40% |
| Check-in completion | Started → saved | ≥ 90% |
| Time to complete | Open → saved | ≤ 30s median |
| Streak depth | Median longest streak | ≥ 7 days |
| Insight engagement | Sessions viewing `/trends` | ≥ 50% |

### Venue
| Metric | Definition | Target |
|---|---|---|
| Pulses per active venue per night | Liveness | ≥ 5 |
| Score freshness | Median age of contributing pulses | ≤ 45 min |
| Surge → visit | Alert to check-in conversion | Directional |
| Credibility health | Share of pulses from weight ≥ 1.0 | ≥ 70% |

## 13. Quality gates & release

CI (`.github/workflows/ci.yml`) on every push/PR:

**Blocking:** `lint` · `test` (+coverage floors) · `build` · `typecheck-strict` ·
`bundle-size` · `smoke-preview-signal` · `e2e-signal` · `smoke-preview` (aggregator
republishing the required context from the split smoke jobs)

**Advisory (`continue-on-error`):** `smoke-preview-venue` · `dependency-audit`

**Separate:** `lighthouse.yml` (PRs; perf = warnings; enforces gzip bundle budget) ·
`native-sync.yml` (Capacitor on `native-*` tags) · `deploy.yml`
(manual `workflow_dispatch`, target `preview`/`production`, gated on build + smoke)

Branch protection on `main` additionally requires **1 approving review**.
See [`docs/branch-protection.md`](docs/branch-protection.md).

## 14. Current status

**Signal (shipped)** — onboarding, check-in, scoring, insights, trends, history,
settings, reminders, offline-first store, Supabase sync. Smoke + E2E green.

**Venue (staged)** — feature-complete against §7 with these caveats:
mock/simulated integrations (Twitter/X ingestion, parts of social/admin),
`useKV` still backing several flows, and depth varying by feature flag.

**Health:** `tsc -b` 0 errors · lint 0 errors · **1159 unit tests passing** ·
bundle ~674 KB gz vs 1.56 MB budget · all CI checks green.

## 15. Known gaps & risks

| # | Gap | Impact | Mitigation |
|---|---|---|---|
| 1 | **Hybrid data layer** — Spark `useKV` still backs core flows | Two sources of truth; migration drag | Continue per-entity migration into `src/lib/data/` |
| 2 | **`public-api.ts` client-side prototype** | **Security** — trusted work in the browser | Migrate behind `api/`; tracked in `SECURITY.md` |
| 3 | **Supabase RLS not universal on writes** | Unauthorized writes possible | Server-side guard on every new write |
| 4 | **Lighthouse perf ~0.70, LCP ~5s** | User-perceived slowness | Dedicated perf workstream (not yet scheduled) |
| 5 | **Venue is specified but unshipped** | Large surface accruing drift | Keep smoke green; decide ship-or-archive |
| 6 | **Simulated integrations** | Demo ≠ production behavior | Flag-gate; label clearly; no synthetic data shown as real |
| 7 | **Large components** (`InteractiveMap.tsx`) | Maintainability | Decompose behind routes/slices |
| 8 | **Venue bottom nav on very tall pages** | Layout edge case | Root cause (theme scoping) fixed; re-verify if venue ships |

## 16. Roadmap — delivery waves

Sequential, review-sized slices. Each wave closes with **merged code**, **updated
tests or manual QA notes**, and **docs/env flags** where behavior is gated.
Satellite specs under `docs/prd/` ship **inside** the wave owning the same user
journey when the relevant `VITE_*` flag is on; they do not consume wave numbers
unless they slip.

> **Caveat (important).** This plan was authored 2026-05-02, **before Signal
> became the shipped product**. Every wave below targets **Venue**. It is
> retained because it is the only sequenced delivery plan in the repo, but it
> should not be read as the current roadmap for what users actually run. See
> §0 and Open Question 1 — Venue's ship/archive decision gates this entire table.
> For the engineering-health plan (tests, bundle, architecture, backend), see
> [NEXT_PHASES.md](NEXT_PHASES.md), which is structured by phase rather than wave.

| Wave | Theme | Primary deliverables | Phase / doc refs |
|------|--------|----------------------|------------------|
| **1** | My Spots & follow UX | Follow/unfollow on venue pages and cards; **My Spots** tab; chronological feed for starred venues; followed badge in lists | Phase 1.1 |
| **2** | Auth & identity | OAuth or magic-link UX wired to production IdP; session persistence; profile bootstrap; logout/revoke paths | Phase 1.2 |
| **3** | Server-backed venues | List/detail venue reads from API/Supabase; deprecate duplicate mock sources for those reads | Phase 1.2 |
| **4** | Server-backed pulses | Pulse feed + detail from API; pagination; consistent timestamps and media URLs; optional vertical video feed per `docs/prd/video-feed.md` when `VITE_VIDEO_FEED_ENABLED` | Phase 1.2 |
| **5** | Check-in & create on server | Location-verified check-in and pulse creation via API; `useKV` limited to cache/optimistic paths where justified | Phase 1.2 |
| **6** | Sync & multi-device | User settings, follows, and notification state loaded/stored remotely; conflict strategy documented | Phase 1.2 |
| **7** | Real-time feed v1 | SSE or WebSocket channel for new pulses and score updates; fallback polling | Phase 1.3 |
| **8** | Push notifications | FCM/APNs registration; preferences honored server-side; quiet hours | Phase 1.3 |
| **9** | Quality gate | Vitest for `pulse-engine`, `credibility`, `venue-trending`; CI required on PR; flake policy | Phase 1.4 |
| **10** | App shell split | Route-level ownership; slim `App.tsx`; clear boundary for `InteractiveMap`; optional MapLibre migration per `docs/maplibre-migration.md` | Phase 1.4 |
| **11** | Time-contextual scoring | Category baselines; normalized scores; contextual labels ("Heating up early", "Electric for a Tuesday afternoon") | Phase 2.1 |
| **12** | Map disclosure & density | Progressive disclosure, clustering, first-session map onboarding | Phase 2.2 |
| **13** | Recommendations | "You might like," time-aware suggestions, friend signals on cards; optional concierge entry points per `docs/prd/ai-concierge.md` | Phase 2.3 |
| **14** | Trust & safety v1 | Report flow; block/mute; moderation queue MVP; hooks for media screening | Phase 2.4, `docs/prd/safety-kit.md` |
| **15** | Social graph growth | Contact discovery stub or import; share link / QR add-friend; "people you may know" | Phase 3.1 |
| **16** | Owner & venue ops | Claim flow stub; owner dashboard MVP (traffic, peaks); labeled promotion slot; creator payouts/tips per `docs/prd/creator-economy.md` | Phase 3.2 |
| **17** | Events & RSVPs | Event entity tied to venues; Going/Interested; venue + feed surfaces; reservation handoff per `docs/prd/reservations-ticketing.md` | Phase 3.3 |
| **18** | Sharing & deep links | Pulse/venue URLs; OG tags; story/share cards | Phase 3.4 |
| **19** | Offline & performance | PWA install polish; pulse queue + background sync; image/CDN checklist; bundle budget in CI | Phase 4.1, `docs/bundle-budget.md` |
| **20** | Observability & expansion | Product analytics funnel; error/perf (Sentry); **either** Capacitor/RN spike per `docs/prd/native-apps.md` **or** a11y+i18n foundation — one capstone per quarter | Phases 4.2–4.4 |

**Follow-on backlog (post–wave 20):** Phases **5–7** (stories, crew mode,
achievements, playlists, predictive surge, monetization, public API) continue as
waves 21+ using the same table — one theme per wave, same ship criteria.

**Partially landed out-of-band.** Several wave outcomes now exist because
engineering work outpaced the table: CI quality gates and engine tests (Wave 9),
the `AppRoutes`/`MainTabRouter`/`SubPageRouter` shell split (Wave 10), PWA +
offline queue + bundle budget in CI (Wave 19), and Sentry/analytics wiring
(Wave 20). Re-baseline this table before using it for planning.

## 17. Open questions

1. **Does Venue ship?** It is the larger surface but not the live product. Ship, archive, or hold?
2. **Does Signal monetize?** No pricing model is specified anywhere in the codebase.
3. **Signal social?** Currently deliberately single-player. Is that permanent?
4. **Native release?** Capacitor is wired and CI-synced, but no App Store / Play submission process is documented.
5. **Data retention & export?** Neither a retention policy nor user data export exists for `signal_entries`.

## 18. Appendix

### Environment
| Variable | Purpose |
|---|---|
| `VITE_APP_MODE` | `signal` (default) \| `venue` |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Real values → Supabase; else mock fixtures |
| `VITE_USE_SUPABASE_BACKEND` | Force backend choice (cannot force on without credentials) |
| `VITE_E2E_AUTH_BYPASS` | Bypass auth gate (Playwright) |
| `VITE_VISUAL_PREVIEW` | Preview mode; also loads mock venue fixtures in a production build |
| `VITE_FF_*` / `VITE_*_ENABLED` | Feature flags |

### Glossary
**Pulse** — a time-boxed venue post that decays over 90 min ·
**Signal entry** — one day's self-tracking record ·
**Energy rating** — dead / chill / buzzing / electric ·
**Credibility weight** — per-user multiplier on pulse influence ·
**Presence** — jittered, thresholded "who's here" count ·
**Focus** — the metric a Signal user opted to track

### Feature-level PRDs
[`docs/prd/`](docs/prd/): `ai-concierge` · `creator-economy` · `native-apps` ·
`reservations-ticketing` · `safety-kit` · `video-feed`
