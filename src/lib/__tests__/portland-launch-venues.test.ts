import { describe, expect, it } from 'vitest'
import { hasValidCatalogCoords, reportCatalogQuality } from '../catalog-quality'
import { neighborhoodSlug } from '../neighborhood-slugs'
import { SEATTLE_TAGGED_NEIGHBORHOODS } from '../neighborhood-slugs'
import {
  PORTLAND_LAUNCH_MAX_VENUES,
  PORTLAND_LAUNCH_MIN_VENUES,
  PORTLAND_LAUNCH_NEIGHBORHOODS,
  PORTLAND_LAUNCH_VENUES,
  assertPortlandLaunchInventory,
} from '../portland-launch-venues'

describe('Portland launch inventory', () => {
  it('contains 25-40 curated rooms with real neighborhoods and no photos', () => {
    expect(PORTLAND_LAUNCH_VENUES.length).toBeGreaterThanOrEqual(PORTLAND_LAUNCH_MIN_VENUES)
    expect(PORTLAND_LAUNCH_VENUES.length).toBeLessThanOrEqual(PORTLAND_LAUNCH_MAX_VENUES)
    expect(() => assertPortlandLaunchInventory()).not.toThrow()
    const hoods = new Set(PORTLAND_LAUNCH_VENUES.map((venue) => venue.neighborhood))
    expect([...hoods].sort()).toEqual([...PORTLAND_LAUNCH_NEIGHBORHOODS].sort())
    const seattleSlugs = new Set(SEATTLE_TAGGED_NEIGHBORHOODS.map((name) => neighborhoodSlug(name)))
    for (const venue of PORTLAND_LAUNCH_VENUES) {
      expect(venue.city).toBe('Portland')
      expect(venue.state).toBe('OR')
      expect(venue.pulseScore).toBe(0)
      expect(venue.inventorySource).toBe('curated-seed')
      expect(venue.imageUrl).toBeUndefined()
      expect(hasValidCatalogCoords(venue)).toBe(true)
      expect(seattleSlugs.has(neighborhoodSlug(venue.neighborhood))).toBe(false)
    }
    const report = reportCatalogQuality(PORTLAND_LAUNCH_VENUES)
    expect(report.hiddenBadPins).toBe(0)
    expect(report.rankable).toBe(PORTLAND_LAUNCH_VENUES.length)
  })
})
