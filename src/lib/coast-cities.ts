/**
 * West Coast index. The map and Tonight open one of these cities at a time.
 * Seattle stays the default. Los Angeles, San Diego, and the rest of California
 * are not on this index.
 */

import { matchesLaunchedMarket, type LaunchedMarket } from './geo-launch'
import { resolveTaggedNeighborhoodPage } from './neighborhood-slugs.js'

export const COAST_CITY_KEYS = ['seattle', 'portland', 'san-francisco'] as const

export type CoastCityKey = (typeof COAST_CITY_KEYS)[number]

export interface CoastCity {
  key: CoastCityKey
  city: string
  state: string
  /** "Seattle, WA" — market selector / location label. */
  name: string
  /** "Seattle,WA" — geo-gate token. */
  label: string
  lat: number
  lng: number
  curatedLabel: string
  allLabel: string
}

export const DEFAULT_COAST_CITY_KEY: CoastCityKey = 'seattle'

/**
 * Value an operator can put in `VITE_LAUNCHED_CITIES` to open the coast.
 * Empty env stays "no gate" — this string is not the default.
 */
export const COAST_LAUNCH_CITIES_ENV = 'Seattle,WA;Portland,OR;San Francisco,CA'

export const COAST_CITIES: readonly CoastCity[] = [
  {
    key: 'seattle',
    city: 'Seattle',
    state: 'WA',
    name: 'Seattle, WA',
    label: 'Seattle,WA',
    lat: 47.6145,
    lng: -122.3205,
    curatedLabel: 'Launch 33',
    allLabel: 'All Seattle',
  },
  {
    key: 'portland',
    city: 'Portland',
    state: 'OR',
    name: 'Portland, OR',
    label: 'Portland,OR',
    lat: 45.5231,
    lng: -122.6765,
    curatedLabel: 'Curated Portland',
    allLabel: 'All Portland',
  },
  {
    key: 'san-francisco',
    city: 'San Francisco',
    state: 'CA',
    name: 'San Francisco, CA',
    label: 'San Francisco,CA',
    lat: 37.7749,
    lng: -122.4194,
    curatedLabel: 'Curated San Francisco',
    allLabel: 'All San Francisco',
  },
]

const KEY_ALIASES: Record<string, CoastCityKey> = {
  seattle: 'seattle',
  portland: 'portland',
  'san-francisco': 'san-francisco',
  sanfrancisco: 'san-francisco',
  sf: 'san-francisco',
}

export function coastCityByKey(key: string | null | undefined): CoastCity | null {
  const resolved = aliasCoastCityKey(key)
  if (!resolved) return null
  return COAST_CITIES.find((city) => city.key === resolved) ?? null
}

export function aliasCoastCityKey(key: string | null | undefined): CoastCityKey | null {
  const normalized = (key ?? '').trim().toLowerCase()
  return KEY_ALIASES[normalized] ?? null
}

/** Empty gate → all three coast cities. A set gate keeps only matching markets. */
export function listSelectableCoastCities(markets: readonly LaunchedMarket[]): CoastCity[] {
  if (markets.length === 0) return [...COAST_CITIES]
  return COAST_CITIES.filter((city) => matchesLaunchedMarket(city, markets))
}

export function resolveSelectedCoastCity(
  key: string | null | undefined,
  cities: readonly CoastCity[] = COAST_CITIES,
): CoastCity {
  const alias = aliasCoastCityKey(key)
  const found = alias ? cities.find((city) => city.key === alias) : undefined
  if (found) return found
  return cities.find((city) => city.key === DEFAULT_COAST_CITY_KEY)
    ?? cities[0]
    ?? COAST_CITIES[0]
}

export function coastInventoryLabels(city?: string | null): { curated: string; all: string } {
  const key = (city ?? '').trim().toLowerCase()
  const match = COAST_CITIES.find((entry) => entry.city.toLowerCase() === key)
  if (match) return { curated: match.curatedLabel, all: match.allLabel }
  return { curated: 'Launch 33', all: 'All Seattle' }
}

/** Hood slug → the one coast city that owns it. Unknown slugs stay unresolved. */
export function coastCityKeyForNeighborhoodSlug(slug: string | null | undefined): CoastCityKey | null {
  const page = resolveTaggedNeighborhoodPage(slug ?? '')
  if (!page) return null
  const city = COAST_CITIES.find((entry) => entry.city === page.city)
  return city?.key ?? null
}
