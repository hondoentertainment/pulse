# Production Data Path

Pulse uses Supabase as the durable source of truth for production venue, pulse,
and live-intelligence data.

## Venue Coverage

- The national venue catalog in `src/lib/us-venues.ts` is prototype coverage for
  local development, preview builds, and visual tests.
- Production should serve nationwide venues from the Supabase `venues` table and
  the `get_live_venue_intelligence` RPC.
- The app's U.S. market selector works with both data sources as long as venues
  include `city`, `state`, `location_lat`, and `location_lng`.
- If Supabase is reachable but returns zero venues, the app temporarily falls
  back to the national prototype catalog and emits a `venue_data_fallback`
  analytics event. This keeps discovery usable while production venue seeding is
  completed.

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

After migration and deploy:

1. Open the production Vercel URL.
2. Switch the market selector from Seattle to Miami.
3. Confirm Miami venues appear and venue detail opens.
4. Open the Map tab and confirm the canvas renders for the selected market.
5. Submit or inspect a live venue report to verify Supabase aggregates refresh.
