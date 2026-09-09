/**
 * Normalize the Overpass dump into an idempotent Seattle OSM catalog.
 * Does not invent names or street addresses. Dedupes against the curated 33.
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const TARGET = 500
const OSM_NS = '8f3c2e10-6a11-5e07-9c4d-0000000000a1'
const PROXIMITY_M = 80
const CURATED_PROXIMITY_M = 160

const curatedPath = resolve(ROOT, 'src/lib/seattle-launch-venues.ts')
const curatedSource = readFileSync(curatedPath, 'utf8')
const curatedBlocks = [...curatedSource.matchAll(/name:\s*(['"])(.*?)\1[\s\S]*?location:\s*\{\s*lat:\s*([0-9.-]+),\s*lng:\s*([0-9.-]+),\s*address:\s*(['"])(.*?)\5/g)]
  .map((match) => ({
    name: match[2],
    lat: Number(match[3]),
    lng: Number(match[4]),
    address: match[6],
  }))

if (curatedBlocks.length < 25) {
  throw new Error(`Failed to parse curated venues from seattle-launch-venues.ts (got ${curatedBlocks.length})`)
}

const NEIGHBORHOODS = [
  { name: 'Ballard', minLat: 47.655, maxLat: 47.705, minLng: -122.410, maxLng: -122.360 },
  { name: 'Fremont', minLat: 47.645, maxLat: 47.672, minLng: -122.368, maxLng: -122.330 },
  { name: 'Wallingford', minLat: 47.655, maxLat: 47.675, minLng: -122.342, maxLng: -122.320 },
  { name: 'University District', minLat: 47.655, maxLat: 47.675, minLng: -122.322, maxLng: -122.298 },
  { name: 'Green Lake', minLat: 47.675, maxLat: 47.690, minLng: -122.350, maxLng: -122.320 },
  { name: 'Greenwood', minLat: 47.685, maxLat: 47.710, minLng: -122.365, maxLng: -122.345 },
  { name: 'Phinney Ridge', minLat: 47.670, maxLat: 47.685, minLng: -122.365, maxLng: -122.345 },
  { name: 'Capitol Hill', minLat: 47.610, maxLat: 47.640, minLng: -122.332, maxLng: -122.300 },
  { name: 'Central District', minLat: 47.595, maxLat: 47.620, minLng: -122.310, maxLng: -122.280 },
  { name: 'Madrona', minLat: 47.608, maxLat: 47.622, minLng: -122.295, maxLng: -122.275 },
  { name: 'Belltown', minLat: 47.610, maxLat: 47.622, minLng: -122.356, maxLng: -122.335 },
  { name: 'Downtown', minLat: 47.600, maxLat: 47.618, minLng: -122.345, maxLng: -122.325 },
  { name: 'Pioneer Square', minLat: 47.595, maxLat: 47.605, minLng: -122.340, maxLng: -122.328 },
  { name: 'International District', minLat: 47.594, maxLat: 47.602, minLng: -122.328, maxLng: -122.315 },
  { name: 'South Lake Union', minLat: 47.618, maxLat: 47.635, minLng: -122.345, maxLng: -122.325 },
  { name: 'Queen Anne', minLat: 47.620, maxLat: 47.650, minLng: -122.370, maxLng: -122.345 },
  { name: 'Magnolia', minLat: 47.630, maxLat: 47.660, minLng: -122.410, maxLng: -122.375 },
  { name: 'West Seattle', minLat: 47.530, maxLat: 47.595, minLng: -122.420, maxLng: -122.350 },
  { name: 'Georgetown', minLat: 47.535, maxLat: 47.560, minLng: -122.335, maxLng: -122.310 },
  { name: 'SoDo', minLat: 47.560, maxLat: 47.590, minLng: -122.345, maxLng: -122.325 },
  { name: 'Beacon Hill', minLat: 47.545, maxLat: 47.590, minLng: -122.325, maxLng: -122.290 },
  { name: 'Columbia City', minLat: 47.555, maxLat: 47.570, minLng: -122.290, maxLng: -122.270 },
  { name: 'Rainier Valley', minLat: 47.520, maxLat: 47.555, minLng: -122.290, maxLng: -122.255 },
  { name: 'Northgate', minLat: 47.700, maxLat: 47.730, minLng: -122.340, maxLng: -122.310 },
  { name: 'Lake City', minLat: 47.710, maxLat: 47.730, minLng: -122.310, maxLng: -122.280 },
  { name: 'Ravenna', minLat: 47.670, maxLat: 47.685, minLng: -122.320, maxLng: -122.290 },
  { name: 'First Hill', minLat: 47.605, maxLat: 47.615, minLng: -122.330, maxLng: -122.318 },
]

function uuidv5(name, namespace) {
  const ns = Buffer.from(namespace.replace(/-/g, ''), 'hex')
  const hash = createHash('sha1').update(ns).update(name).digest()
  hash[6] = (hash[6] & 0x0f) | 0x50
  hash[8] = (hash[8] & 0x3f) | 0x80
  const hex = hash.subarray(0, 16).toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

function normalizeName(value) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/['’]/g, '')
    .replace(/^the\s+/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function normalizeAddress(value) {
  return value
    .toLowerCase()
    .replace(/,?\s*seattle,?\s*wa\b.*/i, '')
    .replace(/\b\d{5}(?:-\d{4})?\b/g, '')
    .replace(/\bnortheast\b/g, 'ne')
    .replace(/\bnorthwest\b/g, 'nw')
    .replace(/\bsoutheast\b/g, 'se')
    .replace(/\bsouthwest\b/g, 'sw')
    .replace(/\beast\b/g, 'e')
    .replace(/\bwest\b/g, 'w')
    .replace(/\bnorth\b/g, 'n')
    .replace(/\bsouth\b/g, 's')
    .replace(/\bstreet\b/g, 'st')
    .replace(/\bavenue\b/g, 'ave')
    .replace(/\bboulevard\b/g, 'blvd')
    .replace(/\bdrive\b/g, 'dr')
    .replace(/\bplace\b/g, 'pl')
    .replace(/\bcourt\b/g, 'ct')
    .replace(/\blane\b/g, 'ln')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function namesLooselyMatch(a, b) {
  const left = normalizeName(a)
  const right = normalizeName(b)
  if (!left || !right) return false
  if (left === right) return true
  const shorter = left.length <= right.length ? left : right
  const longer = left.length <= right.length ? right : left
  return shorter.length >= 6 && longer.startsWith(`${shorter} `)
}

