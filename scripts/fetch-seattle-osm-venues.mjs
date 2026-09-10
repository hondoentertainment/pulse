/**
 * Fetch nightlife-relevant Seattle POIs from OpenStreetMap Overpass.
 * Writes the raw Overpass JSON for the importer. Does not invent names.
 */
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]

// Seattle metro bbox (city + inner neighborhoods). Area queries returned 0 on
// overpass-api.de; bbox is the reliable public extract.
const BBOX = '47.495,-122.459,47.734,-122.224'
const QUERY = `
[out:json][timeout:180];
(
  nwr["amenity"~"^(bar|pub|nightclub|biergarten|hookah_lounge|stripclub|casino)$"](${BBOX});
  nwr["tourism"="nightclub"](${BBOX});
  nwr["leisure"="bowling_alley"](${BBOX});
  nwr["amenity"="music_venue"](${BBOX});
  nwr["amenity"="concert_hall"](${BBOX});
  nwr["craft"="brewery"](${BBOX});
  nwr["amenity"="brewery"](${BBOX});
  nwr["industrial"="brewery"](${BBOX});
  nwr["amenity"="restaurant"]["bar"="yes"](${BBOX});
  nwr["amenity"="restaurant"]["cocktails"="yes"](${BBOX});
  nwr["amenity"="restaurant"]["microbrewery"="yes"](${BBOX});
  nwr["amenity"="cafe"]["bar"="yes"](${BBOX});
);
out center tags;
`.trim()

const USER_AGENT = 'PulseSeattleVenueImport/1.0 (https://github.com/hondoentertainment/pulse)'

async function fetchOverpass(endpoint) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': USER_AGENT,
    },
    body: new URLSearchParams({ data: QUERY }),
  })
  if (!response.ok) {
    throw new Error(`${endpoint} returned ${response.status}`)
  }
  return response.json()
}

const outPath = new URL('../supabase/seeds/seattle-osm-overpass.json', import.meta.url)

for (const endpoint of OVERPASS_ENDPOINTS) {
  try {
    console.log(`Querying ${endpoint} …`)
    const data = await fetchOverpass(endpoint)
    const elements = Array.isArray(data.elements) ? data.elements : []
    console.log(`Received ${elements.length} elements`)
    const { writeFileSync, mkdirSync } = await import('node:fs')
    const { dirname } = await import('node:path')
    const { fileURLToPath } = await import('node:url')
    const dest = fileURLToPath(outPath)
    mkdirSync(dirname(dest), { recursive: true })
    writeFileSync(dest, JSON.stringify({
      fetchedAt: new Date().toISOString(),
      endpoint,
      query: QUERY,
      elements,
    }, null, 2))
    console.log(`Wrote ${dest}`)
    process.exit(0)
  } catch (error) {
    console.warn(`Failed ${endpoint}: ${error.message}`)
  }
}

console.error('All Overpass endpoints failed')
process.exit(1)
