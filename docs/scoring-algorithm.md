# Scoring Algorithm

How Pulse calculates live venue energy scores. Source: `src/lib/pulse-engine.ts`, `src/lib/venue-trending.ts`, `src/lib/credibility.ts`.

---

## Overview

Each venue has a **pulse score** from 0–100 reflecting activity in the last **90 minutes**. Scores update when pulses are created, reactions added, or pulses expire.

```
Score label thresholds:
  0–24   → Dead
  25–49  → Chill
  50–74  → Buzzing
  75–100 → Electric
```

The UI shows the label and color; the numeric score drives sorting and surge detection.

---

## Pulse score calculation

`calculatePulseScore(pulses, useCredibilityWeighting?)` in `pulse-engine.ts`:

### 1. Recency filter

Only pulses younger than `PULSE_DECAY_MINUTES` (90) contribute. Older pulses are ignored entirely.

### 2. Per-pulse contribution

For each valid pulse:

```
recencyFactor = 1 - (age / decayWindow)     // linear decay, newest = 1.0
energyValue   = ENERGY_CONFIG[rating].value // dead=1, chill=2, buzzing=3, electric=4
engagementFactor = 1 + (reactions + views) / 100
credibilityWeight = pulse.credibilityWeight ?? 1.0   // 0.5–2.0 when enabled
squadMultiplier = pulse.crewId ? 1.5 : 1.0

contribution = energyValue × recencyFactor × engagementFactor
             × credibilityWeight × squadMultiplier × 25
```

**Engagement weights per reaction type:**
- `fire`, `lightning`: 0.5 each
- `eyes`: 0.2
- `views`: 0.1

### 3. Velocity bonus

If more than 5 valid pulses exist in the window:

```
velocityBonus = validPulses × 5
```

### 4. Cap

```
finalScore = min(100, round(totalScore + velocityBonus))
```

---

## Energy ratings

| Rating | Value | Color (theme) |
|--------|-------|---------------|
| `dead` | 1 | Muted |
| `chill` | 2 | Cool |
| `buzzing` | 3 | Warm |
| `electric` | 4 | Electric accent |

Defined in `src/lib/types.ts` as `ENERGY_CONFIG`.

---

## Credibility weighting

Trusted users' pulses carry more influence. See `src/lib/credibility.ts`.

| Signal | Effect |
|--------|-------|
| New account | 0.5–0.7x weight |
| Regular check-ins | Weight increases toward 2.0x max |
| Spam patterns | Weight reduced |

No public credibility number is shown — only ambient badges on pulse cards.

---

## Trending detection

`venue-trending.ts` categorizes venues beyond raw score:

| Category | Criteria |
|----------|----------|
| **Trending Now** | High score + multi-user activity |
| **Just Popped Off** | Rapid score increase (surge) |
| **Gaining Energy** | Building momentum, pre-peak |

`calculateScoreVelocity()` tracks score change over a sliding window. `useVenueSurgeTracker` generates notifications when thresholds are crossed.

---

## Score transparency (UI)

The "Why this score?" panel (`ScoreBreakdown.tsx`) shows:
- Pulse count in last 90 minutes
- Average energy level
- Recent score change (+/- in last 10 min)
- Time of last pulse

It does **not** expose formula weights to prevent gaming.

---

## Impact notifications

When a user's pulse pushes a venue across an energy threshold (e.g. Chill → Buzzing), an impact notification is generated:

> "Your pulse pushed [Venue] into Electric ⚡"

Handled in `use-app-handlers.ts` after score recalculation.

---

## Server-side scoring

Production target: authoritative scoring runs server-side on pulse insert. Client `pulse-engine.ts` remains for:
- Optimistic UI updates
- Offline/mock mode
- Unit tests as specification

Supabase triggers in `20260429000000_realtime_venue_intelligence.sql` refresh `venues.pulse_score` on pulse changes.

---

## Geo verification

`isWithinRadius()` uses haversine distance. Check-in requires the user within a configurable radius of the venue (default in handlers). Prevents remote pulse spam.

---

## Related modules

| Module | Role |
|--------|------|
| `time-contextual-scoring.ts` | Normalize scores by time of day |
| `weather-boost.ts` | Weather-adjusted ranking (not score itself) |
| `predictive-surge.ts` | Forecast upcoming surges |
| `neighborhood-scores.ts` | Aggregate area scores |

## Tests

```
src/lib/__tests__/pulse-engine.test.ts
src/lib/__tests__/venue-trending.test.ts
src/lib/__tests__/credibility.test.ts
src/lib/__tests__/predictive-surge.test.ts
```

## Related docs

- [IMPLEMENTATION_SUMMARY.md](../IMPLEMENTATION_SUMMARY.md)
- [Lib Modules](lib-modules.md)
- [PRD.md](../PRD.md) — score transparency requirements
