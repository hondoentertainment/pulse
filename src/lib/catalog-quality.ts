/**
 * Catalog quality helpers — neighborhood labels, curated vs OSM soft-dedupe,
 * and hide obviously bad pins from Tonight ranking.
 *
 * Prefer filtering in UI / ranking over mass prod mutations.
 */

import type { Venue } from './types'
import { calculateDistance } from './pulse-engine'
import { isCuratedVenue } from './map-filters'

export const BAD_PIN_MIN_LAT = 47.4
export const BAD_PIN_MAX_LAT = 47.8
export const BAD_PIN_MIN_LNG = -122.5
export const BAD_PIN_MAX_LNG = -122.2
export const OSM_DEDUPE_MILES = 0.04

const GENERIC_NAMES = new Set([
  'bar',
  'pub',
  'club',
  'nightclub',
  'restaurant',
  'venue',
  'unnamed',
])

export function hasValidSeattleCoords(venue: Pick<Venue, 'location'>): boolean {
  const lat = venue.location?.lat
  const lng = venue.location?.lng
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false
  if (lat === 0 && lng === 0) return false
  return lat >= BAD_PIN_MIN_LAT && lat <= BAD_PIN_MAX_LAT
    && lng >= BAD_PIN_MIN_LNG && lng <= BAD_PIN_MAX_LNG
}

export function isGenericVenueName(name: string | undefined): boolean {
  const normalized = (name ?? '').trim().toLowerCase()
  if (!normalized) return true
  return GENERIC_NAMES.has(normalized)
}

export function inventoryLabel(venue: Pick<Venue, 'inventorySource' | 'seeded'>): string {
  return isCuratedVenue(venue) ? 'Launch 33' : 'All Seattle'
}

export function catalogQualityLine(venue: Pick<Venue, 'neighborhood' | 'city' | 'inventorySource' | 'seeded'>): string | null {
  const hood = neighborhoodTag(venue)
  const source = inventoryLabel(venue)
  return [hood, source].filter(Boolean).join(' · ') || null
}

export function neighborhoodTag(venue: Pick<Venue, 'neighborhood' | 'city'>): string | null {
  const hood = venue.neighborhood?.trim()
  if (hood) return hood
  const city = venue.city?.trim()
  return city || null
}

export function isObviouslyBadPin(venue: Venue): boolean {
  if (!hasValidSeattleCoords(venue)) return true
  if (isGenericVenueName(venue.name)) return true
  return false
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

export function isSoftDuplicateOfCurated(
  venue: Venue,
  curated: Venue[],
  maxMiles: number = OSM_DEDUPE_MILES,
): boolean {
  if (isCuratedVenue(venue)) return false
  const name = normalizeName(venue.name)
  if (!name) return false
  return curated.some((seed) => {
    const seedName = normalizeName(seed.name)
    if (!seedName) return false
    const closeName = name === seedName || name.includes(seedName) || seedName.includes(name)
    if (!closeName) return false
    const miles = calculateDistance(
      venue.location.lat,
      venue.location.lng,
      seed.location.lat,
      seed.location.lng,
    )
    return miles <= maxMiles
  })
}

export function filterTonightCatalog(venues: Venue[]): Venue[] {
  const curated = venues.filter((venue) => isCuratedVenue(venue) && hasValidSeattleCoords(venue))
  return venues.filter((venue) => {
    if (isObviouslyBadPin(venue)) return false
    if (isSoftDuplicateOfCurated(venue, curated)) return false
    return true
  })
}

export interface CatalogQualityReport {
  total: number
  rankable: number
  hiddenBadPins: number
  hiddenOsmDupes: number
  missingNeighborhood: number
}

export function reportCatalogQuality(venues: Venue[]): CatalogQualityReport {
  const curated = venues.filter((venue) => isCuratedVenue(venue) && hasValidSeattleCoords(venue))
  let hiddenBadPins = 0
  let hiddenOsmDupes = 0
  let missingNeighborhood = 0
  for (const venue of venues) {
    if (isObviouslyBadPin(venue)) {
      hiddenBadPins += 1
      continue
    }
    if (isSoftDuplicateOfCurated(venue, curated)) hiddenOsmDupes += 1
    if (!neighborhoodTag(venue)) missingNeighborhood += 1
  }
  return {
    total: venues.length,
    rankable: filterTonightCatalog(venues).length,
    hiddenBadPins,
    hiddenOsmDupes,
    missingNeighborhood,
  }
}
