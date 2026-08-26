import { describe, expect, it } from 'vitest'
import {
  filterVenuesByLaunchedMarkets,
  isPointInLaunchedMarket,
  matchesLaunchedMarket,
  parseLaunchedCities,
} from '../geo-launch'

describe('parseLaunchedCities', () => {
  it('treats Seattle,WA as one market', () => {
    expect(parseLaunchedCities('Seattle,WA')).toEqual([
      { city: 'Seattle', state: 'WA', label: 'Seattle,WA' },
    ])
  })

  it('accepts a space after the comma', () => {
    expect(parseLaunchedCities('Seattle, WA')[0]).toMatchObject({ city: 'Seattle', state: 'WA' })
  })

  it('supports multiple markets separated by semicolons', () => {
    const markets = parseLaunchedCities('Seattle,WA;Portland,OR')
    expect(markets).toHaveLength(2)
    expect(markets[1]).toMatchObject({ city: 'Portland', state: 'OR' })
  })

  it('returns an empty allowlist when unset', () => {
    expect(parseLaunchedCities('')).toEqual([])
    expect(parseLaunchedCities(undefined)).toEqual([])
  })
})

describe('matchesLaunchedMarket', () => {
  const seattle = parseLaunchedCities('Seattle,WA')

  it('matches Seattle venues by city and state', () => {
    expect(matchesLaunchedMarket({ city: 'Seattle', state: 'WA' }, seattle)).toBe(true)
    expect(matchesLaunchedMarket({ city: 'Portland', state: 'OR' }, seattle)).toBe(false)
    expect(matchesLaunchedMarket({ city: 'WA' }, seattle)).toBe(false)
  })

  it('filters a mixed catalog down to launched markets only', () => {
    const venues = [
      { id: '1', city: 'Seattle', state: 'WA' },
      { id: '2', city: 'New York', state: 'NY' },
    ]
    expect(filterVenuesByLaunchedMarkets(venues, seattle).map((venue) => venue.id)).toEqual(['1'])
  })

  it('gates a user whose nearest city is outside the launch set', () => {
    expect(isPointInLaunchedMarket('Seattle, WA', seattle)).toBe(true)
    expect(isPointInLaunchedMarket('Austin, TX', seattle)).toBe(false)
  })
})