function haversineMeters(a, b) {
  const R = 6371000
  const toRad = (x) => (x * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const sin = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(sin)))
}

function coords(element) {
  if (typeof element.lat === 'number' && typeof element.lon === 'number') {
    return { lat: element.lat, lng: element.lon }
  }
  if (element.center && typeof element.center.lat === 'number') {
    return { lat: element.center.lat, lng: element.center.lon }
  }
  return null
}

function classify(tags) {
  const amenity = tags.amenity
  const tourism = tags.tourism
  const leisure = tags.leisure
  const craft = tags.craft
  const industrial = tags.industrial
  // OSM sometimes tags juice/yoga studios as amenity=bar. Drop those.
  if (leisure === 'dance' || leisure === 'fitness_centre' || tags.sport === 'yoga') {
    return null
  }
  if (tags.drink === 'juice' && amenity !== 'pub' && amenity !== 'nightclub') {
    return null
  }
  if (amenity === 'nightclub' || tourism === 'nightclub' || amenity === 'stripclub') {
    return { category: 'Nightclub', priority: 100, kind: amenity || tourism }
  }
  if (amenity === 'bar' || amenity === 'biergarten' || amenity === 'hookah_lounge') {
    return { category: amenity === 'hookah_lounge' ? 'Lounge' : 'Bar', priority: 90, kind: amenity }
  }
  if (amenity === 'pub') return { category: 'Bar', priority: 80, kind: amenity }
  if (amenity === 'music_venue' || amenity === 'concert_hall') {
    return { category: 'Music Venue', priority: 85, kind: amenity }
  }
  if (amenity === 'brewery' || craft === 'brewery' || industrial === 'brewery') {
    return { category: 'Brewery', priority: 70, kind: 'brewery' }
  }
  if (leisure === 'bowling_alley') return { category: 'Bar', priority: 55, kind: leisure }
  if (amenity === 'casino') return { category: 'Nightclub', priority: 60, kind: amenity }
  if (amenity === 'restaurant' || amenity === 'cafe') {
    const nightlife = tags.bar === 'yes' || tags.cocktails === 'yes' || tags.microbrewery === 'yes'
    return { category: amenity === 'cafe' ? 'Café' : 'Restaurant', priority: nightlife ? 50 : 20, kind: amenity }
  }
  return null
}

