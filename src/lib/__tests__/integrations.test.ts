import { describe, it, expect } from 'vitest'
import {
  generateRideshareLink,
  getBestRideshareOption,
  createSpotifyNowPlaying,
  formatSpotifyDisplay,
  createReservationLink,
  getVenueReservationLinks,
  getAvailableReservations,
  generateMapsEnergyLayer,
  getShortcutActions,
  executeShortcut,
  getIntegrationStatus,
  getVenueIntegrationAvailability,
  launchIntegrationUrl,
  getVenueMusicUrl,
  getVenueNowPlaying,
} from '../integrations'
import type { Pulse, Venue } from '../types'

function makeVenue(overrides: Partial<Venue> = {}): Venue {
  return { id: 'v1', name: 'Bar A', location: { lat: 40.7, lng: -74.0, address: '' }, pulseScore: 70, ...overrides }
}

describe('generateRideshareLink', () => {
  it('generates uber link', () => {
    const venue = makeVenue()
    const link = generateRideshareLink('uber', venue, 40.72, -74.01)
    expect(link.provider).toBe('uber')
    expect(link.deepLink).toContain('uber://')
    expect(link.estimatedMinutes).toBeGreaterThanOrEqual(3)
    expect(link.label).toContain('Uber')
  })

  it('generates lyft link', () => {
    const venue = makeVenue()
    const link = generateRideshareLink('lyft', venue, 40.72, -74.01)
    expect(link.provider).toBe('lyft')
    expect(link.deepLink).toContain('lyft://')
  })

  it('shows surge warning', () => {
    const venue = makeVenue()
    const link = generateRideshareLink('uber', venue, 40.72, -74.01, 2.0)
    expect(link.label).toContain('surge')
  })
})

describe('getBestRideshareOption', () => {
  it('returns the faster option', () => {
    const venue = makeVenue()
    const best = getBestRideshareOption(venue, 40.72, -74.01)
    expect(['uber', 'lyft']).toContain(best.provider)
  })
})

describe('createSpotifyNowPlaying', () => {
  it('creates now playing info', () => {
    const np = createSpotifyNowPlaying('v1', 'Blinding Lights', 'The Weeknd', { playlistName: 'Chill Vibes' })
    expect(np.trackName).toBe('Blinding Lights')
    expect(np.artistName).toBe('The Weeknd')
    expect(np.playlistName).toBe('Chill Vibes')
  })
})

describe('getVenueMusicUrl', () => {
  it('uses a venue spotify url when configured', () => {
    const url = getVenueMusicUrl(makeVenue({
      integrations: {
        music: {
          spotifyUrl: 'https://open.spotify.com/playlist/test',
        },
      },
    }))

    expect(url).toBe('https://open.spotify.com/playlist/test')
  })
})

describe('getVenueNowPlaying', () => {
  it('creates venue-specific now playing data', () => {
    const nowPlaying = getVenueNowPlaying(makeVenue({
      id: 'venue-3',
      name: 'Q Nightclub',
      category: 'Nightclub',
      integrations: {
        music: {
          playlistName: 'Late Night Pulse',
        },
      },
    }), new Date('2026-03-14T22:00:00.000Z'))

    expect(nowPlaying.playlistName).toBe('Late Night Pulse')
    expect(nowPlaying.trackName).not.toBe('Midnight City')
    expect(nowPlaying.albumArt).toContain('data:image/svg+xml')
  })
})

describe('formatSpotifyDisplay', () => {
  it('formats without playlist', () => {
    const np = createSpotifyNowPlaying('v1', 'Song', 'Artist')
    expect(formatSpotifyDisplay(np)).toBe('Song by Artist')
  })

  it('formats with playlist', () => {
    const np = createSpotifyNowPlaying('v1', 'Song', 'Artist', { playlistName: 'Mix' })
    expect(formatSpotifyDisplay(np)).toContain('Mix')
  })
})

describe('createReservationLink', () => {
  it('creates opentable link', () => {
    const link = createReservationLink('opentable', 'v1', 'bar-a-nyc', true, '8:00 PM')
    expect(link.deepLink).toContain('opentable.com')
    expect(link.available).toBe(true)
    expect(link.nextSlot).toBe('8:00 PM')
  })

  it('creates resy link', () => {
    const link = createReservationLink('resy', 'v1', 'bar-a-nyc', false)
    expect(link.deepLink).toContain('resy.com')
    expect(link.available).toBe(false)
  })
})

describe('getAvailableReservations', () => {
  it('filters available only', () => {
    const links = [
      createReservationLink('opentable', 'v1', 'a', true),
      createReservationLink('resy', 'v2', 'b', false),
    ]
    expect(getAvailableReservations(links)).toHaveLength(1)
  })
})

describe('getVenueReservationLinks', () => {
  it('builds search fallbacks when direct ids are missing', () => {
    const links = getVenueReservationLinks(makeVenue({ city: 'Seattle', state: 'WA' }))
    expect(links).toHaveLength(2)
    expect(links.every(link => link.kind === 'search')).toBe(true)
  })

  it('uses configured reservation urls before fallback search links', () => {
    const links = getVenueReservationLinks(makeVenue({
      integrations: {
        reservations: {
          opentableUrl: 'https://www.opentable.com/s?term=Bar%20A',
        },
      },
    }))

    expect(links[0].deepLink).toContain('opentable.com/s?term=')
    expect(links[0].kind).toBe('direct')
  })
})

