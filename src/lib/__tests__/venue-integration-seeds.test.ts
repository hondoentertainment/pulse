import { describe, expect, it } from 'vitest'
import { applyVenueIntegrationSeeds } from '../venue-integration-seeds'
import type { Venue } from '../types'

describe('applyVenueIntegrationSeeds', () => {
  it('enriches known venues with integration metadata', () => {
    const venues: Venue[] = [
      {
        id: 'venue-1',
        name: 'Neumos',
        location: { lat: 47.6145, lng: -122.3205, address: '925 E Pike St, Seattle, WA' },
        city: 'Seattle',
        state: 'WA',
        pulseScore: 85,
        category: 'Music Venue',
      },
    ]

    const [venue] = applyVenueIntegrationSeeds(venues)
    expect(venue.integrations?.music?.spotifyUrl).toContain('open.spotify.com')
    expect(venue.integrations?.maps?.googleMapsUrl).toContain('google.com/maps')
  })
})
