import type { AccessibilityFeature, Venue } from './types'
import { calculateDistance } from './pulse-engine'
import { LAUNCH_33_CENTER } from './neighborhood-geo'

export type EnergyFilter = 'all' | 'dead' | 'chill' | 'buzzing' | 'electric'
export type DistanceFilter = 0.3 | 0.6 | 1.2 | 3.1 | typeof Infinity
export type MapInventoryLayer = 'curated' | 'all'

export interface MapFiltersState {
  energyLevels: EnergyFilter[]
  categories: string[]
  maxDistance: DistanceFilter
  neighborhoods?: string[]
  inventoryLayer?: MapInventoryLayer
  accessibilityFeatures?: AccessibilityFeature[]
}

export function isCuratedVenue(venue: Pick<Venue, 'inventorySource' | 'seeded'>): boolean {
  if (venue.inventorySource === 'curated-seed') return true
  if (venue.inventorySource === 'osm') return false
  return venue.seeded === true
}

/**
 * Map pill thresholds — keep in sync with InteractiveMap energy chips.
 * Slightly hotter than getEnergyLabel (75/50/25) so Electric/Buzzing
 * pills stay selective on a 533-venue catalog.
 */
export function energyLevelFromPulseScore(score: number): Exclude<EnergyFilter, 'all'> {
  if (score >= 80) return 'electric'
  if (score >= 60) return 'buzzing'
  if (score >= 30) return 'chill'
  return 'dead'
}

export interface FilterMapVenuesInput {
  venues: Venue[]
  filters: Pick<MapFiltersState, 'energyLevels' | 'categories' | 'neighborhoods' | 'inventoryLayer' | 'maxDistance'>
  userLocation: { lat: number; lng: number } | null
  nearMe?: boolean
  nearMeMiles?: number
}

export function filterMapVenues(input: FilterMapVenuesInput): Venue[] {
  const {
    venues,
    filters,
    userLocation,
    nearMe = false,
    nearMeMiles = 0.5,
  } = input
  const neighborhoods = filters.neighborhoods ?? []
  const layer = filters.inventoryLayer ?? 'curated'

  return venues.filter((venue) => {
    if (layer === 'curated' && !isCuratedVenue(venue)) return false

    if (filters.energyLevels.length > 0) {
      const energyLevel = energyLevelFromPulseScore(venue.pulseScore)
      if (!filters.energyLevels.includes(energyLevel)) return false
    }

    if (filters.categories.length > 0 && venue.category) {
      if (!filters.categories.includes(venue.category)) return false
    }

    if (neighborhoods.length > 0) {
      const neighborhood = (venue.neighborhood ?? '').trim()
      if (!neighborhood || !neighborhoods.includes(neighborhood)) return false
    }

    const nearOrigin = userLocation ?? (nearMe ? LAUNCH_33_CENTER : null)
    if ((filters.maxDistance !== Infinity || nearMe) && nearOrigin) {
      const distance = calculateDistance(
        nearOrigin.lat,
        nearOrigin.lng,
        venue.location.lat,
        venue.location.lng,
      )
      if (filters.maxDistance !== Infinity && distance > filters.maxDistance) return false
      if (nearMe && distance > nearMeMiles) return false
    }

    return true
  })
}

export function collectNeighborhoods(venues: Venue[]): string[] {
  const names = new Set<string>()
  for (const venue of venues) {
    const name = venue.neighborhood?.trim()
    if (name) names.add(name)
  }
  return [...names].sort((a, b) => a.localeCompare(b))
}

export function shouldClusterMapMarkers(params: {
  zoom: number
  isDragging: boolean
  inventoryLayer: MapInventoryLayer
}): boolean {
  if (params.isDragging) return false
  const threshold = params.inventoryLayer === 'all' ? 1.8 : 1.05
  return params.zoom < threshold
}
