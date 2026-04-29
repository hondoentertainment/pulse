import { US_CITY_LOCATIONS } from './us-venues'
import type { Venue } from './types'

export const ALL_US_MARKETS_KEY = 'all'

export interface UsMarket {
  key: string
  name: string
  city: string
  state: string
  lat: number
  lng: number
  venueCount: number
}

function parseMarketName(name: string) {
  const [city, state = ''] = name.split(',').map(part => part.trim())
  return { city, state }
}

export function getUsMarkets(venues: Venue[]): UsMarket[] {
  const venueCounts = venues.reduce<Record<string, number>>((acc, venue) => {
    if (!venue.city || !venue.state) return acc
    const key = `${venue.city}, ${venue.state}`.toLowerCase()
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})

  return Object.entries(US_CITY_LOCATIONS)
    .map(([key, location]) => {
      const { city, state } = parseMarketName(location.name)
      return {
        key,
        name: location.name,
        city,
        state,
        lat: location.lat,
        lng: location.lng,
        venueCount: venueCounts[location.name.toLowerCase()] ?? 0,
      }
    })
    .filter(market => market.venueCount > 0 || market.key === 'seattle')
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function getMarketByKey(markets: UsMarket[], key: string): UsMarket | null {
  return markets.find(market => market.key === key) ?? null
}

export function getVenuesForMarket(venues: Venue[], market: UsMarket | null): Venue[] {
  if (!market) return venues
  return venues.filter(venue => venue.city === market.city && venue.state === market.state)
}
