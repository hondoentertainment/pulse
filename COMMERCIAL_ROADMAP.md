# Pulse — Commercial Viability & Fundability Roadmap

> The path from advanced prototype to a venture-fundable company. This document covers the
> business side: market entry, traction, monetization, and fundraise readiness. For the
> engineering work it depends on, see [PRODUCTION_ROLLOUT.md](PRODUCTION_ROLLOUT.md) and
> [NEXT_PHASES.md](NEXT_PHASES.md).

---

## Honest Starting Point

**What Pulse has today:**

- A broad, polished feature surface (~60k lines of TypeScript, 470+ tests, CI, PWA, native shells)
- A differentiated product thesis: real-time, decaying venue energy — answering *"where is it good right now?"*, which Google Maps, Yelp, and Foursquare structurally do not answer
- Identified revenue surfaces already designed in the PRD: venue analytics SaaS, promoted placements, data API, white-label

**What Pulse does not have yet:**

- Real users, real venues, or real pulse data (mock datasets + Spark KV)
- Backend persistence, auth, or server-enforced security
- A legal entity, any revenue, or any market validation

**Implication:** Investors do not fund feature lists; they fund evidence. Everything below is
sequenced to produce evidence — first that people use it, then that they come back, then that
someone pays.

---

## What "Fundable" Means for Pulse

This is a consumer social/local app with a B2B SaaS revenue layer. The fundraising bar for
this category (2026 conditions):

