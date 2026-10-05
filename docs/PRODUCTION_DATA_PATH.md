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
- The coast index (Seattle, Portland, San Francisco) loads one city at a time.
  Portland and San Francisco curated seeds live in the client and paint when
  that city is selected. The same rooms are inserted by
  `supabase/migrations/20261005120000_portland_san_francisco_launch_venues.sql`
  (32 Portland, 32 San Francisco). `venues.id` is a UUID, so each row uses the
  deterministic id the app catalog ships; share slugs such as
  `pdx-crystal-ballroom` and `sf-chapel` stay aliases. Apply that migration on
  production project `xeldqwhztcnnvazmshzh` after merge, then verify with
  `supabase/verify/portland_san_francisco_launch_venues.sql`. Seattle’s
  533-venue catalog is unchanged.
- Settings can still simulate a GPS point in other U.S. cities. That does not
  load those cities onto the map.
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
4. The coast switcher offers Seattle, Portland, and San Francisco when the geo-gate is empty. With `VITE_LAUNCHED_CITIES=Seattle,WA`, only Seattle is selectable. `Seattle,WA;Portland,OR;San Francisco,CA` opens all three, still one city at a time.
5. Submit or inspect a live venue report to verify Supabase aggregates refresh.

## Read-Only Coverage Audit

Run `node --env-file=.env.local scripts/check-venue-coverage.mjs` to count real
venue rows by city and check the live-intelligence RPC without writing data.
On October 3, 2026 the production read returned 533 Seattle venues and no other
cities. Nationwide market selection does not imply nationwide real listings.
The local Supabase project was not linked, so migration history still needs
verification before applying any migrations.
