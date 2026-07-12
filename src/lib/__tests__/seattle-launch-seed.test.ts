import { describe, it, expect } from 'vitest'
import { SEATTLE_LAUNCH_VENUES, SEATTLE_LAUNCH_NEIGHBORHOODS } from '../__fixtures__/seattle-launch-seed'

describe('seattle-launch-seed', () => {
  it('curates 25-40 Seattle venues', () => {
    expect(SEATTLE_LAUNCH_VENUES.length).toBeGreaterThanOrEqual(25)
    expect(SEATTLE_LAUNCH_VENUES.length).toBeLessThanOrEqual(40)
  })

  it('covers at least 5 neighborhoods', () => {
    const neighborhoods = new Set(Object.values(SEATTLE_LAUNCH_NEIGHBORHOODS))
    expect(neighborhoods.size).toBeGreaterThanOrEqual(5)
  })

  it('marks venues as Seattle seeded inventory', () => {
    for (const venue of SEATTLE_LAUNCH_VENUES) {
      expect(venue.city).toBe('Seattle')
      expect(venue.state).toBe('WA')
      expect(venue.seeded).toBe(true)
    }
  })
})
