import { describe, expect, it } from 'vitest'
import { getUsMarkets, getVenuesForMarket } from '../us-markets'
import type { Venue } from '../types'

describe('US market selection', () => {
  it('keeps cities selectable when the backend has no listings there', () => {
    const miami = getUsMarkets([]).find(market => market.key === 'miami')
    expect(miami).toMatchObject({ city: 'Miami', state: 'FL', venueCount: 0 })
    expect(getVenuesForMarket([], miami!)).toEqual([])
  })
  it('counts and filters backend venues by city and state', () => {
    const venues = [
      { id: 'mia', city: 'Miami', state: 'FL' },
      { id: 'sea', city: 'Seattle', state: 'WA' },
    ] as Venue[]
    const miami = getUsMarkets(venues).find(market => market.key === 'miami')!
    expect(miami.venueCount).toBe(1)
    expect(getVenuesForMarket(venues, miami).map(venue => venue.id)).toEqual(['mia'])
  })
})
