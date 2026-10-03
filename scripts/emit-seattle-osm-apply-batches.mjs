/**
 * Emit 100-row JSON upserts for production MCP / SQL editor apply
 * when the full 108 KB migration is too large for one paste.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const catalog = JSON.parse(
  readFileSync(resolve(ROOT, 'supabase/seeds/seattle-osm-venues.json'), 'utf8'),
)
const venues = catalog.venues
const outDir = resolve(ROOT, 'supabase/seeds/osm-apply-batches')
mkdirSync(outDir, { recursive: true })

const SIZE = 100

function upsertSql(rows) {
  const payload = rows.map((venue) => ({
    id: venue.id,
    name: venue.name,
    lat: venue.location_lat,
    lng: venue.location_lng,
    addr: venue.location_address,
    nhood: venue.neighborhood,
    cat: venue.category,
    phone: venue.phone,
    web: venue.website,
  }))
  const json = JSON.stringify(payload).replace(/'/g, "''")
  return `WITH catalog AS (
  SELECT * FROM jsonb_to_recordset('${json}'::jsonb)
  AS x(id uuid, name text, lat float, lng float, addr text, nhood text, cat text, phone text, web text)
), updated AS (
  UPDATE venues v SET
    name = c.name, location_lat = c.lat, location_lng = c.lng, location_address = c.addr,
    city = 'Seattle', state = 'WA', neighborhood = COALESCE(c.nhood, v.neighborhood), category = c.cat,
    seeded = true, inventory_source = 'osm', phone = c.phone, website = c.web,
    pulse_score = CASE WHEN v.last_pulse_at IS NULL THEN 0 ELSE v.pulse_score END,
    score_velocity = CASE WHEN v.last_pulse_at IS NULL THEN 0 ELSE v.score_velocity END
  FROM catalog c
  WHERE v.deleted_at IS NULL AND v.inventory_source IS DISTINCT FROM 'curated-seed'
    AND (v.id = c.id OR (lower(v.name) = lower(c.name) AND lower(v.location_address) = lower(c.addr) AND v.city = 'Seattle' AND v.state = 'WA'))
  RETURNING v.id
)
INSERT INTO venues (id, name, location_lat, location_lng, location_address, city, state, neighborhood, category, pulse_score, score_velocity, seeded, inventory_source, phone, website)
SELECT c.id, c.name, c.lat, c.lng, c.addr, 'Seattle', 'WA', c.nhood, c.cat, 0, 0, true, 'osm', c.phone, c.web
FROM catalog c
WHERE NOT EXISTS (
  SELECT 1 FROM venues v WHERE v.id = c.id OR (lower(v.name) = lower(c.name) AND lower(v.location_address) = lower(c.addr) AND v.city = 'Seattle' AND v.state = 'WA')
);
`
}

for (let i = 0; i < venues.length; i += SIZE) {
  const chunk = venues.slice(i, i + SIZE)
  const n = String(Math.floor(i / SIZE) + 1).padStart(2, '0')
  const dest = resolve(outDir, `json-${n}.sql`)
  writeFileSync(dest, upsertSql(chunk))
  console.log(`Wrote ${dest} (${chunk.length} venues)`)
}
