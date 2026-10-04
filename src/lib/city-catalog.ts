/**
 * One city catalog at a time.
 * Curated seeds paint first. A larger catalog (Seattle OSM, or a later fill)
 * is merged in but stays out of the first map pass via partitionColdStartCatalog.
 */

import type { CoastCityKey } from './coast-cities'
import { coastCityByKey } from './coast-cities'
import { localLaunchVenueIdForShareId } from './seattle-launch-venues'
import { partitionColdStartCatalog } from './cold-start'
import type { Venue } from './types'
import { hasSupabaseConfig } from './supabase'
import { fetchVenuesForCity, fetchVenuesFromSupabase } from './supabase-api'

export interface CityCatalogLoad {
  key: CoastCityKey
  venues: Venue[]
  /** Seattle server miss only. Portland/SF curated seeds are the catalog, not a fallback. */
  usedFallback: boolean
}

export interface CityCatalogDeps {
  hasServer?: boolean
  loadCurated?: (key: CoastCityKey) => Promise<Venue[]>
  fetchSeattle?: () => Promise<Venue[] | null>
  fetchCity?: (city: string, state: string) => Promise<Venue[] | null>
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function sameMarket(venue: Pick<Venue, 'city' | 'state'>, city: string, state: string): boolean {
  return (venue.city ?? '').trim().toLowerCase() === city.trim().toLowerCase()
    && (venue.state ?? '').trim().toLowerCase() === state.trim().toLowerCase()
}

/** Server rows win on name so live scores stay. Curated rooms the server lacks are added. */
export function mergeCuratedWithServer(curated: readonly Venue[], server: readonly Venue[]): Venue[] {
  const keys = new Set(server.map((venue) => `${normalizeName(venue.name)}|${(venue.city ?? '').toLowerCase()}`))
  const extras = curated.filter((venue) => !keys.has(`${normalizeName(venue.name)}|${(venue.city ?? '').toLowerCase()}`))
  return [...server, ...extras]
}

export function coastCityKeyForVenueId(id: string | null | undefined): CoastCityKey | null {
  const raw = (id ?? '').trim()
  if (!raw) return null
  if (raw.startsWith('pdx-')) return 'portland'
  if (raw.startsWith('sf-')) return 'san-francisco'
  if (raw.startsWith('sea-') || raw.startsWith('venue-') || localLaunchVenueIdForShareId(raw)) return 'seattle'
  return null
}

export async function loadCityCuratedCatalog(key: CoastCityKey): Promise<Venue[]> {
  switch (key) {
    case 'seattle': {
      const mod = await import('./seattle-launch-venues')
      return mod.getSeattleLaunchVenues()
    }
    case 'portland': {
      const mod = await import('./portland-launch-venues')
      return mod.getPortlandLaunchVenues()
    }
    case 'san-francisco': {
      const mod = await import('./san-francisco-launch-venues')
      return mod.getSanFranciscoLaunchVenues()
    }
  }
}

/**
 * Load one city's rooms. Does not import or query the other cities.
 * Seattle still uses the existing live-intelligence read, then drops any row
 * that is not Seattle. Portland and San Francisco use a city-scoped query
 * and the curated seed when that query is empty.
 */
export async function loadCityCatalog(
  key: CoastCityKey,
  deps: CityCatalogDeps = {},
): Promise<CityCatalogLoad> {
  const city = coastCityByKey(key)
  if (!city) return { key, venues: [], usedFallback: false }

  const loadCurated = deps.loadCurated ?? loadCityCuratedCatalog
  const curated = await loadCurated(key)
  const hasServer = deps.hasServer ?? hasSupabaseConfig
  if (!hasServer) return { key, venues: curated, usedFallback: false }

  if (key === 'seattle') {
    const fetchSeattle = deps.fetchSeattle ?? fetchVenuesFromSupabase
    const server = await fetchSeattle()
    const scoped = (server ?? []).filter((venue) => sameMarket(venue, city.city, city.state))
    if (!server || scoped.length === 0) {
      return { key, venues: curated, usedFallback: true }
    }
    return { key, venues: mergeCuratedWithServer(curated, scoped), usedFallback: false }
  }

  const fetchCity = deps.fetchCity ?? fetchVenuesForCity
  const server = await fetchCity(city.city, city.state)
  const scoped = (server ?? []).filter((venue) => sameMarket(venue, city.city, city.state))
  if (scoped.length === 0) return { key, venues: curated, usedFallback: false }
  return { key, venues: mergeCuratedWithServer(curated, scoped), usedFallback: false }
}

export function cityColdStartSplit<T extends Pick<Venue, 'inventorySource' | 'seeded'>>(venues: readonly T[]) {
  return partitionColdStartCatalog(venues)
}
