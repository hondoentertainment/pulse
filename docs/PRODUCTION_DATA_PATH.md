# Production Data Path

Pulse uses Supabase as the durable source of truth for production venue, pulse,
and live-intelligence data.

## Venue Coverage

- **Seattle launch (shipping market):** 33 curated nightlife venues in
  `src/lib/seattle-launch-venues.ts` plus 500 OpenStreetMap nightlife venues
  (`inventory_source = osm`). Apply
  `20260909120000_seattle_launch_venue_catalog.sql` then
  `20260909180000_seattle_osm_venue_catalog.sql`.
  Verify with `supabase/verify/seattle_launch_venues.sql` (33 curated + 500 osm).
- The national venue catalog in `src/lib/us-venues.ts` is prototype coverage for
  local development, preview builds, and visual tests. It is not the Seattle
  launch source of truth.
- Production should serve venues from the Supabase `venues` table and
  the `get_live_venue_intelligence` RPC.
- The app's U.S. market selector works with both data sources as long as venues
  include `city`, `state`, `location_lat`, and `location_lng`.
- If Supabase returns zero venues or cannot return venue data, the app
  temporarily falls back to the Seattle launch catalog (when geo-gated) or the
  national prototype catalog and emits a `venue_data_fallback` analytics event.

## Required Migration

Apply the live venue intelligence migration before relying on production live
reports:

```powershell
npx supabase link --project-ref <production-project-ref>
npx supabase db push
```

The migration file is:

```text
supabase/migrations/20260429000000_realtime_venue_intelligence.sql
```

## Production Verification

After the Seattle catalog migration and deploy:

1. Open the production Vercel URL.
2. Confirm the Map tab shows the Seattle catalog (33 curated + 500 OSM, 533 total) — not an empty canvas and not only the 33-venue fixture fallback.
3. Spot-check Neumos (curated-seed) plus an OSM bar — pins and venue detail should open.
4. If `VITE_LAUNCHED_CITIES=Seattle,WA`, other markets must not appear.
5. Submit or inspect a live venue report to verify Supabase aggregates refresh.
