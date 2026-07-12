import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

const curated = [
  'venue-1', 'venue-3', 'venue-4', 'venue-13', 'venue-22', 'venue-12', 'venue-19', 'venue-17',
  'venue-2', 'venue-6', 'venue-7', 'venue-8', 'venue-14', 'venue-23', 'venue-27', 'venue-30',
  'venue-10', 'venue-11', 'venue-16', 'venue-31', 'venue-34', 'venue-36', 'venue-35', 'venue-38',
  'venue-18', 'venue-29', 'venue-21', 'venue-28', 'venue-49', 'venue-5',
]

const neighborhood = (addr) => {
  if (/Ballard Ave/i.test(addr)) return 'Ballard'
  if (/Fremont|N 34th|N 36th|Stone Way|Evanston/i.test(addr)) return 'Fremont'
  if (/E Pike|Broadway|Minor|Madison|E Denny|15th Ave E|Howell/i.test(addr)) return 'Capitol Hill'
  if (/1st Ave|2nd Ave|Western|Union St/i.test(addr) && !/1st Ave S/i.test(addr)) return 'Belltown'
  if (/Pine St|6th Ave|Cedar|Moore|Paramount/i.test(addr)) return 'Downtown'
  return 'Seattle'
}

const src = fs.readFileSync(path.join(root, 'src/lib/__fixtures__/mock-data.ts'), 'utf8')
const start = src.indexOf('const SEATTLE_VENUES: Venue[] = [')
const end = src.indexOf('const seattleWithCity')
const arrSrc = src.slice(start, end)

const venues = []
for (const id of curated) {
  const re = new RegExp(
    `id: '${id}'[\\s\\S]*?name: '([^']*(?:\\\\'[^']*)*)'[\\s\\S]*?lat: ([\\d.-]+),\\s*lng: ([\\d.-]+),\\s*address: '([^']+)'[\\s\\S]*?pulseScore: (\\d+)[\\s\\S]*?category: '([^']+)'`,
  )
  const m = arrSrc.match(re)
  if (!m) throw new Error(`missing venue ${id}`)
  const name = m[1].replace(/\\'/g, "'")
  venues.push({
    id,
    name,
    lat: Number(m[2]),
    lng: Number(m[3]),
    address: m[4],
    pulseScore: Number(m[5]),
    category: m[6],
    neighborhood: neighborhood(m[4]),
  })
}

const hoodEntries = venues.map((v) => `  '${v.id}': '${v.neighborhood}',`).join('\n')
const idList = venues.map((v) => `  '${v.id}',`).join('\n')
const venueObjs = venues
  .map(
    (v) => `  {
    id: '${v.id}',
    name: ${JSON.stringify(v.name)},
    location: { lat: ${v.lat}, lng: ${v.lng}, address: ${JSON.stringify(v.address)} },
    city: 'Seattle',
    state: 'WA',
    category: ${JSON.stringify(v.category)},
    pulseScore: ${v.pulseScore},
    seeded: true,
  }`,
  )
  .join(',\n')

const out = `import type { Venue } from '../types'

/** Curated Seattle beta inventory — PRD §3.1 (30 venues, 5 neighborhoods). */
export const SEATTLE_LAUNCH_NEIGHBORHOODS: Record<string, string> = {
${hoodEntries}
}

export const SEATTLE_LAUNCH_VENUE_IDS = [
${idList}
] as const

export const SEATTLE_LAUNCH_VENUES: Venue[] = [
${venueObjs},
]

export function getSeattleNeighborhood(venueId: string): string | undefined {
  return SEATTLE_LAUNCH_NEIGHBORHOODS[venueId]
}
`

fs.writeFileSync(path.join(root, 'src/lib/__fixtures__/seattle-launch-seed.ts'), out)
console.log(`Wrote ${venues.length} venues`)
