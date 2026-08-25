import { describe, expect, it } from 'vitest'
import {
  SEATTLE_LAUNCH_MAX_VENUES,
  SEATTLE_LAUNCH_MIN_VENUES,
  SEATTLE_LAUNCH_NEIGHBORHOODS,
  SEATTLE_LAUNCH_VENUES,
  assertSeattleLaunchInventory,
  getSeattleLaunchNeighborhoodCoverage,
} from '../seattle-launch-venues'

describe('Seattle launch inventory', () => {
  it('contains 25-40 curated venues', () => {
    expect(SEATTLE_LAUNCH_VENUES.length).toBeGreaterThanOrEqual(SEATTLE_LAUNCH_MIN_VENUES)
    expect(SEATTLE_LAUNCH_VENUES.length).toBeLessThanOrEqual(SEATTLE_LAUNCH_MAX_VENUES)
    expect(() => assertSeattleLaunchInventory()).not.toThrow()
  })

  it('seeds Capitol Hill, Belltown, Fremont, Ballard, and Downtown', () => {
    const coverage = getSeattleLaunchNeighborhoodCoverage()
    for (const neighborhood of SEATTLE_LAUNCH_NEIGHBORHOODS) {
      expect(coverage[neighborhood]).toBeGreaterThanOrEqual(4)
    }
  })

  it('marks every listing as curated seed with no invented live reports', () => {
    for (const venue of SEATTLE_LAUNCH_VENUES) {
      expect(venue.city).toBe('Seattle')
      expect(venue.state).toBe('WA')
      expect(venue.seeded).toBe(true)
      expect(venue.inventorySource).toBe('curated-seed')
      expect(venue.pulseScore).toBe(0)
      expect(venue.lastPulseAt).toBeUndefined()
      expect(venue.liveSummary).toBeUndefined()
    }
  })
})