describe('generateMapsEnergyLayer', () => {
  it('generates energy layer from venues', () => {
    const venues = [
      makeVenue({ id: 'v1', pulseScore: 10 }),
      makeVenue({ id: 'v2', pulseScore: 80 }),
    ]
    const layer = generateMapsEnergyLayer(venues)
    expect(layer.venues).toHaveLength(2)
    expect(layer.venues[0].energy).toBeDefined()
    expect(layer.generatedAt).toBeDefined()
  })
})

describe('getShortcutActions', () => {
  it('returns available shortcuts', () => {
    const actions = getShortcutActions()
    expect(actions.length).toBeGreaterThanOrEqual(4)
    expect(actions.some(a => a.type === 'tonight')).toBe(true)
  })
})

describe('executeShortcut', () => {
  it('returns top venues for tonight', () => {
    const venues = [
      makeVenue({ id: 'v1', pulseScore: 90 }),
      makeVenue({ id: 'v2', pulseScore: 50 }),
    ]
    const action = { id: 'tonight', name: 'Tonight', description: '', type: 'tonight' as const, parameters: {} }
    const result = executeShortcut(action, venues, 5)
    expect(result[0].pulseScore).toBeGreaterThanOrEqual(result[1].pulseScore)
  })

  it('does not mutate the original venue array', () => {
    const venues = [
      makeVenue({ id: 'v1', pulseScore: 10 }),
      makeVenue({ id: 'v2', pulseScore: 90 }),
    ]

    const originalIds = venues.map(venue => venue.id)
    executeShortcut({ id: 'tonight', name: 'Tonight', description: '', type: 'tonight', parameters: {} }, venues, 5)

    expect(venues.map(venue => venue.id)).toEqual(originalIds)
  })

  it('uses user location for nearby results', () => {
    const venues = [
      makeVenue({ id: 'far', location: { lat: 40.9, lng: -74.0, address: '' } }),
      makeVenue({ id: 'near', location: { lat: 40.7001, lng: -74.0, address: '' } }),
    ]

    const result = executeShortcut(
      { id: 'nearby', name: 'Nearby', description: '', type: 'nearby', parameters: {} },
      venues,
      5,
      { userLocation: { lat: 40.7, lng: -74.0 } }
    )

    expect(result[0].id).toBe('near')
  })

  it('uses recent friend activity for friend shortcuts', () => {
    const venues = [
      makeVenue({ id: 'friend-venue', pulseScore: 40 }),
      makeVenue({ id: 'other-venue', pulseScore: 95 }),
    ]
    const pulses: Pick<Pulse, 'venueId' | 'userId' | 'createdAt'>[] = [
      { venueId: 'friend-venue', userId: 'friend-1', createdAt: '2025-01-01T05:00:00.000Z' },
      { venueId: 'other-venue', userId: 'stranger', createdAt: '2025-01-01T05:00:00.000Z' },
    ]

    const result = executeShortcut(
      { id: 'friends', name: 'Friends', description: '', type: 'friends', parameters: {} },
      venues,
      5,
      {
        currentUser: { id: 'me', friends: ['friend-1'] },
        pulses,
        now: new Date('2025-01-01T06:00:00.000Z'),
      }
    )

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('friend-venue')
  })
})

describe('getIntegrationStatus', () => {
  it('shortcuts are available by default', () => {
    const status = getIntegrationStatus('shortcuts')
    expect(status.available).toBe(true)
    expect(status.configRequired).toHaveLength(0)
  })

  it('rideshare requires config', () => {
    const status = getIntegrationStatus('rideshare')
    expect(status.available).toBe(false)
    expect(status.configRequired.length).toBeGreaterThan(0)
  })

  it('reports configured integrations as available', () => {
    const status = getIntegrationStatus('music', { configured: true })
    expect(status.available).toBe(true)
  })
})

describe('getVenueIntegrationAvailability', () => {
  it('requires location for rideshare', () => {
    const availability = getVenueIntegrationAvailability(makeVenue(), null)
    expect(availability.rideshare.available).toBe(false)
    expect(availability.rideshare.reason).toContain('Enable location')
  })
})

describe('launchIntegrationUrl', () => {
  it('opens web urls in a new tab', () => {
    let opened = ''
    const result = launchIntegrationUrl('https://example.com', {
      opener: (url) => {
        opened = url ?? ''
        return {} as Window
      },
    })

    expect(result.ok).toBe(true)
    expect(opened).toBe('https://example.com')
  })

  it('uses location assignment for custom schemes', () => {
    let assigned = ''
    const result = launchIntegrationUrl('uber://ride', {
      locationAssign: (url) => {
        assigned = url
      },
    })

    expect(result.ok).toBe(true)
    expect(assigned).toBe('uber://ride')
  })

  it('reports blocked popups', () => {
    const result = launchIntegrationUrl('https://example.com', {
      opener: () => null,
    })

    expect(result.ok).toBe(false)
    expect(result.reason).toBe('popup-blocked')
  })
})
