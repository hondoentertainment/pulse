import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { patchCityCatalogVenues } from '../city-catalog-cache'
import type { Venue } from '../types'

function room(id: string, pulseScore: number): Venue {
  return {
    id,
    name: id,
    location: { lat: 47.6, lng: -122.3, address: '925 E Pike St' },
    city: 'Seattle',
    state: 'WA',
    pulseScore,
  }
}

describe('patchCityCatalogVenues', () => {
  it('writes live scores onto the city catalog cache', () => {
    const client = new QueryClient()
    client.setQueryData(['city-catalog', 'seattle'], {
      key: 'seattle',
      venues: [room('neumos', 0)],
      usedFallback: false,
    })
    client.setQueryData(['venues'], [room('ignored', 1)])

    patchCityCatalogVenues(client, (venues) => venues.map((venue) => (
      venue.id === 'neumos' ? { ...venue, pulseScore: 12, liveSummary: venue.liveSummary } : venue
    )))

    const catalog = client.getQueryData<{ venues: Venue[] }>(['city-catalog', 'seattle'])
    expect(catalog?.venues[0]?.pulseScore).toBe(12)
    expect(client.getQueryData<Venue[]>(['venues'])?.[0]?.pulseScore).toBe(1)
  })

  it('leaves the cache alone when the updater returns the same list', () => {
    const client = new QueryClient()
    const current = { key: 'seattle', venues: [room('neumos', 4)], usedFallback: false }
    client.setQueryData(['city-catalog', 'seattle'], current)
    patchCityCatalogVenues(client, (venues) => venues)
    expect(client.getQueryData(['city-catalog', 'seattle'])).toBe(current)
  })
})
