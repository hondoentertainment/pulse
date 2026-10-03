# Runbook: Venue staging and production checks

## Purpose

Confirm the nightlife venue + map shell is what every environment mounts. Pulse is venue-only; there is no Signal product flag.

## Preconditions

- Preview or production deploy of this repo
- Optional: `VITE_LAUNCHED_CITIES=Seattle,WA` if exercising the geo-gate

## Procedure

1. Open production / preview. The HTML title should be **Pulse — where the energy is right now** and the first surface should be map / discover.
2. Confirm there is no Pulse Signal Today / check-in shell, and no `VITE_APP_MODE` env var is required.
3. Confirm the Seattle catalog is in Supabase (33 curated + ~500 OSM nightlife venues). See [Apply Seattle venues](#apply-seattle-venues-production-supabase).
4. Exercise the nightlife loop: map → venue → pulse → trending.
5. Local:

```bash
npm run dev
npm run test:smoke:venue
```

## Apply Seattle venues (production Supabase)

Two catalogs:

| Source | Count | `inventory_source` | Apply file |
|---|---|---|---|
| Curated launch (`src/lib/seattle-launch-venues.ts`) | 33 | `curated-seed` | `20260909120000_seattle_launch_venue_catalog.sql` |
| OpenStreetMap Overpass | 500 | `osm` | `20260909180000_seattle_osm_venue_catalog.sql` |

OSM query, bbox `47.495,-122.459,47.734,-122.224`: `amenity=bar/pub/nightclub/biergarten/hookah_lounge/stripclub/casino`, `tourism=nightclub`, `amenity=music_venue/brewery`, `craft=brewery`, restaurants/cafes with `bar=yes` or `cocktails=yes`. Best 500 after filters. Refresh: `node scripts/fetch-seattle-osm-venues.mjs && node scripts/build-seattle-osm-catalog.mjs`.

Production project: `xeldqwhztcnnvazmshzh`. Schema migrations were already applied there with MCP timestamps that do **not** match the repo filenames, so `supabase db push` is not the apply path for this project.

### Option A — SQL editor (recommended for this project)

1. Open the Supabase SQL editor for `xeldqwhztcnnvazmshzh`.
2. Apply the curated file first if those 33 rows are missing: `supabase/migrations/20260909120000_seattle_launch_venue_catalog.sql`.
3. Paste `supabase/migrations/20260909180000_seattle_osm_venue_catalog.sql`. Re-runs are idempotent, never update `curated-seed` rows, and skip name+address matches.
4. Run [supabase/verify/seattle_launch_venues.sql](../../supabase/verify/seattle_launch_venues.sql). Expect `curated = 33`, `osm = 500`, `seattle_alive = 533`.

### Option C — Supabase MCP `execute_sql` (if the 108 KB file is too large)

Split `supabase/seeds/seattle-osm-venues.json` into 100-row upserts:

```bash
node scripts/emit-seattle-osm-apply-batches.mjs
```

Then run each `supabase/seeds/osm-apply-batches/json-0N.sql` via MCP
`execute_sql` on project `xeldqwhztcnnvazmshzh`. Same idempotent rules as
the full migration. Do **not** use `supabase db push` against this project.

### Option B — CLI on a project whose migration history matches the repo

```bash
npx supabase link --project-ref <project-ref>
npx supabase db push --linked
```

Local reset applies the same catalog via migrations, then `supabase/seed.sql`.

### Stop conditions

- If `venues` insert fails on `inventory_source` / `neighborhood`, apply `20260825000000_venue_signal_seattle_launch.sql` first.
- If `get_live_venue_intelligence` drop/recreate fails, stop and keep the existing function; the catalog INSERT/UPDATE above it is still the required data change.

## Verification

- [ ] App boots the venue shell with no mode switch
- [ ] Title matches Pulse nightlife copy
- [ ] CI `smoke-preview` follows `smoke-preview-venue`
- [ ] `VITE_LAUNCHED_CITIES` (if set) only gates venue markets

## Rollback / Escalation

- If a deploy is fixture-only, set `VITE_SUPABASE_*` and rebuild.
- If the map or pulse loop is broken, roll back the deploy ([bad-deploy](bad-deploy.md)).

## Ownership

- Owner: Pulse venue engineer
- Last reviewed: 2026-09-09
