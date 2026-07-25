# Pulse — Product Requirements Document

**Real-time venue energy and personalized nightlife decisions**

| | |
|---|---|
| Version | **1.1 (complete)** |
| Supersedes | v1.0 summary (July 12, 2026) |
| Date | July 25, 2026 |
| Product owner | Kyle Henderson |
| Initial market | Seattle nightlife |
| Status | Beta complete (P0 + P1 done); public launch sign-off in progress |

**Product promise:** Know where to go right now—before you waste the night.

> **This is the canonical product specification.** It replaces the v1.0 summary, which deferred
> requirement tables, personas, data model, monetization, and acceptance criteria to an external
> source document. Those sections are now inline. The filename is retained so existing links from
> [SEATTLE_BETA_BACKLOG.md](./SEATTLE_BETA_BACKLOG.md), [EXPANSION_GATE_SCOREBOARD.md](./EXPANSION_GATE_SCOREBOARD.md),
> and source comments (`§15.1`, `§8.1`, …) keep resolving.
>
> The legacy feature-oriented prototype spec remains at [../PRD.md](../PRD.md) for history only.
> Flagged feature areas keep their own satellite specs in [`docs/prd/`](./prd/) (see §19).

**Section numbering is a stable contract.** Code comments and the delivery backlog cite sections by
number (`src/lib/expansion-gates.ts` → §15.1, `src/lib/decision-analytics.ts` → §8.1,
`src/lib/sponsorship-integrity.ts` → §10). Do not renumber sections; append instead.

---

## Table of contents

