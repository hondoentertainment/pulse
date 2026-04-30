import { beforeEach, describe, expect, it } from 'vitest'

import { clearReports, reportCrowdLevel, reportWaitTime } from '../live-intelligence'
import { getRightNowDecisionSections } from '../right-now-decisions'
import type { User, Venue } from '../types'
import { clearVenueOperatorStatuses, updateVenueOperatorStatus } from '../venue-operator-live'

function makeVenue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: overrides.id || 'venue-1',
    name: overrides.name || 'Test Venue',
    location: overrides.location || { lat: 37.7749, lng: -122.4194, address: 'Test Address' },
    pulseScore: overrides.pulseScore ?? 50,
    category: overrides.category || 'Nightclub',
    lastPulseAt: overrides.lastPulseAt,
    lastActivity: overrides.lastActivity,
    ...overrides,
  }
}

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: overrides.id || 'user-1',
    username: overrides.username || 'test-user',
    friends: overrides.friends || [],
    createdAt: overrides.createdAt || new Date('2026-01-01T00:00:00.000Z').toISOString(),
    favoriteVenues: overrides.favoriteVenues || [],
    followedVenues: overrides.followedVenues || [],
    venueCheckInHistory: overrides.venueCheckInHistory || {},
    ...overrides,
  }
}

describe('getRightNowDecisionSections', () => {
  beforeEach(() => {
    clearReports()
    clearVenueOperatorStatuses()
  })

  it('prefers the freshest, strongest venue in Surging Now', () => {
    const now = Date.now()
    const user = makeUser()
    const venues = [
      makeVenue({
        id: 'fresh-electric',
        pulseScore: 88,
        lastPulseAt: new Date(now - 5 * 60 * 1000).toISOString(),
        lastActivity: new Date(now - 5 * 60 * 1000).toISOString(),
      }),
      makeVenue({
        id: 'stale-electric',
        pulseScore: 90,
        lastPulseAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
        lastActivity: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
      }),
      makeVenue({
        id: 'steady-room',
        pulseScore: 60,
        lastPulseAt: new Date(now - 20 * 60 * 1000).toISOString(),
      }),
    ]

    const sections = getRightNowDecisionSections(venues, user, { lat: 37.7749, lng: -122.4194 })

    expect(sections.surgingNow[0]?.venue.id).toBe('fresh-electric')
  })

  it('keeps owner-confirmed nearby venues in the verified nearby bucket', () => {
    const now = Date.now()
    const user = makeUser()
    const venues = [
      makeVenue({
        id: 'surging-1',
        pulseScore: 90,
        location: { lat: 37.7849, lng: -122.4194, address: '' },
        lastPulseAt: new Date(now - 4 * 60 * 1000).toISOString(),
      }),
      makeVenue({
        id: 'surging-2',
        pulseScore: 86,
        location: { lat: 37.7899, lng: -122.4094, address: '' },
        lastPulseAt: new Date(now - 6 * 60 * 1000).toISOString(),
      }),
      makeVenue({
        id: 'worth-it',
        pulseScore: 78,
        location: { lat: 37.7649, lng: -122.4294, address: '' },
        lastPulseAt: new Date(now - 8 * 60 * 1000).toISOString(),
      }),
      makeVenue({
        id: 'verified-nearby',
        pulseScore: 32,
        location: { lat: 37.7752, lng: -122.4191, address: '' },
        lastPulseAt: new Date(now - 18 * 60 * 1000).toISOString(),
      }),
      makeVenue({
        id: 'backup-nearby',
        pulseScore: 28,
        location: { lat: 37.7762, lng: -122.4181, address: '' },
        lastPulseAt: new Date(now - 25 * 60 * 1000).toISOString(),
      }),
    ]

    updateVenueOperatorStatus('verified-nearby', 'owner-1', {
      guestListStatus: 'open',
      doorNote: 'Walk-ins getting in fast',
      special: 'Free before 11 PM',
    })
    reportWaitTime('verified-nearby', 'guest-1', 5)

    const sections = getRightNowDecisionSections(venues, user, { lat: 37.7749, lng: -122.4194 })
    const verifiedIds = sections.verifiedNearby.map(item => item.venue.id)

    expect(verifiedIds).toContain('verified-nearby')
    expect(sections.verifiedNearby.find(item => item.venue.id === 'verified-nearby')?.sourceLabel).toBe('Venue verified')
  })

  it('rewards smooth-entry venues in Worth Leaving For', () => {
    const now = Date.now()
    const user = makeUser()
    const venues = [
      makeVenue({
        id: 'surging-1',
        pulseScore: 92,
        location: { lat: 37.7849, lng: -122.4194, address: '' },
        lastPulseAt: new Date(now - 3 * 60 * 1000).toISOString(),
      }),
      makeVenue({
        id: 'surging-2',
        pulseScore: 88,
        location: { lat: 37.7899, lng: -122.4094, address: '' },
        lastPulseAt: new Date(now - 4 * 60 * 1000).toISOString(),
      }),
      makeVenue({
        id: 'surging-3',
        pulseScore: 84,
        location: { lat: 37.7699, lng: -122.4294, address: '' },
        lastPulseAt: new Date(now - 6 * 60 * 1000).toISOString(),
      }),
      makeVenue({
        id: 'smooth-entry',
        pulseScore: 62,
        location: { lat: 37.7779, lng: -122.4174, address: '' },
        lastPulseAt: new Date(now - 10 * 60 * 1000).toISOString(),
      }),
      makeVenue({
        id: 'rough-entry',
        pulseScore: 64,
        location: { lat: 37.7789, lng: -122.4164, address: '' },
        lastPulseAt: new Date(now - 10 * 60 * 1000).toISOString(),
      }),
    ]

    updateVenueOperatorStatus('smooth-entry', 'owner-1', {
      guestListStatus: 'open',
      doorNote: 'Door is moving',
    })
    reportWaitTime('smooth-entry', 'guest-1', 5)
    reportCrowdLevel('smooth-entry', 'guest-1', 70)

    updateVenueOperatorStatus('rough-entry', 'owner-2', {
      guestListStatus: 'limited',
      doorNote: 'Door is tightening up',
    })
    reportWaitTime('rough-entry', 'guest-2', 35)
    reportCrowdLevel('rough-entry', 'guest-2', 82)

    const sections = getRightNowDecisionSections(venues, user, { lat: 37.7749, lng: -122.4194 })
    const surfacedIds = [...sections.surgingNow, ...sections.worthLeavingFor].map(item => item.venue.id)

    expect(surfacedIds).toContain('smooth-entry')
  })
})
