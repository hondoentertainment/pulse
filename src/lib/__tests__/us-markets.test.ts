import { describe, expect, it } from 'vitest'
import { getMarketBrowseLocation, getUsMarkets, getVenuesForMarket } from '../us-markets'
import type { Venue } from '../types'

describe('US market selection', () => {
  it('centers a selected remote market without changing physical location', () => {
    const device = { lat: 47.6, lng: -122.3 }
    const miami = getUsMarkets([]).find(market => market.key === 'miami')!
    expect(getMarketBrowseLocation(miami, device)).toEqual({ lat: miami.lat, lng: miami.lng })
    expect(device).toEqual({ lat: 47.6, lng: -122.3 })
    expect(getMarketBrowseLocation(null, device)).toBe(device)
  })
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
