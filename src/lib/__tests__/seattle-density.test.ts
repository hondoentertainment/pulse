import { describe, expect, it } from 'vitest'
import { densityRankBoost, isDensityNeighborhood, normalizeNeighborhoodName } from '../seattle-density'

describe('Seattle density', () => {
  it('treats Ballard, Georgetown, and SoDo like Capitol Hill', () => {
    expect(isDensityNeighborhood('Capitol Hill')).toBe(true)
    expect(isDensityNeighborhood('Ballard')).toBe(true)
    expect(isDensityNeighborhood('Georgetown')).toBe(true)
    expect(isDensityNeighborhood('sodo')).toBe(true)
    expect(isDensityNeighborhood('Fremont')).toBe(false)
    expect(normalizeNeighborhoodName('SODO')).toBe('SoDo')
  })

  it('gives density hoods a Launch-33-style curated boost', () => {
    const ballard = densityRankBoost({
      neighborhood: 'Ballard',
      inventorySource: 'curated-seed',
      seeded: true,
      claimVerified: true,
    })
    const random = densityRankBoost({ neighborhood: 'Lake City', inventorySource: 'osm' })
    expect(ballard).toBeGreaterThan(random)
    expect(random).toBe(0)
  })
})
