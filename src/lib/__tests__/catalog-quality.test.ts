import { describe, expect, it } from 'vitest'
import type { Venue } from '../types'
import {
  catalogQualityLine,
  filterTonightCatalog,
  inventoryLabel,
  isObviouslyBadPin,
  isSoftDuplicateOfCurated,
  reportCatalogQuality,
} from '../catalog-quality'

function makeVenue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: 'v1',
    name: 'Neumos',
    location: { lat: 47.6145, lng: -122.3205, address: 'Pike' },
    pulseScore: 0,
    inventorySource: 'curated-seed',
    seeded: true,
    neighborhood: 'Capitol Hill',
    ...overrides,
  }
}

describe('catalog quality', () => {
  it('hides bad pins and OSM duplicates of Launch 33', () => {
    const curated = makeVenue()
    const osmDup = makeVenue({
      id: 'osm-neumos',
      inventorySource: 'osm',
      seeded: false,
      location: { lat: 47.6146, lng: -122.3206, address: 'Pike' },
    })
    const bad = makeVenue({
      id: 'bad',
      name: 'Bar',
      location: { lat: 0, lng: 0, address: '' },
    })
    expect(isObviouslyBadPin(bad)).toBe(true)
    expect(isSoftDuplicateOfCurated(osmDup, [curated])).toBe(true)
    expect(filterTonightCatalog([curated, osmDup, bad])).toEqual([curated])
    expect(inventoryLabel(curated)).toBe('Launch 33')
    expect(inventoryLabel(osmDup)).toBe('All Seattle')
    expect(catalogQualityLine(curated)).toBe('Capitol Hill · Launch 33')
    expect(catalogQualityLine(osmDup)).toBe('Capitol Hill · All Seattle')
    expect(reportCatalogQuality([curated, osmDup, bad]).hiddenOsmDupes).toBe(1)
  })
})