| Round | What must be true | Typical raise |
|-------|-------------------|---------------|
| **Pre-seed** | Live product in one market, early engagement signal (hundreds of WAU, visible retention curve), credible founding team, a wedge story | $250k–$1M (SAFEs) |
| **Seed** | Density in one city: ~5–10k WAU, D30 retention ≥ 20%, organic/viral growth loop working, first venue revenue ($5–20k MRR or strong pilot LOIs) | $1.5M–$4M |
| **Series A** | Repeatable city playbook (market #2 and #3 launched cheaper/faster than #1), $50k+ MRR or breakout consumer growth, clear unit economics | $8M+ |

The single most important number for Pulse is **density-adjusted retention**: in the launch
neighborhood, what % of users who pulse in week 1 are still pulsing in week 4? A hyperlocal
network is worthless thin and everywhere; it is fundable thick and somewhere.

---

## Phase A — Make It Real (Months 0–3)

**Goal:** A production app a stranger can sign up for and use, in one launch market.
**This phase is gated almost entirely on engineering**, tracked in
[PRODUCTION_ROLLOUT.md](PRODUCTION_ROLLOUT.md) Phases 0–1.

### Engineering (the fundable subset, not everything)

Ruthlessly scope to the *minimum lovable loop*: open app → see nearby venues ranked by live
energy → check in / pulse → score moves → friends see it. Defer or feature-flag everything
else (creator dashboards, white-label, playlists, 3D, AI concierge).

- [ ] Supabase auth, durable persistence, RLS — no mock users, no Spark KV for core data
- [ ] Real venue dataset for the launch market only (seeded from Google Places/Foursquare OSS
      data, manually verified for the launch neighborhoods)
- [ ] Server-side geocoding, rate limiting, content moderation
- [ ] App Store / Play Store builds via the existing Capacitor shells (PWA-only kills
      consumer social adoption; the install must be native)
- [ ] Analytics instrumentation for the funnel that investors will ask about:
      signup → first pulse → D1 / D7 / D30 return → invite sent

### Business

- [ ] **Incorporate** (Delaware C-corp), IP assignment from all contributors, standard SAFE
      paperwork ready
- [ ] **Pick the launch market**: one city, and within it 2–3 walkable nightlife districts
      (e.g., a single entertainment district in a mid-size city beats all of NYC). Criteria:
      dense venues, young population, founders can physically be there weekly
- [ ] Privacy policy + ToS, age gating (nightlife + location data: 18+ minimum, alcohol-venue
      content considerations), GDPR/CCPA deletion path
- [ ] Name/trademark search ("Pulse" is crowded — verify or pick a defensible mark now, before
      it's expensive)

### Exit criteria

Real app in stores, real venues in one market, zero mock data in the core loop, company exists.

---

## Phase B — Solve Cold Start in One Market (Months 3–6)

**Goal:** Liveness without users. This is the existential risk for Pulse and the phase most
plans hand-wave. An empty real-time app is dead on arrival — the map must look alive on day one.

### Supply-side liveness (before users arrive)

- [ ] **Seeded baseline scores**: derive a synthetic-but-honest "expected energy" per venue
      from hours, day-of-week, category, and event calendars — clearly styled as *forecast*
      vs. *live confirmed*. The existing scoring engine already supports this
- [ ] **Social signal ingestion** for the launch market (the `social-pulse` /
      twitter-ingestion prototypes, productionized for one city): venue mentions, geotagged
      posts, event listings → background energy signal
- [ ] **Venue-side input**: free lightweight dashboard for 20–50 launch venues — let staff
      post "tonight: live DJ, busy" — which doubles as the B2B relationship for Phase D

### Demand-side launch playbook

- [ ] Recruit 10–20 paid/comped **campus & nightlife ambassadors** who pulse every weekend
- [ ] Launch-night events with partner venues (drink specials gated on "show your pulse")
- [ ] Crew feature as the viral loop: invites are *useful* ("where is everyone tonight?"),
      not vanity. Instrument K-factor on crew invites
- [ ] Weekly cadence: founders physically in the district every Fri/Sat collecting feedback

### Metrics that matter this phase

| Metric | Honest target by Month 6 |
|--------|--------------------------|
| WAU in launch district | 500–1,500 |
| % of district venues with ≥1 pulse on a Fri/Sat night | ≥ 60% |
| W4 retention of W1 pulsers | ≥ 15% (signal), ≥ 25% (strong) |
| Crew invite → activated user conversion | ≥ 20% |

### Exit criteria

A stranger opening the app at 10pm Saturday in the launch district sees a genuinely live,
accurate map. That demo *is* the pre-seed pitch.

> **Pre-seed raise window opens here.** Raise on: live single-market product + early retention
> curve + the cold-start playbook working. $250k–$750k buys 12 months to hit seed metrics.

---

## Phase C — Prove Retention & the Growth Loop (Months 6–12)

**Goal:** Turn launch-market liveness into a habit and a measurable organic loop.

- [ ] **Retention engineering**: surge notifications ("3 friends are at Capitol Hill venues
      right now"), weekly personal recap, streaks/achievements — all already built, now tuned
      against real cohort data
- [ ] **Expand within the city** (adjacent districts) before any second city — density first
- [ ] Systematize the ambassador playbook into a repeatable per-district launch kit
- [ ] Begin **venue pilot program** (bridge to Phase D): 10–15 venues on the free dashboard,
      structured monthly feedback, collect written LOIs for a paid tier
- [ ] Press/social moment: city "energy index" content (weekly "hottest block in [city]"
      rankings) — cheap, shareable, data Pulse uniquely owns

### Metrics that matter this phase

| Metric | Seed-ready target |
|--------|-------------------|
| WAU (one city) | 5,000–10,000 |
| D30 retention | ≥ 20% |
| Organic share of new signups | ≥ 50% |
| Fri/Sat venue coverage (city core) | ≥ 75% |
| Venues actively using free dashboard | 25+ |
| Paid-tier LOIs | 10+ |

---

## Phase D — Monetization Validation (Months 9–15, overlaps C)

**Goal:** First real revenue, proving the B2B layer without taxing the consumer experience.

Priority order (deliberately different from the PRD's feature order):

1. **Venue Analytics Pro** (SaaS, $99–$299/mo): live + historical energy, peak-hour analysis,
   competitor benchmarking, surge alerts to staff. Sell it founder-led to the pilot venues.
   *This is the fundable revenue line* — SaaS revenue is legible to investors in a way
   consumer ads are not.
2. **Promoted placement / venue boost**: pay to surface during slow hours, clearly labeled,
   priced per check-in. Only after consumer trust is established — never let paid placement
   corrupt the live score itself (this is the product's core integrity asset).
3. **Data API** (the existing `public-api` prototype, server-side): venue energy data for
   ride-share, event, and hospitality apps. Pursue opportunistically; don't staff it yet.

Defer: white-label, campus/corporate editions, creator economy — real options, wrong stage.

### Metrics that matter

| Metric | Target |
|--------|--------|
| Paying venues | 15–30 |
| MRR | $5k–$15k |
| Venue logo churn (monthly) | < 5% |
| Net revenue retention on venue accounts | > 100% |

> **Seed raise window: Months 12–15**, on Phase C consumer metrics + Phase D revenue signal.

---

## Phase E — The Repeatable City Playbook (Months 15–24, post-seed)

**Goal:** Prove Pulse is a *company*, not a single-city project.

- [ ] Launch cities #2 and #3 using the documented playbook; target < 50% of city #1's cost
      and < 50% of its time-to-liveness
- [ ] Hire: 1–2 engineers, 1 city-launch/growth lead, fractional finance
- [ ] Self-serve venue dashboard onboarding (remove founder-led sales bottleneck)
- [ ] Predictive surge engine (PRD 6.1) as the data moat: forecasts only Pulse's historical
      pulse corpus can power
- [ ] Series A narrative: "every city we enter reaches liveness in N weeks for $X, and venues
      pay us $Y/city/month"

---

## Business Model Summary

| Stream | Customer | Pricing | Stage |
|--------|----------|---------|-------|
| Venue Analytics Pro | Venue owners/managers | $99–$299/mo SaaS | Phase D — primary |
| Promoted placement / boost | Venues | Per check-in / flat slow-hour boost | Phase D — secondary |
| Energy Data API | Ride-share, events, hospitality apps | Usage-tiered | Phase E |
| White-label (festivals, campuses, districts) | Enterprises | Contract | Post-A |

Consumer app stays free. The consumers *are* the sensor network; charging them shrinks the
data asset that makes the B2B layer valuable.

### Unit economics to track from day one

- **Consumer CAC** (blended, then paid-only) vs. organic % — target blended CAC < $3 by seed
- **Venue CAC vs. LTV** — founder-led sales cost vs. $1,200–$3,600/yr contract value;
  target LTV:CAC > 3 before hiring sales
- **Cost per live city** — infra + ambassador + launch spend; this number is the Series A story

---

## Top Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Cold start / empty-app death** | Existential | Phase B is entirely about this: forecast scores, social ingestion, venue-side input, district-level (not city-level) launch |
| **Density never compounds** (retention < 10% even with liveness) | Existential | Kill/pivot criteria defined up front: if W4 retention < 10% after 2 quarters of iteration, the thesis is wrong — pivot to B2B-only venue intelligence |
| **Google/Foursquare ship "busy now" better** | High | They show *popularity*; Pulse shows *energy + social presence* (friends, crews). Moat = community + proprietary pulse corpus, not the map |
| **Location privacy backlash / regulation** | High | Ephemeral-by-design (90-min decay) is a marketing asset; no background tracking; aggressive data minimization; GDPR/CCPA from day one |
| **Nightlife seasonality & sparsity** | Medium | Launch-market choice (year-round nightlife climate); expand category beyond bars (late-night food, events) once core loop proven |
| **Single-founder / team risk** | High (investor view) | Recruit a complementary co-founder or founding engineer before pre-seed; investors fund teams in this category |
| **App-store rejection of alcohol-adjacent UGC** | Medium | Age gating, server-side moderation (already specced in [docs/content-safety.md](docs/content-safety.md)), no alcohol promotion in UGC guidelines |

---

## Fundraise Preparation Checklist

### Pre-seed (prepare during Phase B)

- [ ] 10–12 slide deck: problem, live demo, cold-start playbook, early retention curve, market
      ($36B+ US nightlife; wedge = one district), team, ask & use of funds
- [ ] Live demo *at night, in market* — the Saturday 10pm map is the pitch
- [ ] Clean cap table, IP assigned, standard SAFE
- [ ] Data room v1: metrics dashboard (real, queryable — not screenshots), incorporation docs,
      product roadmap

### Seed (prepare during Phases C–D)

- [ ] Cohort retention curves by signup month, flat or smiling
- [ ] City P&L: what one live city costs and earns
- [ ] Venue revenue evidence: signed contracts, MRR, churn, pipeline
- [ ] Growth-loop math: K-factor, organic %, payback period
- [ ] Competitive teardown vs. Google "popular times", BeReal-style social, Partiful/Posh,
      Foursquare/Swarm — and why each structurally can't do live energy + social presence
- [ ] 18-month plan to Series A metrics with the seed capital

---

## Sequenced Timeline (single view)

```
Month:  0    3    6    9    12   15   18   24
        |----|----|----|----|----|----|----|
Eng     [A: real backend, stores]
Market       [B: cold start, 1 district]
Growth            [C: retention, city density        ]
Revenue                [D: venue SaaS, first MRR     ]
Scale                            [E: cities #2–3, hiring]
Raise        pre-seed^           seed^          (A prep)
```

**The one-sentence version:** strip to the core loop, make it real in one nightlife district,
prove people come back, get 20 venues paying, then raise on the playbook.

---

## Related Documentation

- [PRD.md](PRD.md) — product scope, feature phases, monetization concepts
- [PRODUCTION_ROLLOUT.md](PRODUCTION_ROLLOUT.md) — engineering rollout phases (gates Phase A)
- [NEXT_PHASES.md](NEXT_PHASES.md) — codebase work plan
- [RECOMMENDED_NEXT_STEPS.md](RECOMMENDED_NEXT_STEPS.md) — immediate technical priorities
- [docs/differentiators.md](docs/differentiators.md) — competitive positioning
- [docs/payments.md](docs/payments.md) — payments groundwork
- [SECURITY.md](SECURITY.md) — security posture
