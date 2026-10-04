import { describe, expect, it } from 'vitest'
import { hasValidCatalogCoords, reportCatalogQuality } from '../catalog-quality'
import { neighborhoodSlug, SEATTLE_TAGGED_NEIGHBORHOODS } from '../neighborhood-slugs'
import {
  SAN_FRANCISCO_LAUNCH_MAX_VENUES,
  SAN_FRANCISCO_LAUNCH_MIN_VENUES,
  SAN_FRANCISCO_LAUNCH_NEIGHBORHOODS,
  SAN_FRANCISCO_LAUNCH_VENUES,
  assertSanFranciscoLaunchInventory,
} from '../san-francisco-launch-venues'

describe('San Francisco launch inventory', () => {
  it('contains 25-40 curated rooms and no other California city', () => {
    expect(SAN_FRANCISCO_LAUNCH_VENUES.length).toBeGreaterThanOrEqual(SAN_FRANCISCO_LAUNCH_MIN_VENUES)
    expect(SAN_FRANCISCO_LAUNCH_VENUES.length).toBeLessThanOrEqual(SAN_FRANCISCO_LAUNCH_MAX_VENUES)
    expect(() => assertSanFranciscoLaunchInventory()).not.toThrow()
    const hoods = new Set(SAN_FRANCISCO_LAUNCH_VENUES.map((venue) => venue.neighborhood))
    expect([...hoods].sort()).toEqual([...SAN_FRANCISCO_LAUNCH_NEIGHBORHOODS].sort())
    const seattleSlugs = new Set(SEATTLE_TAGGED_NEIGHBORHOODS.map((name) => neighborhoodSlug(name)))
    for (const venue of SAN_FRANCISCO_LAUNCH_VENUES) {
      expect(venue.city).toBe('San Francisco')
      expect(venue.state).toBe('CA')
      expect(venue.pulseScore).toBe(0)
      expect(venue.inventorySource).toBe('curated-seed')
      expect(venue.imageUrl).toBeUndefined()
      expect(venue.location.address).toContain('San Francisco, CA')
      expect(hasValidCatalogCoords(venue)).toBe(true)
      expect(seattleSlugs.has(neighborhoodSlug(venue.neighborhood))).toBe(false)
    }
    const report = reportCatalogQuality(SAN_FRANCISCO_LAUNCH_VENUES)
    expect(report.rankable).toBe(SAN_FRANCISCO_LAUNCH_VENUES.length)
  })
})
