import { describe, expect, it } from 'vitest'

import { getVenueActionCtas } from '../venue-action-ctas'
import { getWatchedVenueIds, isVenueSurgeWatched, toggleVenueSurgeWatch } from '../venue-surge-watch'
import type { Venue } from '../types'
import type { VenueLiveData } from '../live-intelligence'

function makeVenue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: overrides.id || 'venue-1',
    name: overrides.name || 'Neon Room',
    location: overrides.location || { lat: 47.61, lng: -122.33, address: '123 Main St' },
    city: overrides.city || 'Seattle',
    state: overrides.state || 'WA',
    pulseScore: overrides.pulseScore ?? 72,
    category: overrides.category || 'Nightclub',
    ...overrides,
  }
}

function makeLiveData(overrides: Partial<VenueLiveData> = {}): VenueLiveData {
  return {
    venueId: overrides.venueId || 'venue-1',
    timestamp: overrides.timestamp || new Date().toISOString(),
    crowdLevel: overrides.crowdLevel ?? 70,
    waitTime: overrides.waitTime ?? 8,
    coverCharge: overrides.coverCharge ?? 20,
    dressCode: overrides.dressCode ?? null,
    musicGenre: overrides.musicGenre ?? 'House',
    nowPlaying: overrides.nowPlaying ?? null,
    ageRange: overrides.ageRange ?? null,
    capacity: overrides.capacity ?? null,
    lastUpdated: overrides.lastUpdated || new Date().toISOString(),
    confidence: overrides.confidence || {
      waitTime: 'medium',
      coverCharge: 'medium',
      musicGenre: 'medium',
      crowdLevel: 'medium',
      dressCode: 'low',
      nowPlaying: 'low',
      ageRange: 'low',
    },
    confidenceDetails: overrides.confidenceDetails || {
      waitTime: { level: 'medium', reportCount: 2, freshnessMinutes: 5, operatorVerified: false, summary: '2 recent reports • 5m ago' },
      coverCharge: { level: 'medium', reportCount: 1, freshnessMinutes: 5, operatorVerified: false, summary: '1 recent report • 5m ago' },
      musicGenre: { level: 'medium', reportCount: 1, freshnessMinutes: 5, operatorVerified: false, summary: '1 recent report • 5m ago' },
      crowdLevel: { level: 'medium', reportCount: 2, freshnessMinutes: 5, operatorVerified: false, summary: '2 recent reports • 5m ago' },
      dressCode: { level: 'low', reportCount: 0, freshnessMinutes: null, operatorVerified: false, summary: 'No recent reports' },
      nowPlaying: { level: 'low', reportCount: 0, freshnessMinutes: null, operatorVerified: false, summary: 'No recent reports' },
      ageRange: { level: 'low', reportCount: 0, freshnessMinutes: null, operatorVerified: false, summary: 'No recent reports' },
    },
    doorMode: overrides.doorMode || {
      lineStatus: 'moving',
      entryConfidence: 78,
      guestListStatus: 'open',
      tableMinimum: null,
      reasons: ['Door moving'],
    },
    operatorNote: overrides.operatorNote,
    djStatus: overrides.djStatus,
    special: overrides.special,
  }
}

describe('getVenueActionCtas', () => {
  it('builds conversion-focused actions with ride and reservation links', () => {
    const venue = makeVenue({
      integrations: {
        reservations: {
          resyUrl: 'https://resy.com/cities/seattle-wa/venues/neon-room',
        },
        maps: {
          googleMapsUrl: 'https://maps.google.com/?q=Neon%20Room',
        },
      },
    })

    const actions = getVenueActionCtas(venue, {
      userLocation: { lat: 47.60, lng: -122.30 },
      liveData: makeLiveData(),
      isWatchingSurge: true,
    })

    expect(actions.map(action => action.id)).toEqual([
      'directions',
      'ride',
      'reserve',
      'tickets',
      'surge_watch',
      'guest_list',
    ])
    expect(actions.find(action => action.id === 'ride')?.disabledReason).toBeUndefined()
    expect(actions.find(action => action.id === 'reserve')?.href).toContain('resy.com')
    expect(actions.find(action => action.id === 'surge_watch')?.isActive).toBe(true)
    expect(actions.find(action => action.id === 'guest_list')?.badge).toBe('Open')
  })

  it('marks ride action unavailable without location', () => {
    const actions = getVenueActionCtas(makeVenue(), {
      liveData: makeLiveData({
        doorMode: {
          lineStatus: 'slow',
          entryConfidence: 55,
          guestListStatus: null,
          tableMinimum: 300,
          reasons: ['Longer line tonight'],
        },
      }),
    })

    expect(actions.find(action => action.id === 'ride')?.disabledReason).toMatch(/Enable location/i)
    expect(actions.find(action => action.id === 'guest_list')?.description).toMatch(/No guest list update/i)
  })
})

describe('venue surge watch storage', () => {
  it('toggles watched venues in storage', () => {
    const store = new Map<string, string>()
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value)
      },
    }

    expect(getWatchedVenueIds(storage)).toEqual([])
    expect(isVenueSurgeWatched('venue-1', storage)).toBe(false)
    expect(toggleVenueSurgeWatch('venue-1', storage)).toBe(true)
    expect(isVenueSurgeWatched('venue-1', storage)).toBe(true)
    expect(toggleVenueSurgeWatch('venue-1', storage)).toBe(false)
    expect(getWatchedVenueIds(storage)).toEqual([])
  })
})