| § | Section |
|---|---------|
| 1 | [Overview](#1-overview) |
| 2 | [Objectives and success metrics](#2-objectives-and-success-metrics) |
| 3 | [Scope and launch surface](#3-scope-and-launch-surface) |
| 4 | [Users and golden path](#4-users-and-golden-path) |
| 5 | [The signal model](#5-the-signal-model) |
| 6 | [Functional requirements — decision surfaces](#6-functional-requirements--decision-surfaces) |
| 7 | [Functional requirements — contribution loop](#7-functional-requirements--contribution-loop) |
| 8 | [Analytics and instrumentation](#8-analytics-and-instrumentation) |
| 9 | [Ranking and personalization](#9-ranking-and-personalization) |
| 10 | [Monetization and sponsorship integrity](#10-monetization-and-sponsorship-integrity) |
| 11 | [Non-functional requirements](#11-non-functional-requirements) |
| 12 | [Data model](#12-data-model) |
| 13 | [Admin and internal tools](#13-admin-and-internal-tools) |
| 14 | [Extended engagement surfaces](#14-extended-engagement-surfaces) |
| 15 | [Launch plan, geography, and expansion gates](#15-launch-plan-geography-and-expansion-gates) |
| 16 | [Trust, safety, and moderation](#16-trust-safety-and-moderation) |
| 17 | [Risks and mitigations](#17-risks-and-mitigations) |
| 18 | [Acceptance criteria and test mapping](#18-acceptance-criteria-and-test-mapping) |
| 19 | [Flagged feature portfolio](#19-flagged-feature-portfolio) |
| 20 | [Roadmap and operating cadence](#20-roadmap-and-operating-cadence) |
| A–C | [Appendices](#appendix-a--glossary-of-product-terms) |

---

## 1. Overview

### 1.1 Problem

Deciding where to go out is a real-time problem solved with stale data. Google Maps popularity
graphs are historical averages, Yelp reviews describe a venue's reputation rather than tonight, and
Instagram tells you where someone *was*. The failure mode is expensive and emotional: a group
travels 20 minutes to a place that is dead, or waits 40 minutes at a door they would have skipped
had they known the line.

### 1.2 Product

Pulse is a **real-time decision engine** for going out. A user picks the vibe they want, and Pulse
returns a short ranked list of venues with four things competitors do not provide together:

1. **Live energy** — Dead, Chill, Buzzing, or Electric, derived from community reports inside a
   90-minute window rather than historical averages.
2. **Visible confidence** — every signal states how much evidence backs it (High / Medium / Low /
   None) and how old that evidence is.
3. **Friction** — distance, wait time, cover charge, dress code, and accessibility surfaced before
   the user commits, not after they arrive.
4. **A reason** — a plain-language explanation of why this venue was recommended to *this* user
   right now.

### 1.3 Strategy

Energy data is only valuable if it is dense and fresh, and density is local. Pulse therefore
launches deliberately narrow — **25–40 curated venues** across **3–5 Seattle neighborhoods**,
primarily **Thursday–Saturday evenings** — and does not expand geography until measured density and
retention gates hold for eight consecutive weeks (§15.1). Coverage honesty is a feature: showing
"no live signal" beats showing a stale guess, because a single misleading recommendation costs more
trust than ten honest gaps.

### 1.4 Principles

| Principle | Consequence in product |
|-----------|------------------------|
| **Honest over complete** | Empty and low-confidence states are designed, never filled with synthetic activity. |
| **Decisions, not feeds** | Success is a user leaving for a venue, not time-in-app. |
| **Freshness beats volume** | A single 10-minute-old report outranks fifty from three hours ago. |
| **Explain the recommendation** | Every pick states why, in one sentence, without exposing gameable weights. |
| **Payment never buys signal** | Sponsorship is a labeled insertion layer, structurally separated from organic rank (§10). |
| **Contribution must cost ~3 taps** | If reporting is work, the data dies. |

---

## 2. Objectives and success metrics

### 2.1 North-star metric — Decision Conversion Rate

**Definition.** The percentage of *qualified sessions* that produce a **decision action** within
**30 minutes** of session start.

- **Qualified session** — a session that reaches the Tonight feed or Map with at least one venue
  rendered, inside a supported city and operating window.
- **Decision action** — any of: `go_selected`, `directions_started`, `venue_saved`,
  `venue_shared`, `arrival_confirmed`.

Implemented in `src/lib/decision-analytics.ts`; surfaced in-product by
`src/components/DecisionConversionStrip.tsx`. The event contract is §8.1.

**Target: ≥ 35%**, which is also the first expansion gate (§15.1).

### 2.2 Supporting product metrics

| Metric | Definition | Target |
|--------|-----------|--------|
| **Fresh venue coverage** | Share of in-market venues whose newest evidence is < 90 min old, measured during operating windows | ≥ 70% (`FRESH_COVERAGE_MAX_MINUTES = 90`, `src/lib/fresh-coverage.ts`) |
| **Week-4 retention** | Users active in week 4 after first qualified session | ≥ 25% |
| **Misleading signal rate** | Arrivals where the user reports the displayed energy was wrong, over total arrival prompts answered (`mismatch_reported` ÷ `arrival_confirmed`) | < 10% |
| **Scout weekly participation** | Approved scouts submitting ≥ 1 verified report in an operating week | ≥ 50% |
| **Report latency** | Report submitted → signal visible to other clients | p95 < 2 s (§11.1) |
| **Time to first decision** | Session start → first decision action | p50 < 90 s |

### 2.3 Explicit non-goals for v1

Pulse is **not** a social network, a review site, a reservation system, or a check-in game.
Follower counts, comment threads, and vanity leaderboards are out of scope because they trade
decision quality for engagement. Public credibility scores are out of scope for the same reason —
credibility exists (§5.4) but is never displayed as a rank.

---

## 3. Scope and launch surface

### 3.1 Launch inventory — Seattle

| Attribute | Value |
|-----------|-------|
| Venue count | **30 curated venues** (target band 25–40) |
| Neighborhoods | Capitol Hill, Belltown, Ballard, Fremont, Downtown, SODO, Pioneer Square |
| Operating window | Thursday–Saturday, 6pm–2am (primary); Wed/Sun secondary |
| Categories | Bar, cocktail lounge, nightclub, music venue, brewery, late-night food |
| Required per venue | Name, geo, category, hours, neighborhood, price range, dress code, cover charge, accessibility features |

Source of truth: `src/lib/seattle-nightlife-catalog.ts` (`SEATTLE_NIGHTLIFE_CURATED`), merged through
`src/lib/prototype-catalog.ts` and seeded to Supabase via
`supabase/migrations/20260713000000_seattle_nightlife_seed.sql` (generator:
`scripts/gen-seattle-seed.mjs`).

Geography is enforced at the edge by `VITE_LAUNCHED_CITIES`; out-of-market users get a waitlist
experience rather than an empty map.

### 3.2 Launch surface decision

The repository contains **two product shells**. This is a deliberate, documented split, and the
launch surface was decided on 2026-07-12:

| Shell | Entry | Purpose | Env |
|-------|-------|---------|-----|
| **Venue decision PWA** — the product this PRD specifies | `src/AppRoutes.tsx` | Public MVP launch surface | `VITE_APP_MODE=venue` **and** `VITE_ALLOW_VENUE_SHELL=true` |
| **Pulse Signal** — daily personal check-in research shell | `src/components/signal/SignalApp.tsx` | Internal research / pilot instrument, not a public launch | `VITE_APP_MODE=signal` |

`src/lib/app-mode.ts` gates this. **In production the venue shell requires
`VITE_ALLOW_VENUE_SHELL=true`; without it, users receive the Signal shell.** Verifying this pair in
Vercel production env is a launch-blocking checklist item (§15.3).

> **Open decision (owner: Product).** `docs/VENTURE_NEXT_STEPS.md` recommends keeping the
> fundraising narrative on Pulse Signal, while `docs/LAUNCH_CHECKLIST.md` names the venue PWA as the
> launch surface. Both can be true (public product vs. research instrument), but the public brand,
> manifest, and store copy must name exactly one. This PRD assumes the venue PWA is the public
> product.

### 3.3 In scope for v1

Tonight feed and vibe selection; map and Explore list with signal parity; four energy states with
confidence, freshness, and trend; 3-tap energy reporting; full pulse creation with photo/video;
arrival and mismatch loop; preferences and filters; guest browse; auth; confidence-gated alerts;
Scout program; venue portal pilot; admin signal and catalog-quality tooling; sponsorship integrity;
WCAG 2.2 AA on the golden path.

### 3.4 Out of scope for v1 (deferred, flags off)

Ticketing, reservations, and POS integrations; transportation and Spotify integrations as first-class
surfaces; creator economy; AI concierge chat; vertical video feed; Safety Kit SMS dispatch; native
app binaries; multi-city; daytime categories; group matching. Each has a satellite spec and a flag
(§19) and stays **off in production** until its own gate is met.

---

## 4. Users and golden path

### 4.1 Personas

**P1 — The Decider** (primary). Age 24–34, urban, goes out 2–5 times a month, usually deciding for a
group in a text thread. Job: *"Tell me where to go in the next 20 minutes so I don't waste the
night."* Currently checks Google Maps popular times, Instagram stories, and asks friends. Succeeds
when Pulse gives a confident answer and a reason within 90 seconds. Fails when the app shows a wall
of venues with no evidence, or recommends a place that turns out to be dead.

**P2 — The Guest Browser.** Arrives from a share link or search with no account. Job: *"Show me
whether this thing is real before I sign up."* Must be able to browse venues and see signal without
authenticating (`ONB-01`); authentication is required only to write.

**P3 — The Scout.** A high-frequency local who enjoys being early and being right. Job: *"Let me be
the reason my neighborhood has good data."* Applies, is approved by an admin, and receives a tier
with a weekly report quota (§15.2). Reputation comes from **corroboration, not volume** — reports
that other reports later confirm.

**P4 — The Venue Operator.** Bar manager or owner at one of 5–10 pilot venues. Job: *"Understand
what tonight looks like and correct wrong information about my venue."* Claims the venue, sees
traffic and peak patterns, and posts authoritative operator status (door pace, cover, guest list).
Explicitly cannot buy energy or confidence (§10).

**P5 — The Group Planner.** Coordinating 3–8 people with conflicting constraints. Job: *"Give me a
shortlist I can drop in the group chat."* Served by shareable shortlists and vibe handoff links
(§14).

**P6 — The Safety-Conscious User.** Skews under 30 and female; cites getting home safely as the top
anxiety of a night out. Served by the flagged Safety Kit (§19), not by v1.

### 4.2 Golden path

The single flow the product is optimized for. Every P0 requirement exists to serve a step here.

| Step | User action | System response | Requirements |
|------|-------------|-----------------|--------------|
| 1 | Opens Pulse in a supported city during an operating window | Session starts; `decision_session_start` fires; location resolved or requested | ONB-01–04 |
| 2 | Picks a vibe: Dead, Chill, Buzzing, Electric, or Any | `vibe_selected`; feed re-ranks to the target energy band | REC-01 |
| 3 | Scans the Tonight feed (or switches to Map) | ≤ 10 ranked venues, each with energy, confidence, freshness, trend, distance, and a one-line reason | REC-02–04, MAP-01–05 |
| 4 | Opens a venue card | "Worth going?" verdict block: fit, energy, trend, confidence, freshness, friction, source mix | VEN-01–06 |
| 5 | Taps **Go**, directions, save, or share | Decision action recorded → counts toward Decision Conversion Rate | REC-05 |
| 6 | Arrives; is prompted once | 3-tap energy report, or "not like this" mismatch report | RPT-01, RPT-05–06 |
| 7 | Sees the effect | Venue signal refreshes with the user's contribution and rising confidence | RPT-04, §5 |

**Golden-path performance budget:** step 1 → step 3 in **under 3 seconds** on 4G; step 6 completable
in **3 taps**.

---

## 5. The signal model

The signal model is the product. It is **versioned** —
`VENUE_SIGNAL_MODEL_VERSION = '1.0.0'` in `src/lib/venue-signal.ts` — and the version must be bumped
whenever thresholds, decay, or confidence rules change, so analytics can be segmented across model
changes.

### 5.1 Energy

Energy is a **perception signal, not an occupancy count**. Four states, and no more, because the
states must be reportable in one tap and comparable across venue types.

| State | Score band | Meaning |
|-------|-----------|---------|
| **Dead** | 0–24 | Empty or closing down |
| **Chill** | 25–49 | Relaxed, conversational, seats available |
| **Buzzing** | 50–74 | Full and lively |
| **Electric** | 75–100 | Peak — packed, loud, high energy |

Bands are enforced in `src/lib/pulse-engine.ts`; per-report numeric weights come from
`ENERGY_CONFIG` in `src/lib/types.ts`.

### 5.2 Score computation

Venue pulse score is the weighted sum of reports inside the decay window, capped at 100:

```
recencyFactor     = 1 - (ageMs / decayMs)                    // linear; newest report = 1.0
engagementFactor  = 1 + (fire*0.5 + lightning*0.5 + eyes*0.2 + views*0.1) / 100
credibilityWeight = report author credibility, 0.5 … 2.0     // §5.4
squadMultiplier   = report has crewId ? 1.5 : 1.0

contribution      = energyValue * recencyFactor * engagementFactor
                    * credibilityWeight * squadMultiplier * 25

velocityBonus     = validReports > 5 ? validReports * 5 : 0

pulseScore        = min(100, round(Σ contribution + velocityBonus))
```

| Constant | Value | Location |
|----------|-------|----------|
| Decay window | **90 minutes** (`PULSE_DECAY_MINUTES`) | `src/lib/types.ts` |
| Check-in radius | **0.062 mi** (~330 ft, `CHECK_IN_RADIUS_MILES`) | `src/lib/types.ts` |
| Repeat-report cooldown | **120 minutes** per user per venue (`COOLDOWN_MINUTES`) | `src/lib/types.ts` |
| Crew multiplier | **1.5×** | `src/lib/pulse-engine.ts` |

Reports older than the decay window are **excluded**, not decayed toward zero. **The server is
authoritative**: the score is recomputed on insert by Postgres triggers
(`supabase/migrations/20260429000000_realtime_venue_intelligence.sql`); the client engine exists for
optimistic UI, offline mode, and tests.

> **Known delta (owner: Eng).** `docs/scoring-algorithm.md` documents energy values 1–4; the running
> code uses 0–3 (`ENERGY_CONFIG`). Band thresholds agree. A `dead` report therefore contributes
> exactly zero rather than a small positive value. Reconcile the doc to the code, or change the code
> deliberately and bump `VENUE_SIGNAL_MODEL_VERSION`.

### 5.3 Confidence, freshness, and trend

**Confidence must always be visible.** Derived by `deriveSignalConfidence(reportCount, freshnessMinutes)`:

| Level | Requires | UI label |
|-------|----------|----------|
| **High** | ≥ 3 reports **and** newest ≤ 45 min | "Strong live consensus" |
| **Medium** | ≥ 2 reports **and** newest ≤ 60 min | "Moderate live consensus" |
| **Low** | ≥ 1 report **and** newest ≤ 90 min | "Thin live consensus" |
| **None** | 0 reports, or beyond the above | "No live reviews" |

**Freshness** degrades in stated stages rather than silently (`freshnessLabel` in
`src/lib/decision-explanations.ts`): live (≤ 45 min) → "last known X min ago" (≤ 90 min) → "Live
reviews are aging — treat as last known" (> 90 min) → "No live reviews yet".

**Trend** compares mean energy across the first and second half of the recent report set: delta
≥ +0.4 → `rising`, ≤ −0.4 → `fading`, otherwise `steady`; fewer than 2 reports → `unknown`.

**Worth-going verdict** (`deriveWorthGoing`) composes the above into one of `yes` / `maybe` /
`caution` / `unknown`: High confidence plus vibe match → `yes`; Medium plus match → `maybe`; any
energy mismatch → `maybe`; Low confidence or freshness beyond 90 min → `caution`; None → `unknown`.

Per-signal trust gating lives in `src/lib/venue-freshness.ts`, which marks each of pulse score,
crowd level, wait time, and last report as `fresh` / `stale` / `untrusted` (wait time is the
strictest: fresh ≤ 10 min, untrusted > 30 min). Operational live intel (wait, cover, music, door
pace) uses a separate 30-minute window and its own confidence rule in `src/lib/live-intelligence.ts`.

### 5.4 Contributor credibility

Credibility weights a report's influence on the score. It is computed at report time and stored on
the row (`src/lib/credibility.ts`), so historical scores remain reproducible.

| Component | Value |
|-----------|-------|
| Base — account < 1 day / < 7 d / < 30 d / ≥ 30 d | 0.5 / 0.7 / 0.9 / 1.0 |
| Volume bonus — ≥ 10 / ≥ 20 / ≥ 50 total reports | +0.1 / +0.2 / +0.3 |
| Engagement bonus — mean reactions ≥ 5 / ≥ 10 | +0.1 / +0.2 |
| **Clamp** | **0.5 – 2.0** |

**Credibility is never displayed as a number or rank.** It surfaces only as at most **two** ambient
trust badges on a report card: `regular`, `frequent`, `veteran`, `active-tonight`, `return-visit`,
`trusted`. New accounts start at 0.5, which caps the damage a burst of fake accounts can do to a
venue's score.

> **Known delta (owner: Eng).** `docs/scoring-algorithm.md` describes credibility reduction for spam.
> Abuse is currently handled by *blocking* writes (`src/lib/rate-limiter.ts` `detectAbuse()`), not by
> reducing the stored weight. Either implement the reduction or correct the doc.

### 5.5 Suppression

A venue can be marked `signal_suppressed` by an admin (§13). Suppressed venues return confidence
`none` and `null` freshness, and are excluded from Tonight ranking by `filterNonSuppressedVenues()`.
This is the containment lever for a venue whose data is being manipulated or is systematically wrong.

---

## 6. Functional requirements — decision surfaces

Priority: **P0** = required for beta, **P1** = required for closed pilot, **P2** = deferred.
All P0 and P1 items below are implemented (see [SEATTLE_BETA_BACKLOG.md](./SEATTLE_BETA_BACKLOG.md)).

### 6.1 Access and onboarding (`ONB`)

| ID | Requirement | Priority | Acceptance criteria |
|----|-------------|----------|---------------------|
| ONB-01 | Guest browse without an account | P0 | Unauthenticated user can view Tonight, Map, Explore, and venue detail with full signal; every write path prompts sign-in without losing context. `src/lib/guest-browse.ts` |
| ONB-02 | Auth via OAuth or magic link | P0 | Google/Apple/magic-link sign-in; session persists across reloads and devices; sign-out revokes locally. Supabase Auth |
| ONB-03 | Location permission with graceful denial | P0 | Purpose is explained before the OS prompt; denial degrades to a city-level browse mode instead of an empty state |
| ONB-04 | Preference bootstrap | P0 | First run captures category preferences in ≤ 3 screens and can be skipped; choices feed §9 personalization |
| ONB-05 | Out-of-market waitlist | P0 | Users outside `VITE_LAUNCHED_CITIES` see a waitlist capture (`waitlist_join`), never an empty map |
| ONB-06 | Public landing page | P1 | `/welcome` renders brand, value proposition, and CTA; shown once per device |

### 6.2 Map and Explore (`MAP`)

| ID | Requirement | Priority | Acceptance criteria |
|----|-------------|----------|---------------------|
| MAP-01 | Live energy on the map | P0 | Pin color encodes the energy band; a pin never shows a band that its confidence cannot support |
| MAP-02 | **Signal parity between map and list** | P0 | Energy, confidence, trend, and freshness render identically on map pins and Explore rows (`SignalIntelBadges`) |
| MAP-03 | Progressive disclosure | P0 | Default view emphasizes nearby high-signal venues; clustering at low zoom; full overlay is opt-in |
| MAP-04 | Filters | P0 | Energy band, category, distance, and accessibility filters; each emits `filter_applied`; results update without a full reload |
| MAP-05 | Live position and re-center | P0 | User position with accuracy indicator; manual pan disables auto-follow; re-center restores it |
| MAP-06 | Accessibility filter | P1 | Filter by the 9 supported accessibility tokens; gated by `VITE_ACCESSIBILITY_FILTER_ENABLED` (default on) |
| MAP-07 | No-signal honesty | P0 | Venues with confidence `none` are visually distinct and never rendered as an energy state |

### 6.3 Tonight feed (`REC`)

| ID | Requirement | Priority | Acceptance criteria |
|----|-------------|----------|---------------------|
| REC-01 | Vibe selection | P0 | Dead / Chill / Buzzing / Electric / Any as a keyboard-accessible radiogroup; emits `vibe_selected`; re-ranks in < 300 ms |
| REC-02 | Ranked picks | P0 | ≤ 10 venues ranked per §9; candidate pool is 2× the limit; suppressed venues excluded |
| REC-03 | Confidence-gated inclusion | P0 | Venues with confidence `none` are excluded unless the result set would otherwise be empty, in which case they are explicitly labeled as having no live signal |
| REC-04 | Explanation per pick | P0 | One-line reason (`buildDecisionExplanation`) naming energy, trend, and up to two personal-fit reasons; expandable detail emits `explanation_expanded`; internal weights are never exposed |
| REC-05 | Decision actions | P0 | Go, directions, save, share on every card; each emits its §8.1 event |
| REC-06 | Friction disclosure | P0 | Distance/ETA, wait estimate, cover charge, and dress code shown before commit when known |
| REC-07 | Sponsored slots | P0 | Sponsored venues occupy labeled insertion slots and do not alter organic ordering (§10) |
| REC-08 | Vibe deep link | P1 | `/?vibe=` preselects a vibe for hand-off from the dashboard or a shared link |

### 6.4 Venue detail and "Worth going?" (`VEN`)

| ID | Requirement | Priority | Acceptance criteria |
|----|-------------|----------|---------------------|
| VEN-01 | **"Worth going?" block** | P0 | Single block at the top: verdict, confidence, freshness, friction, and source mix (`WorthGoingPanel.tsx`) |
| VEN-02 | Score transparency | P0 | "Why this score?" expands to report count in window, mean energy, recent change, and last report time — never the formula or weights |
| VEN-03 | Energy timeline | P1 | Real report history only; honest empty state; no synthetic curve |
| VEN-04 | Live intel panel | P0 | Wait, cover, crowd, music, and door pace with independent per-signal confidence and staleness (`src/lib/live-intelligence.ts`) |
| VEN-05 | Structured metadata | P0 | Dress code, cover charge (cents + note), indoor/outdoor, accessibility features, hours, price range |
| VEN-06 | Operator status | P1 | Claimed-venue operator posts are labeled as operator-sourced and rendered distinctly from community reports |
| VEN-07 | Presence, privacy-first | P0 | "Who's here" counts appear only at ≥ 2 known people and are bucketed (e.g. "5+"); global and per-venue opt-out |
| VEN-08 | Share and save | P0 | Shareable venue URL with OG metadata; save adds to favorites and emits `venue_saved` |

### 6.5 Signal engine integration

| ID | Requirement | Priority | Acceptance criteria |
|----|-------------|----------|---------------------|
| SIG-01 | Single versioned engine | P0 | All surfaces read `VenueSignal` from `src/lib/venue-signal.ts`; no surface recomputes confidence locally |
| SIG-02 | Propagation SLA | P0 | New report visible to other clients in p95 < 2 s via Supabase Realtime, with polling fallback |
| SIG-03 | Model versioning | P0 | `VENUE_SIGNAL_MODEL_VERSION` is emitted with signal analytics so metrics can be segmented across changes |
| SIG-04 | Suppression respected everywhere | P0 | A suppressed venue shows confidence `none` on every surface, including map and share previews |

### 6.6 Alerts (`ALR`)

| ID | Requirement | Priority | Acceptance criteria |
|----|-------------|----------|---------------------|
| ALR-01 | **Confidence-gated surge alerts** | P1 | Alerts fire only at Medium confidence or better (`src/lib/surge-alerts.ts`) — the product never pushes a guess |
| ALR-02 | Proximity and volume limits | P1 | Within 5 miles; per-venue cooldown; capped per user per night; server-side rate limit 20/hr |
| ALR-03 | Preferences honored server-side | P0 | Categories toggled off in settings are not dispatched; stored in `profiles.notification_settings` |
| ALR-04 | Durable feed | P0 | Notifications persist server-side and survive reinstall; grouped when multiple users act on one item |
| ALR-05 | Native push | P0 | FCM + APNs registration and fan-out; dead tokens pruned |
| ALR-06 | Quiet hours | P1 | No non-safety pushes outside a user's configured window |

### 6.7 Scout program (`SCT`)

| ID | Requirement | Priority | Acceptance criteria |
|----|-------------|----------|---------------------|
| SCT-01 | Apply | P1 | In-app application capturing motivation and target neighborhoods (`POST /api/scouts/apply`) |
| SCT-02 | Admin approval | P1 | Admin approves/rejects at `/admin/signal`; approval defaults to `rookie` |
| SCT-03 | Tiers and quotas | P1 | Rookie 3, Regular 7, Lead 14 verified reports per week (`SCOUT_TIERS`, `src/lib/scout-program.ts`) |
| SCT-04 | Reputation from corroboration | P1 | Tier advancement is driven by reports later corroborated by independent reports, **not** by raw volume |
| SCT-05 | Quota enforcement | P1 | `canSubmitScoutReport()` blocks submissions above the weekly quota with a clear message |

### 6.8 Venue portal pilot (`OPS`)

| ID | Requirement | Priority | Acceptance criteria |
|----|-------------|----------|---------------------|
| OPS-01 | Claim flow | P1 | Operator submits a claim; admin verifies; durable state in `venue_claims` |
| OPS-02 | Operator dashboard | P1 | Traffic, peak windows, and report volume for claimed venues (5–10 pilot operators) |
| OPS-03 | Operator status posting | P1 | Door pace, cover, and guest-list state, labeled as operator-sourced |
| OPS-04 | Metadata correction | P1 | Operator proposes metadata corrections; admin reviews before publish |
| OPS-05 | **No paid signal** | P0 | Operator actions cannot change energy, confidence, or organic rank — enforced structurally (§10) |

---

## 7. Functional requirements — contribution loop

Data density is the product's survival condition. Reporting must be trivially cheap and must visibly
pay the user back.

### 7.1 Reporting (`RPT`)

| ID | Requirement | Priority | Acceptance criteria |
|----|-------------|----------|---------------------|
| RPT-01 | **3-tap energy report** | P0 | From venue detail: open sheet → pick energy → confirm. No photo, caption, or hashtag required (`EnergyReportSheet.tsx`) |
| RPT-02 | Location verification | P0 | Reports require presence within `CHECK_IN_RADIUS_MILES` (0.062 mi); out-of-range attempts are blocked with an explanation |
| RPT-03 | Cooldown | P0 | 120-minute per-user per-venue cooldown with a visible countdown; server-side limit 10 creates/hour |
| RPT-04 | Visible payback | P0 | After submitting, the user sees the venue's refreshed signal and improved confidence |
| RPT-05 | **Arrival prompt** | P0 | One prompt per venue visit asking to confirm the vibe (`ArrivalPromptSheet`, `src/lib/arrival-prompt.ts`); emits `arrival_confirmed` |
| RPT-06 | **Mismatch feedback** | P0 | "Not like this" path emits `mismatch_reported` with the displayed energy; feeds the misleading-signal metric (§2.2) |
| RPT-07 | Rich pulse creation | P0 | Optional up to 3 photos **or** one ≤ 30 s video (client-compressed, ≤ 10 MB), caption, and contextual hashtags |
| RPT-08 | Offline queue | P0 | Reports created offline are queued, shown as pending, and replayed on reconnect with a retry affordance |
| RPT-09 | Live intel reports | P0 | Wait, cover, crowd, and music reports with independent 30-minute windows |
| RPT-10 | Server-side moderation | P0 | Every write is checked server-side before persistence; the client check is advisory only (§16) |

### 7.2 Arrival and mismatch loop

The loop that keeps the model honest, and the source of the misleading-signal gate (§15.1):

1. Arrival is inferred from proximity plus dwell after a decision action.
2. The user is prompted **once** — asking twice is worse than not asking.
3. Confirm → `arrival_confirmed` (a decision conversion) and a fresh report.
4. Mismatch → `mismatch_reported` carrying the energy that was *displayed*, so error is attributable
   to a specific signal state rather than to the venue.
5. Sustained mismatch on a venue is an operational trigger for suppression review (§13).

### 7.3 Vibe Vision — photo-assisted energy

Optional AI assist that lowers reporting cost by proposing an energy rating from a photo the user was
already taking. Flag: `VITE_VIBE_VISION_ENABLED` (default off). Docs: [vibe-vision.md](./vibe-vision.md).

| Aspect | Specification |
|--------|--------------|
| Flow | Capture → client compress (max 1280×1280, q 0.72) → signed upload → `POST /api/vibe/assess` |
| Model | Anthropic Claude vision, default `claude-sonnet-4-6` (`VIBE_VISION_MODEL`) |
| Output | `energyRating`, `confidence` 0–1, summary, ≤ 5 tags, crowd density, lighting, safety verdict |
| Auto-apply threshold | Confidence **≥ 0.4** pre-fills the energy selection |
| **User authority** | The suggestion is always overridable; overrides emit `vibe_assess_overridden`. The AI never submits a report on its own |
| Safety | `safe: false` → HTTP 422 `content_blocked`; emits `vibe_assess_blocked` |
| Rate limit | 20 assessments / hour / user |
| Cost cap | **50¢ / user / UTC day** (`VIBE_VISION_DAILY_CENTS_CAP`) → HTTP 402 `cap_reached`, emits `vibe_assess_cap_hit` |
| Telemetry | `vibe_assess_daily`, `vibe_assess_events`; admin review at `/admin/signal` |

---

## 8. Analytics and instrumentation

Two layers exist by design: `src/lib/analytics.ts` (funnel events, in-memory log + Vercel Analytics +
Sentry for errors) and `src/lib/observability/analytics.ts` (typed registry with pluggable backend via
`VITE_ANALYTICS_BACKEND` = `amplitude` | `posthog` | `console` | `noop`).

### 8.1 Decision analytics contract

**These ten events are a stability contract.** They define the north-star metric and the expansion
gates; renaming or dropping one breaks §2.1 and §15.1. Implemented in
`src/lib/decision-analytics.ts`.

| Event | Required properties |
|-------|--------------------|
| `decision_session_start` | `sessionId` |
| `vibe_selected` | `sessionId`, `vibe` |
| `recommendation_viewed` | `sessionId`, `venueId`, `rank`, `confidence`, `source` |
| `explanation_expanded` | `sessionId`, `venueId` |
| `go_selected` | `sessionId`, `venueId` |
| `directions_started` | `sessionId`, `venueId` |
| `venue_saved` | `sessionId`, `venueId` |
| `venue_shared` | `sessionId`, `venueId`, `method` |
| `arrival_confirmed` | `sessionId`, `venueId` |
| `mismatch_reported` | `sessionId`, `venueId`, `displayedEnergy` |
| `filter_applied` | `sessionId`, `filter` |

**Decision conversion set:** `go_selected`, `directions_started`, `venue_saved`, `venue_shared`,
`arrival_confirmed`.

### 8.2 Product funnel events

`app_open`, `onboarding_start`, `onboarding_complete`, `venue_view`, `pulse_start`, `pulse_submit`,
`pulse_reaction`, `venue_discovery`, `share`, `friend_add`, `event_rsvp`, `waitlist_join`,
`guest_browse_start`, `integration_action`, `neighborhood_*`, `venue_data_fallback`, `error`,
`performance`.

### 8.3 Typed registry events

`onboarding_started`, `onboarding_completed`, `pulse_created`, `pulse_viewed`, `reaction_added`,
`venue_viewed`, `check_in_completed`, `search_performed`, `friend_added`,
`surge_notification_opened`, plus the Vibe Vision family (`vibe_assessed_from_photo`,
`vibe_assess_blocked`, `vibe_assess_cap_hit`, `vibe_assess_overridden`, `concierge_photo_attached`).

### 8.4 Instrumentation requirements

| ID | Requirement | Acceptance criteria |
|----|-------------|---------------------|
| ANA-01 | No silent event loss | Every §8.1 event has a call site on the golden path, asserted by test |
| ANA-02 | Session correlation | All decision events in one session share a `sessionId` |
| ANA-03 | Signal version tagging | Recommendation events carry the signal model version |
| ANA-04 | Backend-agnostic | Switching `VITE_ANALYTICS_BACKEND` requires no call-site changes |
| ANA-05 | Privacy | No precise coordinates or PII in event properties; venue IDs only |

> **Known delta (owner: Eng).** `REGISTERED_EVENTS` omits several registry events that are defined and
> emitted (the `vibe_assess_*` family, `concierge_photo_attached`). `realtime_delivery_latency_ms`
> is referenced by `docs/slos.md` but is not yet in the event union — required to measure SIG-02.

---

## 9. Ranking and personalization

Two stages: a personal fit score, then a decision re-rank. Implemented in
`src/lib/venue-recommendations.ts` and `src/lib/tonight-feed.ts`.

### 9.1 Personal fit

| Factor | Max points | Basis |
|--------|-----------|-------|
| Category match | 30 | Learned category preference from check-in history |
| Time-appropriate | ~25 | Peak-hour multiplier for the venue's category (`src/lib/time-contextual-scoring.ts`) |
| Friend activity | 35 | Friends active at the venue within 180 min |
| Trending | 20 | Pulse score ≥ 50 |
| Live intel | ~22 | Report volume and high-confidence signals; short wait rewarded, long wait penalized |
| New discovery | 10 | Not previously visited or favorited |
| Proximity | 15 / 10 / 5 | ≤ 1 mi / ≤ 5 mi / ≤ 15 mi |
| Already followed | ×0.8 | Slight demotion — the user already knows about it |

A venue must produce **at least one stated reason** to be eligible. If we cannot explain it, we do
not recommend it.

### 9.2 Tonight re-rank

```
rankScore = vibeEnergyRank(pulseScore, vibe) * 0.25
          + personalFitScore              * 0.30
          + confidenceWeight              * 20      // high 3, medium 2, low 1, none 0
          + max(0, 10 - distanceMiles)
          + (trend === 'rising' ? 5 : 0)
```

`vibeEnergyRank` targets the selected band (dead 12, chill 37, buzzing 62, electric 87) and penalizes
distance from that target, so choosing "Chill" surfaces genuinely chill venues rather than the
loudest ones. **Confidence carries up to 60 points of headroom** — a well-matched venue with no
evidence loses to a slightly worse-matched venue we can actually vouch for.

### 9.3 Time-contextual normalization

Category baselines by time-of-day bucket (early morning, morning, afternoon, evening, night, late
night) prevent a café from permanently losing to a nightclub on raw score:

```
baselineRatio = raw / expectedBaseline
contextual    = raw * multiplier * min(baselineRatio, 2.0)
blended       = contextual * 0.6 + raw * 0.4
```

Currently used for peak-hour bonuses (§9.1) and contextual labels ("Electric for a Tuesday
afternoon"). **`sortByContextualScore()` is implemented but intentionally not wired into Tonight
ranking** — it matters when daytime categories enter scope (§3.4), and turning it on requires a
model version bump.

### 9.4 Weather adjustment

Flag `VITE_WEATHER_BOOST_ENABLED` (default on). Deltas applied to contextual score, not to pulse
score: rain indoor +10 / outdoor −15; snow outdoor −20 / indoor +10; storm outdoor −20 / indoor +5;
clear ≥ 18°C outdoor +10; clear ≤ 5°C outdoor −5; wind ≥ 35 kph rooftop −10; visibility ≤ 2 km
outdoor −5. Source: Open-Meteo via `/api/weather/current` (no API key required).

### 9.5 Wait-time estimation

Flag `VITE_WAIT_TIME_ENABLED` (default on). Estimates clamped 0–90 min; confidence from sample size
(< 5 low, 5–15 medium, 16+ high); recomputed by cron every 10 minutes; a row older than 15 minutes is
stale and shown as such rather than as a current estimate.

---

## 10. Monetization and sponsorship integrity

### 10.1 Integrity rule (non-negotiable)

> **Venue payment can never raise organic energy, confidence, or ranking, and sponsored content is
> always labeled.**

Enforced structurally, not by policy: organic ranking paths compute on base scores only, and
sponsorship is a separate insertion layer (`src/lib/sponsorship-integrity.ts`). This is verified by
audit (P0-12) and is an acceptance test (§18). If a change would let money touch rank, the change is
rejected.

### 10.2 Revenue streams

| Stream | Model | Numbers | Status |
|--------|-------|---------|--------|
| **Labeled sponsored slots** | Fixed insertion slots in Tonight/Explore, visually distinct | Pricing TBD | Mechanism shipped; unsold in beta |
| **Ticketing platform fee** | Stripe Connect destination charge, `application_fee_amount` | `PLATFORM_FEE_BPS` default **1000 (10%)**; Stripe ~2.9% + $0.30 borne by the venue | Scaffold, flag off |
| **Table reservations** | Deposit-backed requests | Fee TBD | Scaffold, flag off |
| **Creator commission** | 10% of linked ticket `price_cents`, last-touch, 30-day window | Payouts bi-weekly, **$25** minimum | Documented, flag off |
| **Venue analytics (paid tier)** | Subscription for benchmarking and flow analysis | Pricing TBD | Roadmap |

### 10.3 Payment policies

- **Refunds:** automatic and full at ≥ 24 h before `events.starts_at`; blocked for patrons inside
  24 h; venue staff may `force: true`. Platform fees are not currently refunded to patrons — an open
  policy follow-up.
- **Un-onboarded venues:** if a venue has no Connect account, the full charge lands on the platform
  and is reconciled out of band. A deliberate temporary fallback, to be removed once all active
  venues are onboarded.
- **Creator fraud kill switch:** disable `VITE_CREATOR_ECONOMY_ENABLED` immediately if a single
  creator's held balance exceeds $10k in 24 h, if global attributions exceed 100 in 10 minutes, or if
  any end-to-end self-referral is confirmed ([creator-fraud-playbook.md](./creator-fraud-playbook.md)).

**No monetization surface is enabled in the Seattle beta.** Charging before the signal is trusted
would trade the only asset the product has.

---

## 11. Non-functional requirements

### 11.1 Performance and SLOs

Full definitions and alert rules: [slos.md](./slos.md). Reviewed monthly.

| SLO | Target |
|-----|--------|
| Availability | **99.9%** non-5xx over 30 days (error budget 43m 49s/month) |
| `POST /api/pulses/create` p95 | **300 ms** |
| `POST /api/moderation/check` p95 | **400 ms** |
| `GET /api/pulses` p95 | **200 ms** |
| PostGIS proximity query p95 | **150 ms** |
| Core Web Vitals p75 | LCP **< 2.5 s**, INP **< 200 ms**, CLS **< 0.1** |
| Report creation success | **> 99%** (2xx and visible within 10 s) |
| Realtime delivery | p95 **< 2 s**, p99 **< 5 s** insert → client |
| Auth success | **> 99.5%** over 30 days |
| Moderation efficacy | **< 0.5%** post-publish takedown within 30 days |

Client budgets: LCP < 2.5 s on 4G in the launch city; PWA precache < 3 MB; per-chunk limits enforced
in CI ([bundle-budget.md](./bundle-budget.md)).

### 11.2 Reliability and degradation

| ID | Requirement |
|----|-------------|
| REL-01 | Realtime failure falls back to polling without a user-visible error |
| REL-02 | Writes performed offline are queued and replayed idempotently |
| REL-03 | Supabase unavailability degrades to cached read-only with an explicit staleness banner; `VITE_PULSE_READ_ONLY_MODE` disables writes during an incident |
| REL-04 | `ProductionConfigGuard` blocks a production build lacking Supabase credentials unless explicitly overridden |
| REL-05 | Every AI/paid dependency has a defined cap and a graceful 402/503 path (§7.3) |
| REL-06 | `/api/health` is externally monitored; rollback is a Vercel promote of the previous deployment |

Runbooks: [`docs/runbooks/`](./runbooks/). Drills: [chaos-drills.md](./chaos-drills.md).

### 11.3 Security and privacy

| ID | Requirement |
|----|-------------|
| SEC-01 | Every write endpoint requires a verified Supabase JWT; RLS is the final gate, never client trust |
| SEC-02 | `SUPABASE_SERVICE_ROLE_KEY` is server-only and used solely on paths that must bypass RLS |
| SEC-03 | Stripe webhooks verify signatures; ticket QR codes are HMAC-signed with a rotatable secret |
| SEC-04 | CSP and HSTS enabled; no secrets in `VITE_*` variables beyond publishable keys |
| SEC-05 | GDPR/CCPA export (`/api/account/export`) and delete (`/api/account/delete`) are user-initiated and complete |
| SEC-06 | Presence and location are minimized: bucketed counts, opt-out controls, no precise coordinates in analytics |
| SEC-07 | Safety location pings retained 30 days; sessions and audit 2 years |
| SEC-08 | Admin authorization is consistent and auditable |

> **Known delta (owner: Eng, launch-blocking for SEC-08).** Two admin models coexist — JWT
> `app_metadata.role === 'admin'` for most `/api/admin/*` routes, and a `SUPABASE_ADMIN_EMAILS`
> allowlist for `keys/generate` and `webhooks/sign`. Converge on one before launch.

### 11.4 Accessibility

Target: **WCAG 2.2 AA** on the golden path (Tonight, Map, venue detail, reporting). Audited under
P1-6; findings in [accessibility-audit.md](./accessibility-audit.md).

| ID | Requirement |
|----|-------------|
| A11Y-01 | Vibe selection is a labeled radiogroup, fully keyboard operable |
| A11Y-02 | Map pins expose accessible names carrying energy, confidence, and freshness |
| A11Y-03 | **No state is conveyed by color alone** — energy and confidence always carry text or shape |
| A11Y-04 | Signal and worth-going panels expose status summaries to screen readers |
| A11Y-05 | Touch targets ≥ 44 px; primary safety controls ≥ 56 px |
| A11Y-06 | High-contrast mode; motion respects `prefers-reduced-motion` |
| A11Y-07 | Skip link and landmark structure on every route |
| A11Y-08 | Lighthouse accessibility **≥ 0.95** in CI; VoiceOver and TalkBack smoke tests pass |

### 11.5 Internationalization

English-only at launch. An i18n scaffold exists (`src/lib/i18n.ts`); no user-facing locale switch and
no RTL support in v1.

---

## 12. Data model

Postgres on Supabase with PostGIS. 23 migrations from `20260322000000_initial_schema.sql` through
`20260725000000_vibe_vision_storage_and_usage.sql`. Reference: [database-schema.md](./database-schema.md).

### 12.1 Core entities

| Table | Purpose | Notable columns |
|-------|---------|-----------------|
| `profiles` | User identity extending `auth.users` | `username`, `credibility_score`, `friends[]`, `notification_settings` JSONB, `scout_tier`, soft-delete |
| `venues` | Catalog plus live intelligence | `geom` (PostGIS), `pulse_score`, `score_velocity`, `dress_code`, `cover_charge_cents`, `accessibility_features`, `indoor_outdoor`, `place_id`, `signal_suppressed` |
| `pulses` | Geo-anchored reports, 90-min TTL | `energy_rating`, `photos[]`, video metadata, `expires_at`, `credibility_weight`, soft-delete |
| `pulse_reactions` | Reactions (preferred model) | Composite PK; syncs to `pulses.reactions` JSONB |
| `check_ins` | Immutable visit records | Coordinates, `distance_from_venue_mi`, `source` |
| `presence` | Mutable at-venue state | `visibility`, `checked_in_at`, `left_at` |
| `follows` | User→user or user→venue | CHECK constraint: exactly one target |
| `notifications` | Durable in-app feed | `type`, optional entity FKs, `read` |

### 12.2 Signal and intelligence

`venue_live_reports` (wait/cover/music/crowd reports), `venue_live_aggregates` (30-min rollups
refreshed by trigger), `venue_wait_times` (`estimated_minutes`, `confidence`, `sample_size`),
`vibe_assess_daily` and `vibe_assess_events` (AI spend rollup and telemetry).

### 12.3 Operations and quality

`venue_claims`, `venue_data_reports` (with `proposed_fields`), `scout_applications`, `venue_staff`,
`push_tokens`, `video_reports`.

### 12.4 Flagged domains

Ticketing (`events`, `tickets`, `reservations`, `venue_payout_accounts`, `stripe_webhook_events`),
Safety (`emergency_contacts`, `safety_sessions`, `safety_pings`, `trusted_rides`,
`contact_verification_codes`, `safety_audit`), Concierge (`concierge_sessions`, `concierge_messages`,
`concierge_plans`), Creator (`creator_profiles`, `referral_codes`, `referral_attributions`,
`creator_payouts`, `creator_verification_requests`).

### 12.5 Server-side logic

Score authority lives in the database: `calculate_venue_pulse_score`,
`calculate_venue_score_velocity`, `refresh_venue_intelligence` (+ trigger on pulse writes),
`get_live_venue_intelligence`, `confidence_from_count`, `refresh_venue_live_aggregate` (+ trigger),
`toggle_pulse_reaction`, `energy_rating_score`, `calculate_distance`, `is_admin`,
`is_safety_responder`.

### 12.6 RLS posture

Public read on venues, non-deleted pulses, and live reports/aggregates. Owner-scoped CRUD on
profiles, pulses, check-ins, push tokens, and safety tables. Staff read on tickets and reservations
via venue join. Admin writes via JWT role. Service-role-only on `stripe_webhook_events` and referral
attribution. Realtime publication covers pulses, presence, venues, reactions, check-ins, follows,
notifications, and live reports/aggregates.

### 12.7 Storage

Single bucket `pulse-videos` (public read, owner-folder write via storage RLS, 50 MB limit) serving
pulse photos, Vibe Vision uploads, and video pulses.

### 12.8 Schema debt (owner: Eng)

1. Dual reaction tables — `reactions` (legacy) and `pulse_reactions` (preferred). Retire the former.
2. `venue_staff` role enum conflicts between migrations `…0003` and `…0007`.
3. `crew_id` exists on `pulses` and `check_ins` with no `crews` table or FK.
4. Creator economy, video feed, and legacy `/api/events` + `/api/pulses` handlers use in-memory
   stores despite tables existing. **These are not production data paths** and must be wired or
   removed before their flags are enabled.
5. `docs/database-schema.md` documents only through migration 16.

---

## 13. Admin and internal tools

Internal tooling is a launch requirement, not a nicety: without suppression and catalog review there
is no way to contain a bad-data incident.

| ID | Requirement | Surface |
|----|-------------|---------|
| ADM-01 | **Signal suppression** — remove a venue's signal without deleting the venue | `/admin/signal`, `POST /api/admin/signal-suppress` |
| ADM-02 | Scout application review | `/admin/signal`, `/api/admin/scout-applications` |
| ADM-03 | **Fresh-coverage monitor** — live view of the ≥ 70% < 90 min gate | `/api/admin/fresh-coverage`, Signal admin card |
| ADM-04 | **Expansion gate scoreboard** — weekly snapshots and consecutive-clear-week streak | `ExpansionGatesCard`, `src/lib/expansion-gates.ts` |
| ADM-05 | Venue claim review | `/api/admin/venue-claims` |
| ADM-06 | Catalog quality: completeness scores, duplicate detection, user data reports | `/admin/venues/*` |
| ADM-07 | Venue metadata editing | `/admin/venues/:id/metadata` |
| ADM-08 | Places enrichment backfill | `POST /api/integrations/places-enrich` (dry-run supported) |
| ADM-09 | Vibe Vision telemetry and batch QA | `/api/admin/vibe-vision`, `VibeVisionAdminCard` |
| ADM-10 | Content moderation queue | `/moderation` |

---

## 14. Extended engagement surfaces

Secondary surfaces. They must never compete with the golden path for attention, and none may
introduce a vanity ranking.

| ID | Surface | Priority | Requirement |
|----|---------|----------|-------------|
| EXT-01 | **Shareable shortlist** | P1 | `/shortlist?v=` encodes a venue set for group chat; recipients can vote without an account |
| EXT-02 | **Dashboard → Tonight handoff** | P1 | Personal dashboard links carry vibe intent via `buildTonightPath` |
| EXT-03 | Personal insights | P2 | Venues visited, energy contributed, activity patterns — private by default |
| EXT-04 | Achievements | P2 | Opt-in showcase; max 2 badges per card; no public leaderboard |
| EXT-05 | Crews | P2 | 2–8 person group check-ins; crew reports carry the 1.5× multiplier (§5.2) |
| EXT-06 | Events and RSVP | P2 | Venue-linked events with Going/Interested |
| EXT-07 | Neighborhood scores | P2 | Aggregate energy by neighborhood; "hottest right now" |
| EXT-08 | Playlists | P2 | Curated venue collections, shareable |
| EXT-09 | Challenges | P2 | Weekly exploration prompts |
| EXT-10 | Stories | P2 | 24-hour ephemeral venue highlights |
| EXT-11 | Integrations hub | P2 | Rideshare, Spotify, maps deep links; every action emits `integration_action` |
| EXT-12 | Deep links and OG | P0 | Venue and pulse URLs render share previews carrying energy and confidence |

---

## 15. Launch plan, geography, and expansion gates

### 15.1 Expansion gates

> **Do not expand geography until all five gates hold for 8 consecutive operating weeks.**

Constants live in code (`EXPANSION_GATE_TARGETS`, `EXPANSION_GATE_STREAK_WEEKS = 8`,
`src/lib/expansion-gates.ts`) so the product and the spec cannot drift.

| Gate | Target | Measurement |
|------|--------|-------------|
| Decision conversion | **≥ 35%** | §2.1, from §8.1 events |
| Fresh venue coverage | **≥ 70%** with evidence < 90 min | `/api/admin/fresh-coverage` |
| Week-4 retention | **≥ 25%** | Cohort analysis |
| Misleading signal rate | **< 10%** | `mismatch_reported` ÷ `arrival_confirmed` |
| Scout weekly participation | **≥ 50%** | Approved scouts with ≥ 1 verified report |

A single failed week resets the streak to zero. Weekly snapshots are recorded Monday for the prior
Thursday–Saturday week at `/admin/signal`; expansion is authorized only when the badge reads
**8/8 clear**. Full procedure: [EXPANSION_GATE_SCOREBOARD.md](./EXPANSION_GATE_SCOREBOARD.md).

### 15.2 Scout operations

| Tier | Weekly verified-report quota |
|------|----------------------------|
| Rookie (default on approval) | **3** |
| Regular | **7** |
| Lead | **14** |

Quotas are ceilings, not targets — they exist to keep one enthusiastic person from becoming the sole
source of truth for a neighborhood, which would make the signal look confident when it is really one
opinion. Advancement requires corroborated reports (SCT-04). Scout coverage is planned per
neighborhood against the fresh-coverage gate.

### 15.3 Launch phases

| Phase | Gate to enter | Scope |
|-------|--------------|-------|
| **Phase 1 — Internal** | Golden path complete | Staff only; venue shell in preview |
| **Phase 2 — Seattle beta** | All P0 done | Invite-only; 30 venues; guest browse on; monetization flags off |
| **Phase 3 — Closed pilot** | All P1 done | 5–10 operator portal pilot; Scout program live; alerts on |
| **Phase 4 — Public Seattle** | Launch checklist signed off | `VITE_LAUNCHED_CITIES=Seattle,WA`; public brand and store presence |
| **Phase 5 — Expansion** | 8/8 gates for 8 weeks | Next metro, same density discipline |

Phases 1–3 are complete (P0 12/12, P1 8/8). **Phase 4 is blocked on launch checklist sign-off**, not
on features.

### 15.4 Launch readiness gate

Full checklist: [LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md). Open blocking categories as of this
revision:

| Category | Outstanding |
|----------|-------------|
| Legal | Data-retention review; GDPR/CCPA export and delete staging QA; cookie/analytics disclosure |
| Security | Service-role key production-only; Stripe webhook verification; QR HMAC rotation; dependency audit; single admin auth model (§11.3) |
| Accessibility | Lighthouse ≥ 0.95; keyboard nav smoke; VoiceOver/TalkBack pass |
| Performance | LCP < 2.5 s on 4G in Seattle; precache < 3 MB; load test |
| Operations | On-call rotation; rollback drill; external `/api/health` ping; Sentry DSN; push credentials verified on device |
| Data | Supabase venue seed verified (`npm run smoke:supabase`); mobile QA in launch city |
| Config | `VITE_APP_MODE=venue` **and** `VITE_ALLOW_VENUE_SHELL=true` confirmed in production (§3.2) |

Required production env: see [prod-vercel-env.md](./prod-vercel-env.md) and
[environment-variables.md](./environment-variables.md).

```bash
VITE_APP_MODE=venue
VITE_ALLOW_VENUE_SHELL=true
VITE_LAUNCHED_CITIES=Seattle,WA
```

---

## 16. Trust, safety, and moderation

### 16.1 Architecture

Three layers, with a single rule: **the client is advisory, the server is authoritative, and RLS is
the final gate.** No write path trusts a client-side moderation result. Details:
[content-safety.md](./content-safety.md).

### 16.2 Detection and enforcement

Banned words and phrases; PII detection (email, phone); URL allowlist plus high-risk TLD blocking
(`.ru`, `.tk`, `.xyz`); spam heuristics; length limits.

| Severity | Action |
|----------|--------|
| Low | Warn, allow the write |
| Medium / High | Block the write |

### 16.3 Rate limits

| Action | Limit |
|--------|-------|
| Moderation check | 60 / min / user |
| Pulse create | 10 / hour / user |
| Reactions | 120 / hour / user |
| Vibe assess | 20 / hour / user, plus 50¢/day cost cap |
| Video publish | 3 / hour / user |
| Surge alerts | 20 / hour / user |
| Concierge chat | 5 / min / user |
| Safety contact verify | 5 / hour / user, 3 / hour / contact |

> **Known limitation (owner: Eng).** Rate limiting is in-memory per function instance
> (`api/_lib/rate-limit.ts`) and therefore not shared across regions. Effective limits are higher
> than stated under multi-region traffic. Move to a shared store before scale.

### 16.4 Abuse and integrity

Location-verified reporting (RPT-02) plus the 120-minute cooldown (RPT-03) plus new-account
credibility of 0.5 (§5.4) make score manipulation expensive. Sustained mismatch reports trigger
suppression review (ADM-01). Report-and-block flows and a moderation queue (ADM-10) cover
user-to-user harm. Video: three reports auto-hide; `minor_in_frame` hides on the first report pending
review.

### 16.5 Safety posture (flagged feature)

The Safety Kit is **not an emergency service and does not contact 911.** The panic action is "alert
my contacts" and requires a 3-second hold; contacts must be SMS-verified before they can receive
alerts. A legal disclaimer must appear on every alert-capable surface, and SMS must honor STOP.
`VITE_SAFETY_KIT_ENABLED` stays off in production until Trust & Safety sign-off and Twilio A2P 10DLC
registration are complete. Details: [safety-kit.md](./safety-kit.md).

---

## 17. Risks and mitigations

| # | Risk | Impact | Mitigation |
|---|------|--------|------------|
| 1 | **Cold-start density** — too few reports to be useful | Fatal | Narrow launch (§3.1); Scout program (§6.7); operator status (§6.8); honest empty states; fresh-coverage gate blocks expansion |
| 2 | **One bad recommendation destroys trust** | High | Confidence-gated inclusion (REC-03) and alerts (ALR-01); misleading-signal gate < 10%; suppression lever |
| 3 | **Score manipulation** by venues or promoters | High | Location verification; cooldowns; credibility floor of 0.5; suppression; structural sponsorship separation (§10.1) |
| 4 | **Weekend-only usage** caps retention | Medium | Alerts and shortlists create weekday touchpoints; daytime categories deferred until §9.3 normalization is enabled |
| 5 | **Shipping the wrong shell** — production serves Signal instead of the venue PWA | High | `VITE_ALLOW_VENUE_SHELL` verified in the launch checklist (§15.4); resolve §3.2 open decision |
| 6 | **In-memory stubs reaching production** (creators, video, legacy events/pulses) | High | Flags off; wire-or-remove before enabling (§12.8) |
| 7 | **Rate limits not shared across regions** | Medium | Documented (§16.3); shared store before scale |
| 8 | **AI cost runaway** (Vibe Vision, concierge) | Medium | Per-user daily cap 50¢; concierge session cap 20¢; 402 on cap; telemetry tables |
| 9 | **Video egress cost** at scale | Medium | Feature flagged; CDN caching first, low-bitrate variant second ([storage-costs.md](./storage-costs.md)) |
| 10 | **Privacy backlash** over presence | High | ≥ 2 person threshold; bucketed counts; global and per-venue opt-out; no precise coordinates in analytics |
| 11 | **Doc/code drift** in scoring constants | Medium | Versioned signal model; deltas tracked in Appendix C; constants live in code and are cited here |
| 12 | Realtime or Supabase outage during peak Friday window | High | Polling fallback; read-only mode; runbooks; surge-traffic drill |

---

## 18. Acceptance criteria and test mapping

### 18.1 Definition of done for v1

1. Every P0 and P1 requirement in §6 and §7 passes its stated acceptance criteria.
2. Each of the eleven §8.1 events has a verified call site on the golden path.
3. No surface displays an energy state that its confidence cannot support.
4. Sponsorship cannot alter organic ranking, proven by test.
5. Golden path meets WCAG 2.2 AA and Lighthouse accessibility ≥ 0.95.
6. §11.1 SLOs are instrumented and alerting.
7. All §15.4 launch checklist rows are signed off.
8. Every flagged surface in §19 is confirmed off in production.

### 18.2 Automated coverage

| Area | Coverage |
|------|----------|
| Tonight feed and ranking | `tonight-feed`, `venue-recommendations` unit tests |
| Signal engine | `venue-signal` (confidence, freshness, trend, suppression) |
| Scoring and credibility | `pulse-engine`, `credibility`, `venue-trending` |
| Decision explanations | `decision-explanations` |
| Conversion analytics | `decision-analytics` event emission |
| Expansion gates | `expansion-gates` (evaluation, streak counting) |
| Fresh coverage | `fresh-coverage` client + `api/_lib/fresh-coverage` |
| Sponsorship integrity | `sponsorship-integrity` — organic rank unaffected |
| Seattle seed | Fixture and seed generation checks |
| Arrival and worth-going | `arrival-prompt`, worth-going panel tests |
| Map badges and parity | Signal badge component tests |
| Energy reporting | `EnergyReportSheet` component tests |
| Guest browse | `guest-browse` + auth gate |
| Write API auth | `api/_lib/__tests__/write-api-auth.test.ts` |
| Admin auth | `admin-auth.test.ts` |
| Moderation | `api/_lib/moderation` |
| Vibe Vision | `vibe-vision`, `vibe-assess-cost` |
| Ticketing and payments | `ticket-verify`, `purchase`, `stripe` webhook |
| Safety and push | `notify`, `push`, `dispatch-notification` |
| E2E | Playwright specs in `e2e/`, plus `npm run smoke:supabase` |

**Coverage gap (owner: Eng):** API route handlers are thinly covered relative to `api/_lib` units —
notably safety session routes, `concierge/chat`, `vibe/assess`, and `push/register` have no
handler-level tests.

### 18.3 Release gates

Every PR: lint, type-check, unit tests, bundle budget ([ci-gates.md](./ci-gates.md)). Every release:
Playwright golden path, Lighthouse, Supabase smoke. Manual before each Thursday peak: golden-path bug
bash in the launch city.

---

## 19. Flagged feature portfolio

Built or scaffolded, **off in production**, each with its own spec and gate. None is in the critical
path for Seattle launch.

| Feature | Flag | State | Gate to enable |
|---------|------|-------|----------------|
| [Reservations & ticketing](./prd/reservations-ticketing.md) | `VITE_TICKETING_ENABLED` | Scaffold complete; Stripe Connect wired | Venue demand + Stripe production verification + refund policy sign-off |
| [Safety Kit](./prd/safety-kit.md) | `VITE_SAFETY_KIT_ENABLED` | v1 scaffold; Twilio + cron ready | T&S sign-off + A2P 10DLC + panic drill (SMS ≤ 2 min) |
| [AI Concierge](./prd/ai-concierge.md) | `VITE_AI_CONCIERGE_ENABLED` | API + tools shipped; **chat UI not mounted** | Plan acceptance ≥ 35%, cost ≤ 8¢/session avg, P95 TTFT ≤ 1.5 s held 14 days |
| [Video feed](./prd/video-feed.md) | `VITE_VIDEO_FEED_ENABLED` | Components + API exist; **no route; in-memory store** | Supabase wiring + CDN cost plan + moderation capacity |
| [Creator economy](./prd/creator-economy.md) | `VITE_CREATOR_ECONOMY_ENABLED` | Documented; **in-memory store** | Ticketing live + fraud controls proven |
| [Native apps](./prd/native-apps.md) | — | M0 Capacitor scaffold | Store accounts + TestFlight; iOS ≤ 40 MB, Android ≤ 30 MB |
| Integrations hub | `VITE_FF_ENABLE_INTEGRATIONS` | On; deep links only | — |
| Weather / wait time / accessibility filter | `VITE_WEATHER_BOOST_ENABLED`, `VITE_WAIT_TIME_ENABLED`, `VITE_ACCESSIBILITY_FILTER_ENABLED` | **Shipped, on** | — |
| Vibe Vision | `VITE_VIBE_VISION_ENABLED` | Shipped behind flag | Cost telemetry review at §7.3 caps |

Flag reference: [feature-flags.md](./feature-flags.md).

**Build-complete but unmounted** (real code, no user path — do not describe as shipped): concierge
chat sheet and button, video feed route, most Safety Kit UI beyond the contacts page, ticket purchase
sheet.

---

## 20. Roadmap and operating cadence

### 20.1–20.9 Delivery themes

| # | Theme | Status |
|---|-------|--------|
| 20.1 | Golden path — Tonight, map parity, worth-going, reporting | **Done** (P0) |
| 20.2 | Decision analytics and north-star instrumentation | **Done** (P0) |
| 20.3 | Seattle inventory and geo-gating | **Done** (P0) |
| 20.4 | Versioned signal engine | **Done** (P0) |
| 20.5 | Scout program, alerts, energy timeline, operator portal, shortlist, WCAG audit | **Done** (P1) |
| 20.6 | Catalog quality — completeness, dedupe, claims, data reports | **Done** |
| 20.7 | Public launch readiness — legal, perf, ops, a11y sign-off | **In progress** (§15.4) |
| 20.8 | Wire-or-remove in-memory stubs; converge admin auth; retire duplicate reaction table | **Next** (§12.8) |
| 20.9 | Flagged portfolio graduation, one feature at a time against its own gate | Queued (§19) |

### 20.10 Weekly operating cadence

The rhythm that enforces §15.1. Expansion is a measurement outcome, never a decision made in a
meeting.

| When | Activity |
|------|----------|
| **Monday** | Record the prior Thu–Sat week into the expansion gate scoreboard; review the streak count |
| **Monday** | Retention and conversion stand-up against §2.2 targets |
| **Tuesday** | 2–5 user interviews; feed findings into copy and ranking |
| **Wednesday** | One growth or ranking experiment defined with a single success metric |
| **Thursday (pre-peak)** | Golden-path bug bash in the launch city on real devices |
| **Fri–Sat (peak)** | Live monitoring: fresh coverage, report latency, error rate, Sentry |
| **Sunday** | Triage mismatch reports; open suppression reviews where warranted |
| **Monthly** | SLO review ([slos.md](./slos.md)); dependency and secret rotation audit |
| **Quarterly** | Signal model review — bump `VENUE_SIGNAL_MODEL_VERSION` for any threshold change |

**Expansion decision rule:** when the scoreboard shows 8/8 clear weeks, open the next metro with the
same 25–40 venue, 3–5 neighborhood discipline. Until then, deepen Seattle.

### 20.11 Beyond expansion

Post-gate candidates, in rough priority order: predictive surge ("expected to peak at 10pm"), daytime
categories with §9.3 normalization enabled, group matching, paid venue analytics, public data API,
and the §19 portfolio as each earns its gate.

---

## Appendix A — Glossary of product terms

| Term | Definition |
|------|-----------|
| **Pulse** | A single geo-verified energy report; lives 90 minutes |
| **Pulse score** | Venue energy 0–100 computed per §5.2 |
| **Energy state** | Dead / Chill / Buzzing / Electric |
| **Confidence** | Evidence strength behind a signal: High / Medium / Low / None |
| **Freshness** | Age of the newest evidence, with staged degradation labels |
| **Trend** | Rising / steady / fading over the report window |
| **Worth going** | Composite verdict: yes / maybe / caution / unknown |
| **Fresh coverage** | Share of venues with evidence < 90 minutes old |
| **Decision action** | Go, directions, save, share, or arrival confirmation |
| **Decision Conversion Rate** | North-star metric (§2.1) |
| **Misleading signal rate** | Mismatch reports over arrival prompts answered |
| **Scout** | Approved high-trust contributor with a weekly quota |
| **Suppression** | Admin removal of a venue's signal without deleting the venue |
| **Signal model version** | Versioned confidence/decay configuration (`1.0.0`) |
| **Credibility weight** | 0.5–2.0 multiplier on a contributor's report influence |

Extended engineering glossary: [glossary.md](./glossary.md).

## Appendix B — Document map

| Document | Role |
|----------|------|
| **This file** | Canonical product specification |
| [SEATTLE_BETA_BACKLOG.md](./SEATTLE_BETA_BACKLOG.md) | Delivery tracking against §14–§18 |
| [EXPANSION_GATE_SCOREBOARD.md](./EXPANSION_GATE_SCOREBOARD.md) | Weekly §15.1 gate procedure |
| [LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md) | §15.4 sign-off |
| [`docs/prd/`](./prd/) | Satellite specs for flagged features (§19) |
| [scoring-algorithm.md](./scoring-algorithm.md) | §5 implementation detail |
| [slos.md](./slos.md) | §11.1 targets and alerts |
| [content-safety.md](./content-safety.md) | §16 enforcement detail |
| [differentiators.md](./differentiators.md) | §9.4–§9.5 and metadata pack |
| [../PRD.md](../PRD.md) | Legacy prototype spec — historical only |
| [VENTURE_NEXT_STEPS.md](./VENTURE_NEXT_STEPS.md) | Pulse Signal research track (§3.2) |

## Appendix C — Open decisions and known deltas

Tracked here so the spec is honest about where it diverges from the code.

| # | Item | Type | Owner | Reference |
|---|------|------|-------|-----------|
| C1 | Public brand: venue PWA vs Pulse Signal | Open decision | Product | §3.2 |
| C2 | Energy values 0–3 in code vs 1–4 in `scoring-algorithm.md` | Doc/code delta | Eng | §5.2 |
| C3 | Spam credibility reduction documented but not implemented | Doc/code delta | Eng | §5.4 |
| C4 | Two admin authorization models — **launch-blocking** | Security delta | Eng | §11.3 |
| C5 | In-memory stores for creators, video, legacy events/pulses | Implementation debt | Eng | §12.8 |
| C6 | Rate limits not shared across regions | Known limitation | Eng | §16.3 |
| C7 | `realtime_delivery_latency_ms` missing from the event union; SIG-02 unmeasurable | Instrumentation gap | Eng | §8.4 |
| C8 | Time-contextual score computed but not used in Tonight ranking | Deliberate deferral | Product | §9.3 |
| C9 | Duplicate reaction tables; `venue_staff` enum conflict; orphan `crew_id` | Schema debt | Eng | §12.8 |
| C10 | `docs/routing.md` and `docs/api-reference.md` stale vs code | Doc debt | Eng | Appendix B |
| C11 | `TWILIO_FROM` (code) vs `TWILIO_FROM_NUMBER` (docs) | Config delta | Eng | §16.5 |
| C12 | Platform fees not refunded to patrons on cancellation | Open policy | Product | §10.3 |
| C13 | API route handler test coverage gap | Test gap | Eng | §18.2 |
