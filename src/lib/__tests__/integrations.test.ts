import { describe, it, expect } from 'vitest'
import {
  generateRideshareLink,
  getBestRideshareOption,
  createSpotifyNowPlaying,
  formatSpotifyDisplay,
  createReservationLink,
  getAvailableReservations,
  generateMapsEnergyLayer,
  getShortcutActions,
  executeShortcut,
  getIntegrationStatus,
} from '../integrations'
import type { Venue } from '../types'

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
})
