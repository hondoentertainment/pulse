# Pulse — Recommended Next Steps (Twitter-class bar)

> Updated 2026-09-15. **Pulse is venue + map only** (Signal removed; no `VITE_APP_MODE`).
> Production: https://pulse-chi-nine.vercel.app/ · Catalog: 533 Seattle venues.
> Detail maps: [docs/next-steps.md](docs/next-steps.md) · Claims ops: [docs/runbooks/venue-claims-ops.md](docs/runbooks/venue-claims-ops.md).

## What “Twitter-class” means here

Not “become Twitter.” It means matching the **product bar** that made Twitter feel world-class:

| Pillar | Twitter move | Pulse equivalent |
|--------|--------------|------------------|
| **Habit open** | Open for the timeline | Open every night for *Tonight · what’s live near me* |
| **Realtime feel** | Posts appear instantly | Live review → map / Surging update without refresh |
| **Trust at scale** | Verified + anti-spam | Location-verified pulses, claim/inbox, report triage |
| **Distribution** | Quote / share / follow | Share OG, I’m-here, follow venue, crew tonight |
| **Return triggers** | Push + badges | Venue-surge push when a followed spot goes Electric |
| **Feed quality** | For You ranking | Tonight / For You ranking that feels right in &lt;1s |
| **Perf** | Snappy on mid phones | Cold start `pulse_map_interactive` ≲ 2s |
| **Ops truth** | Metrics or it didn’t happen | Funnel + realtime SLO dashboards actually wired |

Pulse already has most of these **in-repo**. The gap to world-class is **prove the loop on prod**, then **tighten the habit → return → trust flywheel** until Seattle feels inevitable.

---

## Intake summary

| Track | Focus | Who |
|-------|-------|-----|
| 0 — Foundation | Prod truth: env, live loop, claim, share, protection | Human admin |
| 1 — Habit | Nightly open feels magical + measurable | Agent + human |
| 2 — Return | Push + notifications that bring people back | Human keys + agent |
| 3 — Trust | Supply-side owners + anti-gaming | Agent + human |
| 4 — Growth | Viral share → install → first pulse | Agent + human |
| 5 — Scale polish | Perf, a11y, city #2 readiness | Later |
| Parked | Explicitly not Twitter-clone scope | — |

