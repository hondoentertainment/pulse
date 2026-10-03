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
- Production does not load prototype venues or simulated activity. Empty
  markets remain selectable and show an empty state. Fixtures load only in
  development or explicitly configured visual previews.
- Read-only verification on 2026-10-03 found 533 publicly readable venues,
  all in Seattle, WA. The live-intelligence RPC returned successfully.
  Nationwide selection does not imply nationwide listing coverage.
- Migration history could not be checked: the local Supabase CLI is not linked.
  Verify the project and migration history before running a database push.

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

Run the read-only coverage audit with the target project's public credentials:

```powershell
node --env-file=.env.local scripts/check-venue-coverage.mjs
```

This paginates all publicly readable venue rows and checks the live RPC. It does
not verify private rows or migration history, and does not write data.

After migration and deploy:

1. Open the production Vercel URL.
2. Switch the market selector from Seattle to Miami.
3. Confirm Miami venues appear and venue detail opens.
4. Open the Map tab and confirm the canvas renders for the selected market.
5. Submit or inspect a live venue report to verify Supabase aggregates refresh.