function buildAddress(tags) {
  const city = tags['addr:city'] && /seattle/i.test(tags['addr:city']) ? tags['addr:city'] : 'Seattle'
  const state = 'WA'
  if (tags['addr:full']) {
    const full = tags['addr:full'].replace(/\s+/g, ' ').trim()
    return /seattle/i.test(full) ? full : `${full}, ${city}, ${state}`
  }
  const number = tags['addr:housenumber']
  const street = tags['addr:street']
  const unit = tags['addr:unit']
  const postcode = tags['addr:postcode']
  if (number && street) {
    const unitPart = unit ? ` ${unit}` : ''
    const zip = postcode ? ` ${postcode}` : ''
    return `${number} ${street}${unitPart}, ${city}, ${state}${zip}`.replace(/\s+/g, ' ').trim()
  }
  if (street) return `${street}, ${city}, ${state}`
  return `${city}, ${state}`
}

function inferNeighborhood(tags, point) {
  const tagged = tags['addr:suburb'] || tags['addr:neighbourhood'] || tags['addr:hamlet']
  if (tagged) return tagged
  for (const neighborhood of NEIGHBORHOODS) {
    if (
      point.lat >= neighborhood.minLat && point.lat <= neighborhood.maxLat
      && point.lng >= neighborhood.minLng && point.lng <= neighborhood.maxLng
    ) {
      return neighborhood.name
    }
  }
  return null
}

function sqlLiteral(value) {
  if (value == null || value === '') return 'NULL'
  return `'${String(value).replace(/'/g, "''")}'`
}

const raw = JSON.parse(readFileSync(resolve(ROOT, 'supabase/seeds/seattle-osm-overpass.json'), 'utf8'))
const rejected = { unnamed: 0, noCoords: 0, notNightlife: 0, outsideCity: 0, curatedNameAddress: 0, curatedGeo: 0, osmDup: 0 }

const candidates = []
for (const element of raw.elements || []) {
  const tags = element.tags || {}
  const name = (tags.name || '').trim()
  if (!name) {
    rejected.unnamed += 1
    continue
  }
  const point = coords(element)
  if (!point) {
    rejected.noCoords += 1
    continue
  }
  const classified = classify(tags)
  if (!classified) {
    rejected.notNightlife += 1
    continue
  }
  const taggedCity = tags['addr:city']
  if (taggedCity && !/seattle/i.test(taggedCity)) {
    rejected.outsideCity = (rejected.outsideCity || 0) + 1
    continue
  }
  const postcode = tags['addr:postcode'] || ''
  if (postcode && !postcode.startsWith('981')) {
    rejected.outsideCity = (rejected.outsideCity || 0) + 1
    continue
  }

  const address = buildAddress(tags)
  const venue = {
    id: uuidv5(`osm:${element.type}:${element.id}`, OSM_NS),
    osmType: element.type,
    osmId: element.id,
    name,
    location_lat: Number(point.lat.toFixed(6)),
    location_lng: Number(point.lng.toFixed(6)),
    location_address: address,
    city: 'Seattle',
    state: 'WA',
    neighborhood: inferNeighborhood(tags, point),
    category: classified.category,
    phone: tags.phone || tags['contact:phone'] || null,
    website: tags.website || tags['contact:website'] || null,
    inventory_source: 'osm',
    priority: classified.priority,
    hasStreet: Boolean(tags['addr:housenumber'] && tags['addr:street']),
    kind: classified.kind,
  }

  const nameKey = normalizeName(venue.name)
  const addressKey = normalizeAddress(venue.location_address)
  const curatedHit = curatedBlocks.some((curated) => {
    const sameName = namesLooselyMatch(curated.name, venue.name)
    const sameAddress = addressKey && normalizeAddress(curated.address) === addressKey
    const nearby = haversineMeters(
      { lat: venue.location_lat, lng: venue.location_lng },
      curated,
    ) <= CURATED_PROXIMITY_M
    if (sameName && sameAddress) return true
    if (sameName && nearby) return true
    if (sameAddress && addressKey && nearby) return true
    return false
  })
  if (curatedHit) {
    if (curatedBlocks.some((c) => normalizeName(c.name) === nameKey && normalizeAddress(c.address) === addressKey)) {
      rejected.curatedNameAddress += 1
    } else {
      rejected.curatedGeo += 1
    }
    continue
  }
  candidates.push(venue)
}

candidates.sort((a, b) => {
  if (b.priority !== a.priority) return b.priority - a.priority
  if (Number(b.hasStreet) !== Number(a.hasStreet)) return Number(b.hasStreet) - Number(a.hasStreet)
  return a.name.localeCompare(b.name)
})

