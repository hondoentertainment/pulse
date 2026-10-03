# Seattle OSM venue seeds

Real nightlife venues from OpenStreetMap Overpass. Names and street
addresses are not invented.

| File | Role |
|------|------|
| `seattle-osm-overpass.json` | Raw Overpass dump (bbox `47.495,-122.459,47.734,-122.224`) |
| `seattle-osm-venues.json` | Filtered catalog (target 500) + manifest |
| `seattle-osm-manifest.json` | Counts, query, reject reasons |

Refresh:

```bash
npm run seattle-osm:fetch
npm run seattle-osm:build
```

Apply the generated migration
`supabase/migrations/20260909180000_seattle_osm_venue_catalog.sql` to
production `xeldqwhztcnnvazmshzh` via the SQL editor. See
`docs/runbooks/venue-staging.md`.
