import { describe, it, expect } from 'vitest'
import {
  createVenueClaim,
  verifyVenueClaim,
  buildOwnerDashboard,
  createAnnouncement,
  isVenueVerified,
  getVenueOwner,
  getActiveAnnouncements,
  isPromotedActive,
  getPromotedVenues,
} from '../venue-owner'
import type { Venue, Pulse, EnergyRating } from '../types'

function makeVenue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: 'v1',
    name: 'Test Venue',
    location: { lat: 40, lng: -74, address: '' },
    pulseScore: 50,
    ...overrides,
  }
}

function makePulse(overrides: Partial<Pulse> = {}): Pulse {
  return {
    id: `p-${Math.random()}`,
    userId: 'u1',
    venueId: 'v1',
    photos: [],
    energyRating: 'buzzing',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
    reactions: { fire: [], eyes: [], skull: [], lightning: [] },
    views: 0,
    ...overrides,
  }
}

describe('venue claims', () => {
  it('creates a pending claim', () => {
    const claim = createVenueClaim('v1', 'u1', 'My Bar', 'owner@bar.com')
    expect(claim.status).toBe('pending')
    expect(claim.venueId).toBe('v1')
    expect(claim.businessEmail).toBe('owner@bar.com')
  })

  it('verifies a claim', () => {
    const claim = createVenueClaim('v1', 'u1', 'My Bar', 'owner@bar.com')
    const verified = verifyVenueClaim(claim)
    expect(verified.status).toBe('verified')
    expect(verified.verifiedAt).toBeDefined()
  })

  it('checks if venue is verified', () => {
    const claim = verifyVenueClaim(createVenueClaim('v1', 'u1', 'Bar', 'a@b.com'))
    expect(isVenueVerified([claim], 'v1')).toBe(true)
    expect(isVenueVerified([claim], 'v2')).toBe(false)
  })

  it('gets venue owner', () => {
    const claim = verifyVenueClaim(createVenueClaim('v1', 'u1', 'Bar', 'a@b.com'))
    expect(getVenueOwner([claim], 'v1')).toBe('u1')
    expect(getVenueOwner([claim], 'v2')).toBeNull()
  })
})

describe('buildOwnerDashboard', () => {
  it('builds dashboard with correct metrics', () => {
    const venue = makeVenue()
    const now = Date.now()
    const pulses = [
      makePulse({ venueId: 'v1', userId: 'u1', energyRating: 'electric', createdAt: new Date(now - 1 * 3600000).toISOString() }),
      makePulse({ venueId: 'v1', userId: 'u2', energyRating: 'buzzing', createdAt: new Date(now - 2 * 3600000).toISOString() }),
      makePulse({ venueId: 'v1', userId: 'u3', energyRating: 'chill', createdAt: new Date(now - 3 * 3600000).toISOString() }),
      makePulse({ venueId: 'other', userId: 'u1', createdAt: new Date(now - 1 * 3600000).toISOString() }), // different venue
    ]
    const dash = buildOwnerDashboard(venue, pulses)
    expect(dash.pulsesLast24h).toBe(3)
    expect(dash.pulsesLast7d).toBe(3)
    expect(dash.uniqueVisitors7d).toBe(3)
    expect(dash.energyDistribution.electric).toBe(1)
    expect(dash.energyDistribution.buzzing).toBe(1)
    expect(dash.energyDistribution.chill).toBe(1)
    expect(dash.averageEnergy).toBe(2) // (3+2+1)/3
  })

  it('handles empty pulses', () => {
    const venue = makeVenue()
    const dash = buildOwnerDashboard(venue, [])
    expect(dash.pulsesLast24h).toBe(0)
    expect(dash.uniqueVisitors7d).toBe(0)
    expect(dash.averageEnergy).toBe(0)
  })
})

describe('announcements', () => {
  it('creates an announcement', () => {
    const ann = createAnnouncement('v1', 'u1', 'Happy Hour!', '50% off drinks', 'special')
    expect(ann.venueId).toBe('v1')
    expect(ann.title).toBe('Happy Hour!')
    expect(ann.type).toBe('special')
    expect(ann.pinned).toBe(false)
  })

  it('creates with expiration', () => {
    const ann = createAnnouncement('v1', 'u1', 'Flash', 'Now!', 'general', undefined, 2)
    expect(ann.expiresAt).toBeDefined()
  })

  it('gets active announcements sorted', () => {
    const now = Date.now()
    const anns = [
      { ...createAnnouncement('v1', 'u1', 'Old', '', 'general'), createdAt: new Date(now - 3600000).toISOString() },
      { ...createAnnouncement('v1', 'u1', 'New', '', 'general'), createdAt: new Date(now).toISOString() },
      { ...createAnnouncement('v1', 'u1', 'Pinned', '', 'general'), createdAt: new Date(now - 7200000).toISOString(), pinned: true },
      { ...createAnnouncement('v2', 'u1', 'Other', '', 'general') }, // different venue
    ]
    const active = getActiveAnnouncements(anns, 'v1')
    expect(active.length).toBe(3)
    expect(active[0].title).toBe('Pinned') // Pinned first
  })

  it('filters expired announcements', () => {
    const ann = {
      ...createAnnouncement('v1', 'u1', 'Expired', '', 'general'),
      expiresAt: new Date(Date.now() - 3600000).toISOString(),
    }
    expect(getActiveAnnouncements([ann], 'v1').length).toBe(0)
  })
})

describe('promoted placements', () => {
  it('checks if placement is active', () => {
    const active = {
      id: 'p1',
      venueId: 'v1',
      ownerUserId: 'u1',
      startDate: new Date(Date.now() - 86400000).toISOString(),
      endDate: new Date(Date.now() + 86400000).toISOString(),
      budget: 100,
      impressions: 0,
      clicks: 0,
      active: true,
    }
    expect(isPromotedActive(active)).toBe(true)

    const inactive = { ...active, active: false }
    expect(isPromotedActive(inactive)).toBe(false)
  })

  it('gets promoted venues', () => {
    const placements = [{
      id: 'p1',
      venueId: 'v1',
      ownerUserId: 'u1',
      startDate: new Date(Date.now() - 86400000).toISOString(),
      endDate: new Date(Date.now() + 86400000).toISOString(),
      budget: 100,
      impressions: 0,
      clicks: 0,
      active: true,
    }]
    const venues = [makeVenue({ id: 'v1' }), makeVenue({ id: 'v2' })]
    const promoted = getPromotedVenues(placements, venues)
    expect(promoted.length).toBe(1)
    expect(promoted[0].id).toBe('v1')
  })
})
