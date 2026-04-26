# Pulse Differentiator Pack

Shipped 2026-04-17. Four additive features that create clear wins versus
Google Maps, Yelp, Partiful and Swarm. All default-safe: zero new runtime
dependencies, zero required env vars, every surface hides cleanly when data
is missing or the flag is off.

## Why this matters

| Competitor | Gap Pulse now closes |
| --- | --- |
| **Yelp / Google Maps** | Dress code and cover charge live in reviews, not as filterable structured data. Pulse makes them first-class fields with clear UI chips. |
| **Partiful / Swarm** | No weather-awareness; recommending a rooftop bar during a downpour erodes trust. Pulse boosts the shortlist based on current conditions. |
| **All incumbents** | Accessibility info is either buried in bio text or absent. Pulse exposes a nine-token structured filter, which powers both discovery and the venue page. |
| **All incumbents** | Wait-time is user-reported or guessed. Pulse ships a live ML-backed estimator driven by check-in velocity and pulse density, refreshed every 10 minutes by a cron-scheduled Edge Function. |

## Data model additions

### `venues` (new columns — nullable / additive)

- `dress_code` — enum(`casual` | `smart_casual` | `upscale` | `formal` | `costume_required` | `no_code`)
- `cover_charge_cents` — integer
- `cover_charge_note` — text (e.g. "Free before 11pm")
- `accessibility_features` — text[] with values from the nine-token union
- `indoor_outdoor` — enum(`indoor` | `outdoor` | `both`)

### New table: `venue_wait_times`

Columns: `id`, `venue_id`, `estimated_minutes`, `confidence` (`low`/`med`/`high`),
`sample_size`, `computed_at`. Index `(venue_id, computed_at desc)`.

**RLS**
- Venues metadata: world-readable (existing policy). Writes are additionally
  gated to admins via `app_metadata.role = 'admin'`; the service role key
  used by the Edge Functions bypasses RLS for cron writes.
- `venue_wait_times`: world-readable. Writes restricted to admins (service
  role bypasses RLS).

Migration: `supabase/migrations/20260417000006_venue_structured_metadata.sql`.

## Feature flags

All default on; set to `false`/`0`/`off` to disable.

| Flag | Purpose |
| --- | --- |
| `VITE_WEATHER_BOOST_ENABLED` | Hides the `useWeather` hook's network call and the weather-boost ranking adjustment. |
| `VITE_WAIT_TIME_ENABLED` | Hides the wait-time chip on `VenueCard`. Edge Function endpoints stay live but no client surface consumes them. |
| `VITE_ACCESSIBILITY_FILTER_ENABLED` | Hides the Accessibility section of `MapFilters`. |

Implemented in `src/lib/feature-flags.ts` with boolean inference that mirrors
the existing flag helpers.

## Edge Functions

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/wait-time/estimate` | GET `?venueId=` | Returns the latest `{ estimatedMinutes, confidence, sampleSize, computedAt }` for a venue; recomputes if the row is older than 15 minutes. Per-IP rate-limited. |
| `/api/wait-time/recompute` | GET | Vercel cron (every 10 min via `vercel.json`). Iterates venues with recent activity, persists fresh wait-time rows. |
| `/api/weather/current` | GET `?lat=&lng=` | Proxies Open-Meteo (no API key). 15-minute in-memory cache keyed on rounded (lat, lng, bucket). Per-IP rate-limited. |

### Wait-time algorithm

Pure function: `src/lib/wait-time-estimator.ts#estimateWaitTime`.

```
velocity_20 = count(check-ins within last 20 min)
velocity_60 = count(check-ins within last 60 min)
capacity    = max(venue.capacityHint ?? 80, 20)
load        = velocity_20 / (capacity * 0.20)
pulse_pressure = clamp(electric_pulses_60 / 10, 0, 0.5)
estimate    = clamp(round(60 * load * (1 + pulse_pressure)), 0, 90)
```

Confidence bands from `sample_size = velocity_60 + pulses_60`:
`<5 -> low`, `5..15 -> med`, `16+ -> high`.

### Weather boost

Pure function: `src/lib/weather-boost.ts#applyWeatherBoost`. Adjusts each
venue's `contextualScore` delta (never mutates input):

| Condition | Delta |
| --- | --- |
| Rain | indoor +10, outdoor −15 |
| Snow | outdoor −20, indoor +10 |
| Storm | outdoor −20, indoor +5 |
| Clear + ≥18 °C | outdoor / rooftop +10 |
| Clear + ≤5 °C | outdoor −5 |
| Wind ≥35 kph | rooftop −10 |
| Visibility ≤2 km | outdoor −5 |

## UI surfaces

- `VenueCard`: dress-code pill, `$` cover chip, and `⏱ ~N min wait` chip
  when a fresh (`< 15 min`) wait-time estimate exists.
- `VenuePage`: new "Details" section lists dress code, cover, and
  accessibility features (each as a visible chip). Hidden when no data.
- `MapFilters`: collapsible "Accessibility" section using
  `src/components/filters/AccessibilityFilter.tsx`. The filter count on
  the floating button now includes accessibility selections.

## Tests added

- `src/lib/__tests__/wait-time-estimator.test.ts` — 12 assertions across
  empty input, velocity scaling, cap enforcement, pulse pressure, capacity
  sensitivity, confidence bands, window bounds, invalid inputs, freshness.
- `src/lib/__tests__/weather-boost.test.ts` — 14 assertions across rain /
  snow / storm / sunny+warm / cold / windy-rooftop / low-visibility / empty
  / null-safe / ranking.

## Follow-up tickets

1. **Venue admin UI** for editing dress code, cover, accessibility tags,
   indoor/outdoor, capacity hint. Admin-only; reuses the admin role gating
   in the migration.
2. **Refined ML wait-time model** — replace heuristic with a lightweight
   learned model trained on observed "join-line-to-seated" deltas (requires
   new telemetry column on `presence`).
3. **Dark-sky / premium weather option** — slot a higher-fidelity upstream
   (precipitation forecast, heat-index) behind `OPEN_METEO_BASE_URL` override
   to preserve the flag-driven flow.
4. **Cross-session a11y filter persistence** — move selections from
   `sessionStorage` to the user profile once the admin edit flow lands.
5. **Wait-time UI integration on map clusters** — aggregate wait times into
   cluster annotations for `InteractiveMap`.
