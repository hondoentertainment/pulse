# Coast index (Seattle, Portland, San Francisco)

Pulse opens one West Coast city at a time. Seattle is the default and still paints Launch 33 first, then All Seattle after idle. Portland, Oregon and San Francisco, California are the other two markets on the coast index. The map and Tonight load the selected city only. Los Angeles, San Diego, and the rest of California are not on this index.

## What a coast city reuses

Do not build a parallel stack.

1. **Catalog.** Curated seeds follow `SEATTLE_LAUNCH_VENUES`: 25–40 real, publicly listed rooms, `pulseScore` 0, `inventorySource: curated-seed`, no scraped photos. Portland lives in `src/lib/portland-launch-venues.ts`. San Francisco lives in `src/lib/san-francisco-launch-venues.ts`. `loadCityCatalog` imports one city module. A larger catalog for that city (Seattle OSM today) stays behind `partitionColdStartCatalog` / `pulse_map_interactive`. No mass deletes.
2. **Geo-gate.** `VITE_LAUNCHED_CITIES` treats `Seattle,WA` as one market. Extra markets are `City,ST` pairs separated by `;`: `Seattle,WA;Portland,OR;San Francisco,CA`. Empty stays “no gate.” Do not invent a second production domain.
3. **OG and share.** `/api/share/venue` and neighborhood OG stay city-agnostic (`/n/:slug`, `?venueId=`). A hood page exists when venues in that city carry a neighborhood tag. Share lookup falls back to the curated seed when the venue is not in Supabase yet, on the same origin.
4. **Map cold start.** The selected city’s curated set paints first. The rest of that city waits for idle.
5. **Trust.** Claims, `/ops` (`app_metadata.role = admin` only), and `pulse_reports` stay the moderation path. No new admin role.

## Still out of scope

- Los Angeles, San Diego, or any other California city
- A second production domain or a Supabase Auth Site URL change
- New vendor keys, Stripe, or paid APIs
- Sending invites or bulk-editing venue ownership
- Closing GitHub issues #85, #86, or #109
