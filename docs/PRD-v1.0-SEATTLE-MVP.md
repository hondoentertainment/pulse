# Pulse — Product Requirements Document v1.0

**Real-time venue energy and personalized nightlife decisions**

| | |
|---|---|
| Version | 1.0 |
| Date | July 12, 2026 |
| Product owner | Kyle Henderson |
| Initial market | Seattle nightlife |
| Status | Product definition and MVP planning |

**Product promise:** Know where to go right now—before you waste the night.

> This document is the **canonical MVP spec** for the Seattle beta. The legacy feature-oriented spec remains in [../PRD.md](../PRD.md) for historical reference; new work should align with this document.

---

## Executive summary

Pulse is a **real-time decision engine** for going out. It helps people select a venue using live crowd energy, contextual signals, personal preferences, distance, wait time, cost, and confidence in the underlying data.

The MVP launches narrowly across **25–40 Seattle nightlife venues** in **3–5 neighborhoods**, primarily **Thursday–Saturday evenings**. Four energy states — **Dead, Chill, Buzzing, Electric** — are supported by fresh community reports, visible confidence, rapid data decay, and verified contributors.

**North-star metric:** Decision Conversion Rate — qualified sessions resulting in Go, directions, save, share, or confirmed arrival within 30 minutes.

---

## Primary navigation (MVP)

| Area | Purpose | Code mapping |
|------|---------|--------------|
| **Tonight** | Personalized recommendations + vibe selection | `TonightTab`, `/` |
| **Map** | Geographic live energy | `InteractiveMap`, `/map` |
| **Explore** | Filterable venue list | `DiscoverTab`, `/discover` |
| **Alerts** | Energy-change notifications | `/notifications` |
| **Profile** | Preferences, reputation, privacy | `/profile` |

Social pulse feed (legacy) remains at `/trending` until deprecated.

---

## Golden path

1. Open Pulse during a supported nightlife window.
2. Choose Dead, Chill, Buzzing, or Electric (+ optional context).
3. Review the **Tonight** feed or map.
4. Open a venue card: fit, energy, trend, confidence, freshness, friction.
5. Tap **Go**, directions, save, or share.
6. After arrival, submit a one-tap report.
7. See how the report refreshed the signal.

---

## Energy, confidence, and integrity

- **Energy** is a perception signal (not occupancy count).
- **Confidence** must be visible: High / Medium / Low / None.
- **Freshness:** default 90-minute live window; aging → “Last known” → “No live signal”.
- **Integrity:** venue payment cannot raise organic energy, confidence, or undisclosed ranking. Sponsored content is always labeled.

Implementation: `pulse-engine.ts`, `decision-explanations.ts`, `tonight-feed.ts`, `live-intelligence.ts`.

---

## Analytics contract (§8.1)

Required events (see `src/lib/analytics.ts` + `src/lib/decision-analytics.ts`):

`decision_session_start`, `vibe_selected`, `recommendation_viewed`, `go_selected`, `directions_started`, `venue_saved`, `venue_shared`, `arrival_confirmed`, `mismatch_reported`, `filter_applied`.

---

## MVP scope summary

**Must have:** Tonight feed, map, four states, confidence/freshness, fast reporting, prefs/filters, verification/moderation.

**Should have:** Scout tiers, limited alerts, venue analytics pilot, mismatch loop.

**Later:** Group matching, native apps, reservations/ticketing, multi-city, daytime.

Full requirement tables, personas, data model, monetization, and acceptance criteria are in the product owner's source document (July 12, 2026). Track delivery via [SEATTLE_BETA_BACKLOG.md](./SEATTLE_BETA_BACKLOG.md).

---

## Launch geography

```bash
VITE_LAUNCHED_CITIES=Seattle,WA
VITE_APP_MODE=venue
VITE_ALLOW_VENUE_SHELL=true
```

See [prod-vercel-env.md](./prod-vercel-env.md) and [LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md).