const kept = []
for (const venue of candidates) {
  const nameKey = normalizeName(venue.name)
  const addressKey = normalizeAddress(venue.location_address)
  const duplicate = kept.some((existing) => {
    const sameName = normalizeName(existing.name) === nameKey
    const sameAddress = addressKey && normalizeAddress(existing.location_address) === addressKey
    if (sameName && sameAddress) return true
    if (sameName && haversineMeters(
      { lat: venue.location_lat, lng: venue.location_lng },
      { lat: existing.location_lat, lng: existing.location_lng },
    ) <= PROXIMITY_M) return true
    return false
  })
  if (duplicate) {
    rejected.osmDup += 1
    continue
  }
  kept.push(venue)
  if (kept.length >= TARGET) break
}

const catalog = kept.map(({ priority, hasStreet, kind, ...row }) => row)

const manifest = {
  source: 'OpenStreetMap Overpass',
  query: raw.query,
  fetchedAt: raw.fetchedAt,
  endpoint: raw.endpoint,
  rawElements: (raw.elements || []).length,
  target: TARGET,
  selected: catalog.length,
  curatedKeptSeparate: curatedBlocks.length,
  rejected,
  categories: catalog.reduce((acc, venue) => {
    acc[venue.category] = (acc[venue.category] || 0) + 1
    return acc
  }, {}),
}

writeFileSync(
  resolve(ROOT, 'supabase/seeds/seattle-osm-venues.json'),
  `${JSON.stringify({ manifest, venues: catalog }, null, 2)}\n`,
)

const values = catalog.map((venue) => `    (${sqlLiteral(venue.id)}::uuid, ${sqlLiteral(venue.name)}, ${venue.location_lat}, ${venue.location_lng}, ${sqlLiteral(venue.location_address)}, ${sqlLiteral(venue.neighborhood)}, ${sqlLiteral(venue.category)}, ${sqlLiteral(venue.phone)}, ${sqlLiteral(venue.website)}, ${sqlLiteral(venue.osmType)}, ${venue.osmId})`).join(',\n')

const sql = `-- Idempotent Seattle comprehensive OSM catalog.
-- Source: OpenStreetMap Overpass (${raw.fetchedAt || 'see seeds/seattle-osm-overpass.json'}).
-- ${catalog.length} nightlife-relevant venues. Does not invent names or street addresses.
-- Leaves curated-seed rows untouched (same UUIDs, inventory_source = curated-seed).
-- New rows use inventory_source = 'osm' and UUID v5(osm:type:id).

WITH catalog (
  id, name, location_lat, location_lng, location_address, neighborhood, category, phone, website, osm_type, osm_id
) AS (
  VALUES
${values}
),
updated AS (
  UPDATE venues v
  SET
    name = c.name,
    location_lat = c.location_lat,
    location_lng = c.location_lng,
    location_address = c.location_address,
    city = 'Seattle',
    state = 'WA',
    neighborhood = COALESCE(c.neighborhood, v.neighborhood),
    category = c.category,
    seeded = true,
    inventory_source = 'osm',
    phone = c.phone,
    website = c.website,
    pulse_score = CASE WHEN v.last_pulse_at IS NULL THEN 0 ELSE v.pulse_score END,
    score_velocity = CASE WHEN v.last_pulse_at IS NULL THEN 0 ELSE v.score_velocity END
  FROM catalog c
  WHERE v.deleted_at IS NULL
    AND v.inventory_source IS DISTINCT FROM 'curated-seed'
    AND (
      v.id = c.id
      OR (
        lower(v.name) = lower(c.name)
        AND lower(v.location_address) = lower(c.location_address)
        AND v.city = 'Seattle'
        AND v.state = 'WA'
      )
    )
  RETURNING v.id
)
INSERT INTO venues (
  id, name, location_lat, location_lng, location_address, city, state, neighborhood,
  category, pulse_score, score_velocity, seeded, inventory_source, phone, website
)
SELECT
  c.id, c.name, c.location_lat, c.location_lng, c.location_address, 'Seattle', 'WA', c.neighborhood,
  c.category, 0, 0, true, 'osm', c.phone, c.website
FROM catalog c
WHERE NOT EXISTS (
  SELECT 1
  FROM venues v
  WHERE v.id = c.id
     OR (
       lower(v.name) = lower(c.name)
       AND lower(v.location_address) = lower(c.location_address)
       AND v.city = 'Seattle'
       AND v.state = 'WA'
     )
);
`

writeFileSync(resolve(ROOT, 'supabase/migrations/20260909180000_seattle_osm_venue_catalog.sql'), sql)
writeFileSync(resolve(ROOT, 'supabase/seeds/seattle-osm-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)

console.log(JSON.stringify(manifest, null, 2))
console.log(`Wrote ${catalog.length} OSM venues`)
