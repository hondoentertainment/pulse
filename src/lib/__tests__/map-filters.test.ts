import { describe, expect, it } from 'vitest'
import type { Venue } from '../types'
import {
  collectNeighborhoods,
  energyLevelFromPulseScore,
  filterMapVenues,
  isCuratedVenue,
  shouldClusterMapMarkers,
} from '../map-filters'

function makeVenue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: overrides.id ?? 'v1',
    name: overrides.name ?? 'Venue',
    location: overrides.location ?? { lat: 47.61, lng: -122.33, address: 'Seattle' },
    pulseScore: overrides.pulseScore ?? 40,
    ...overrides,
  }
}

const capitolCurated = makeVenue({
  id: 'curated-1',
  neighborhood: 'Capitol Hill',
  inventorySource: 'curated-seed',
  seeded: true,
  pulseScore: 40,
  category: 'Bar',
})
const ballardOsm = makeVenue({
  id: 'osm-1',
  neighborhood: 'Ballard',
  inventorySource: 'osm',
  seeded: true,
  pulseScore: 20,
  category: 'Bar',
  location: { lat: 47.67, lng: -122.38, address: 'Ballard' },
})
const belltownOsmHot = makeVenue({
  id: 'osm-2',
  neighborhood: 'Belltown',
  inventorySource: 'osm',
  pulseScore: 90,
  category: 'Nightclub',
  location: { lat: 47.70, lng: -122.40, address: 'Belltown' },
})

const emptyFilters = {
  energyLevels: [] as const,
  categories: [] as string[],
  neighborhoods: [] as string[],
  inventoryLayer: 'curated' as const,
  maxDistance: Infinity,
}

describe('isCuratedVenue', () => {
  it('treats curated-seed as curated and osm as not', () => {
    expect(isCuratedVenue({ inventorySource: 'curated-seed' })).toBe(true)
    expect(isCuratedVenue({ inventorySource: 'osm', seeded: true })).toBe(false)
    expect(isCuratedVenue({ seeded: true })).toBe(true)
  })
})

describe('energyLevelFromPulseScore', () => {
  it('uses map-pill thresholds', () => {
    expect(energyLevelFromPulseScore(80)).toBe('electric')
    expect(energyLevelFromPulseScore(60)).toBe('buzzing')
    expect(energyLevelFromPulseScore(30)).toBe('chill')
    expect(energyLevelFromPulseScore(10)).toBe('dead')
  })
})

describe('filterMapVenues', () => {
  const venues = [capitolCurated, ballardOsm, belltownOsmHot]

  it('defaults to curated-only so launch venues stay prominent', () => {
    const result = filterMapVenues({ venues, filters: emptyFilters, userLocation: null })
    expect(result.map((v) => v.id)).toEqual(['curated-1'])
  })

  it('includes OSM when the all layer is selected', () => {
    const result = filterMapVenues({
      venues,
      filters: { ...emptyFilters, inventoryLayer: 'all' },
      userLocation: null,
    })
    expect(result.map((v) => v.id).sort()).toEqual(['curated-1', 'osm-1', 'osm-2'])
  })

  it('filters by neighborhood and energy', () => {
    const result = filterMapVenues({
      venues,
      filters: {
        ...emptyFilters,
        inventoryLayer: 'all',
        neighborhoods: ['Belltown', 'Capitol Hill'],
        energyLevels: ['electric'],
      },
      userLocation: null,
    })
    expect(result.map((v) => v.id)).toEqual(['osm-2'])
  })

  it('applies near-me radius when location is known', () => {
    const result = filterMapVenues({
      venues,
      filters: { ...emptyFilters, inventoryLayer: 'all' },
      userLocation: { lat: 47.61, lng: -122.33 },
      nearMe: true,
      nearMeMiles: 1,
    })
    expect(result.map((v) => v.id)).toEqual(['curated-1'])
  })
})

describe('collectNeighborhoods / shouldClusterMapMarkers', () => {
  it('lists unique neighborhoods', () => {
    expect(collectNeighborhoods([capitolCurated, ballardOsm, capitolCurated])).toEqual([
      'Ballard',
      'Capitol Hill',
    ])
  })

  it('clusters sooner on the all-Seattle layer', () => {
    expect(shouldClusterMapMarkers({ zoom: 1.4, isDragging: false, inventoryLayer: 'all' })).toBe(true)
    expect(shouldClusterMapMarkers({ zoom: 1.4, isDragging: false, inventoryLayer: 'curated' })).toBe(false)
    expect(shouldClusterMapMarkers({ zoom: 0.9, isDragging: true, inventoryLayer: 'all' })).toBe(false)
  })
})