**Recommended next action:** Finish Track 0 on production (especially #64 live loop + #85/#86 proof), then ship **WC-1 Tonight habit ranking + funnel wiring** so every open has a measurable “Twitter timeline” moment.

### Assumptions
- No active production incident.
- #105 next-15 usage stack is on `main`; open issues remaining: **#85**, **#86** (prod proof).
- Solo maintainer still owns Vercel / Supabase / GitHub admin.
- “Twitter-class” is a quality bar, not a feature request to add a global public text feed.

---

## Scorecard (honest)

| Pillar | In-repo | Prod-proven | Gap to world-class |
|--------|---------|-------------|--------------------|
| Live review → map realtime | Yes | **Unproven** (#64) | One signed-in prod walkthrough |
| Claim → owner inbox | Yes | **Unproven** (#85) | Domain verify or `/ops` on real venue |
| Share OG + I’m-here | Yes | **Unproven** (#86) | Phone + crawler |
| Guest → first pulse funnel | Events defined | Adapter often **no-op** in prod | Wire PostHog/Amplitude + dashboard |
| Venue-surge push | Stub + VAPID no-op | Keys usually **missing** | Generate VAPID; prove one surge notify |
| Tonight / For You ranking | Surfaces exist | Feels early | Rank freshness + friends + distance; A/B |
| Cold start &lt;2s | Marks exist | Not measured on mid phone | Device budget + Launch 33 default |
| Trust / anti-spam | Credibility + reports | Soft | Weight verified location in ranking; mod SLA |
| Crew / social graph | Components exist | Density unknown | Invite + follow loops in one hood first |

---

## Prioritized queue

### Track 0 — Foundation (do before calling anything “world-class”)

1. **[WC-0.1 / #64] Prove the live loop on production** — P0 | Effort: S–M | Impact: Critical  
   - Why now: Without a real signed-in review updating Live now + map/Surging, every other pillar is theater.  
   - Acceptance:
     - [ ] Vercel prod has `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` (rebuild after set)
     - [ ] Do **not** set `VITE_APP_MODE`
     - [ ] Sign in → post live review → Live now + map/Surging update **without refresh**
   - Verification: Manual prod walkthrough; close remaining #64 boxes

2. **[WC-0.2 / #85] Prove claim → verified → owner inbox** — P0 | Effort: M | Impact: Trust  
   - Why now: Twitter-class products have a supply side that can respond. Owners without inbox = dead social graph.  
   - Acceptance: pending visible; pending does **not** unlock; verified/domain unlocks reply/dismiss; guest blocked  
   - Runbook: [docs/runbooks/venue-claims-ops.md](docs/runbooks/venue-claims-ops.md)

3. **[WC-0.3 / #86] Prove share OG + I’m-here on a real device** — P0 | Effort: S | Impact: Growth  
   - Why now: Distribution is how Twitter scaled; OG + deep link is Pulse’s quote-tweet.  
   - Acceptance: iMessage/Slack crawl shows name + freshness; I’m-here focuses pin; guest can view; write → `/auth`

4. **[WC-0.4 / #65] Branch protection for solo maintainer** — P1 | Effort: S | Impact: Velocity  
   - Required: `smoke-preview` / `smoke-preview-venue`; remove Signal checks; reviews = 0 or admin bypass  
   - Runbook: [docs/runbooks/github-branch-protection.md](docs/runbooks/github-branch-protection.md)

5. **[WC-0.5] Wire analytics backend (not console no-op)** — P1 | Effort: S | Impact: Critical  
   - Why now: Twitter-class teams manage to metrics. Funnel events exist (`guest_map_view` → `first_pulse_create`) but prod adapter is often unset → silent no-op.  
   - Acceptance:
     - [ ] `VITE_ANALYTICS_BACKEND=posthog` (or amplitude) + API key on Vercel
     - [ ] Dashboard shows guest→auth→first pulse for last 7 days
   - Verification: Post one guest session + one first pulse; events appear in provider within 5 minutes

### Track 1 — Habit open (the “timeline” moment)

6. **[WC-1] Tonight habit surface v1** — P1 | Effort: M | Impact: High  
   - Problem: Opening Pulse must answer “where do I go in the next hour?” in one screen — Twitter’s timeline equivalent.  
   - Scope in: rank Start here / Heating up from **live energy + distance + time-of-day + followed venues**; empty Surging teaches the loop; Launch 33 default  
   - Scope out: second city, video, paid boost  
   - Acceptance:
     - [ ] Cold open `/` shows `Tonight · {hood}` + ≤8 ranked cards in &lt;1s after map interactive
     - [ ] Followed venues that pulsed in 90m float to top when nearby
     - [ ] Empty state CTA posts a live review (auth gate if guest)
   - Verification: Playwright smoke + 10-person Seattle dogfood for 3 nights; qualitative “I opened it before leaving”

7. **[WC-2] Realtime latency SLO** — P1 | Effort: M | Impact: High  
   - Problem: Twitter feels instant; a 10s map lag kills trust.  
   - Acceptance:
     - [ ] Client metric: `pulse_created` → local map/Surging reflection p95 &lt; 2s on wifi
     - [ ] Alert when realtime channel errors &gt; 1% of sessions (Sentry)
   - Verification: Synthetic post in staging/prod; dashboard panel

### Track 2 — Return triggers (why they come back)

8. **[WC-3] Venue-surge Web Push (new issue, not Signal #66)** — P1 | Effort: M | Impact: High  
   - Why now: Twitter’s badge/push is the return loop. Pulse needs “Neumos just went Electric” while the night is young.  
   - Dependencies: WC-0.1; generate VAPID trio on Vercel (`VAPID_*`, `VITE_VAPID_PUBLIC_KEY`); missing keys stay honest no-op  
   - Acceptance:
     - [ ] Following a venue + granting push → one notification when venue crosses Electric (rate-limited ≤1/venue/2h)
     - [ ] Prefs: mute per venue; quiet hours
   - Verification: Two devices; follow → trigger surge (or staging inject) → notify received  
   - Note: Do **not** revive Signal push (#66). Open a **new** venue-surge push issue.

9. **[WC-4] In-app notification quality** — P2 | Effort: M | Impact: Medium  
   - Group surges, friend pulses, owner replies; deep link to venue/inbox; unread badge on You tab  
   - Acceptance: tapping a notify lands on the right venue with highlight; no duplicate storms

### Track 3 — Trust & supply (anti-spam + owners)

10. **[WC-5] Location-verified weight in ranking** — P1 | Effort: M | Impact: High  
    - Problem: Twitter-class feeds punish low-trust noise. Unverified remote pulses must not dominate Tonight.  
    - Acceptance:
      - [ ] Ranking prefers `location_verified` pulses in last 90m
      - [ ] Trust chips stay honest (never invent Verified)
      - [ ] Unit tests for rank comparator
    - Verification: Fixture with verified vs remote pulses; verified wins when otherwise tied

11. **[WC-6] Owner inbox response loop** — P1 | Effort: M | Impact: High  
    - After #85 proof: one-tap owner reply visible on venue Live now; dismiss persists server-side  
    - Acceptance: patron sees owner reply within session; `/ops` can triage reports in &lt;2 min flow

12. **[WC-7] Moderation SLA basics** — P2 | Effort: M | Impact: Medium  
    - Report → hide for reporter → admin queue → resolve/dismiss with reason  
    - Acceptance: p95 time-to-hide for reporter &lt; 1s; admin can clear queue without SQL

### Track 4 — Growth loops

13. **[WC-8] Share → install → first pulse funnel** — P1 | Effort: M | Impact: High  
    - Instrument + polish: OG share → `ShareArrivalCard` → install affordance → auth → first pulse  
    - Acceptance: funnel dashboard for this path; install card only when eligible; no fake urgency

14. **[WC-9] Single-hood density wedge** — P1 | Effort: L | Impact: High  
    - Pick **one** Seattle hood (e.g. Capitol Hill); 20 venues claimed/followed; 50 nightly actives dogfood  
    - Why now: Twitter won cities before countries. Density beats breadth.  
    - Acceptance: that hood’s Tonight never empty Fri/Sat 9–12pm for 4 weeks of dogfood  
    - Verification: weekly active reviews + unique posters chart

15. **[WC-10] Crew tonight (keep tight)** — P2 | Effort: M | Impact: Medium  
    - 2–4 friends, one pinned venue, no SMS vendor required  
    - Acceptance: crew sees each other’s I’m-here; guests not leaked cross-crew

### Track 5 — Scale polish (after Tracks 0–2)

16. **[WC-11] Cold-start budget on mid phones** — P2 | Effort: M | Impact: Medium  
    - Hard reload `/`; `pulse_map_interactive` ≲ 2000ms; Launch 33 first; All Seattle idle  
    - Verification: 3 device profiles documented in [docs/next-steps.md](docs/next-steps.md)

17. **[WC-12] Accessibility + motion pass** — P2 | Effort: M | Impact: Medium  
    - Map + Tonight + composer: keyboard, reduced-motion, contrast; no emoji-only meaning

18. **[WC-13] Second city readiness checklist only** — P3 | Effort: S | Impact: Low now  
    - Document catalog import + geo-gate + OG; **do not launch** until Seattle D1/D7 targets hit

### Parked (not Twitter-class for Pulse)

- Restoring Signal / dual `VITE_APP_MODE` shell  
- Global public text timeline unrelated to venues  
- Stripe / invented Pulse Pro pricing  
- Ticketing, AI concierge, video-first feed, Health/Fit  
- Mass OSM deletes; dropping leftover `signal_*` tables without review  
- Closing #66 as Signal Web Push — open a **new** venue-surge issue instead  

---

## Suggested sequencing (next 6 execution slices)

1. Human: **WC-0.1 → 0.3** (prod proof #64/#85/#86)  
2. Human: **WC-0.4 + WC-0.5** (protection + analytics keys)  
3. Agent: **WC-1 + WC-5** (Tonight ranking + verified weight)  
4. Human+agent: **WC-3** (VAPID + surge push)  
5. Agent: **WC-8** (share→pulse funnel polish)  
6. Human: **WC-9** (one-hood density dogfood)

## Decision

**Pulse is the nightlife venue + map PWA.** World-class means the **nightly open → live truth → return notify → trusted supply** flywheel works in Seattle with Twitter-level realtime and trust — not a clone of Twitter’s product surface.

## References

- [docs/next-steps.md](docs/next-steps.md) — Figma → shipped surfaces  
- [docs/runbooks/prod-next-steps-checklist.md](docs/runbooks/prod-next-steps-checklist.md) — ops checklist  
- [docs/observability.md](docs/observability.md) — funnel + adapters  
- [PRD.md](PRD.md) — product north star  
