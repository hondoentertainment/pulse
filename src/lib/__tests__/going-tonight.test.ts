import { describe, it, expect } from 'vitest'
import {
  createRSVP,
  cancelRSVP,
  getVenueNightPlan,
  getFriendsGoingTonight,
  generateGoingNotification,
  getPopularVenuesTonight,
  getSuggestedVenues,
  isTonight,
  _deduplicateRsvps,
  type VenueRSVP,
} from '../going-tonight'
import type { User, Venue } from '../types'

// ── Fixtures ─────────────────────────────────────────────────

function makeUser(id: string, username: string): User {
  return { id, username, friends: [], createdAt: new Date().toISOString() }
}

function makeVenue(id: string, name: string): Venue {
  return {
    id,
    name,
    location: { lat: 47.6, lng: -122.3, address: '123 Test St' },
    pulseScore: 75,
  }
}

function makeRSVP(
  userId: string,
  venueId: string,
  status: 'going' | 'maybe' | 'cancelled' = 'going',
  timestamp?: string
): VenueRSVP {
  return {
    userId,
    venueId,
    timestamp: timestamp ?? new Date().toISOString(),
    status,
  }
}

const user1 = makeUser('u1', 'Sarah')
const user2 = makeUser('u2', 'Mike')
const user3 = makeUser('u3', 'Alex')
const user4 = makeUser('u4', 'Jordan')

const venue1 = makeVenue('v1', 'The Rooftop')
const venue2 = makeVenue('v2', 'Neon Lounge')
const _venue3 = makeVenue('v3', 'Club Nova')

// ── createRSVP ───────────────────────────────────────────────

describe('createRSVP', () => {
  it('creates a going RSVP', () => {
    const rsvp = createRSVP('u1', 'v1', 'going')
    expect(rsvp.userId).toBe('u1')
    expect(rsvp.venueId).toBe('v1')
    expect(rsvp.status).toBe('going')
    expect(rsvp.timestamp).toBeTruthy()
  })

  it('creates a maybe RSVP', () => {
    const rsvp = createRSVP('u1', 'v1', 'maybe')
    expect(rsvp.status).toBe('maybe')
  })

  it('includes arrival estimate when provided', () => {
    const rsvp = createRSVP('u1', 'v1', 'going', 'Around 10')
    expect(rsvp.arrivalEstimate).toBe('Around 10')
  })

  it('omits arrival estimate when not provided', () => {
    const rsvp = createRSVP('u1', 'v1', 'going')
    expect(rsvp.arrivalEstimate).toBeUndefined()
  })
})

// ── cancelRSVP ───────────────────────────────────────────────

describe('cancelRSVP', () => {
  it('creates a cancelled RSVP entry', () => {
    const rsvp = cancelRSVP('u1', 'v1')
    expect(rsvp.status).toBe('cancelled')
    expect(rsvp.userId).toBe('u1')
    expect(rsvp.venueId).toBe('v1')
  })
})

// ── getVenueNightPlan ────────────────────────────────────────

describe('getVenueNightPlan', () => {
  it('aggregates RSVPs for a venue', () => {
    const rsvps: VenueRSVP[] = [
      makeRSVP('u1', 'v1', 'going'),
      makeRSVP('u2', 'v1', 'going'),
      makeRSVP('u3', 'v1', 'maybe'),
      makeRSVP('u4', 'v2', 'going'), // different venue
    ]
    const users = [user1, user2, user3, user4]

    const plan = getVenueNightPlan('v1', '2026-03-17', rsvps, users)

    expect(plan.venueId).toBe('v1')
    expect(plan.totalGoing).toBe(2) // u1 and u2
    expect(plan.friendsGoing).toHaveLength(2)
    expect(plan.rsvps).toHaveLength(3) // u1 going, u2 going, u3 maybe
  })

  it('excludes cancelled RSVPs', () => {
    const rsvps: VenueRSVP[] = [
      makeRSVP('u1', 'v1', 'going', '2026-03-17T20:00:00Z'),
      makeRSVP('u1', 'v1', 'cancelled', '2026-03-17T21:00:00Z'), // later cancel
    ]

    const plan = getVenueNightPlan('v1', '2026-03-17', rsvps, [user1])

    expect(plan.totalGoing).toBe(0)
    expect(plan.rsvps).toHaveLength(0)
  })

  it('returns empty plan for venue with no RSVPs', () => {
    const plan = getVenueNightPlan('v-none', '2026-03-17', [], [])

    expect(plan.totalGoing).toBe(0)
    expect(plan.friendsGoing).toHaveLength(0)
    expect(plan.rsvps).toHaveLength(0)
  })
})

// ── getFriendsGoingTonight ───────────────────────────────────

describe('getFriendsGoingTonight', () => {
  it('returns friend RSVPs grouped by venue', () => {
    const rsvps: VenueRSVP[] = [
      makeRSVP('u2', 'v1', 'going'),
      makeRSVP('u3', 'v1', 'going'),
      makeRSVP('u4', 'v2', 'maybe'),
    ]

    const result = getFriendsGoingTonight('u1', ['u2', 'u3', 'u4'], rsvps)

    expect(result.get('v1')).toHaveLength(2)
    expect(result.get('v2')).toHaveLength(1)
  })

  it('excludes cancelled RSVPs from results', () => {
    const rsvps: VenueRSVP[] = [
      makeRSVP('u2', 'v1', 'going', '2026-03-17T20:00:00Z'),
      makeRSVP('u2', 'v1', 'cancelled', '2026-03-17T21:00:00Z'),
    ]

    const result = getFriendsGoingTonight('u1', ['u2'], rsvps)

    expect(result.size).toBe(0)
  })

  it('excludes non-friend RSVPs', () => {
    const rsvps: VenueRSVP[] = [
      makeRSVP('stranger', 'v1', 'going'),
    ]

    const result = getFriendsGoingTonight('u1', ['u2'], rsvps)

    expect(result.size).toBe(0)
  })

  it('returns empty map when no friends have RSVPs', () => {
    const result = getFriendsGoingTonight('u1', ['u2', 'u3'], [])
    expect(result.size).toBe(0)
  })
})

// ── generateGoingNotification ────────────────────────────────

describe('generateGoingNotification', () => {
  it('generates base notification with no friends', () => {
    const msg = generateGoingNotification(user1, venue1, [])
    expect(msg).toBe('Sarah is heading to The Rooftop')
  })

  it('generates notification with 1 friend', () => {
    const msg = generateGoingNotification(user1, venue1, [user2])
    expect(msg).toBe('Sarah is heading to The Rooftop — 1 friend already going')
  })

  it('generates notification with multiple friends', () => {
    const msg = generateGoingNotification(user1, venue1, [user2, user3, user4])
    expect(msg).toBe('Sarah is heading to The Rooftop — 3 friends already going')
  })
})

// ── getPopularVenuesTonight ──────────────────────────────────

describe('getPopularVenuesTonight', () => {
  it('ranks venues by going count descending', () => {
    const rsvps: VenueRSVP[] = [
      makeRSVP('u1', 'v1', 'going'),
      makeRSVP('u2', 'v2', 'going'),
      makeRSVP('u3', 'v2', 'going'),
      makeRSVP('u4', 'v2', 'going'),
    ]
    const venues = [venue1, venue2]

    const popular = getPopularVenuesTonight(rsvps, venues)

    expect(popular[0].id).toBe('v2')
    expect(popular[0].goingCount).toBe(3)
    expect(popular[1].id).toBe('v1')
    expect(popular[1].goingCount).toBe(1)
  })

  it('excludes maybe and cancelled from counts', () => {
    const rsvps: VenueRSVP[] = [
      makeRSVP('u1', 'v1', 'going'),
      makeRSVP('u2', 'v1', 'maybe'),
      makeRSVP('u3', 'v1', 'cancelled'),
    ]

    const popular = getPopularVenuesTonight(rsvps, [venue1])

    expect(popular[0].goingCount).toBe(1)
  })

  it('returns empty array when no RSVPs', () => {
    const popular = getPopularVenuesTonight([], [venue1, venue2])
    expect(popular).toHaveLength(0)
  })

  it('ignores RSVPs for unknown venues', () => {
    const rsvps: VenueRSVP[] = [
      makeRSVP('u1', 'v-unknown', 'going'),
    ]
    const popular = getPopularVenuesTonight(rsvps, [venue1])
    expect(popular).toHaveLength(0)
  })
})

// ── getSuggestedVenues ───────────────────────────────────────

describe('getSuggestedVenues', () => {
  it('suggests venues where friends are going', () => {
    const friendRsvps: VenueRSVP[] = [
      makeRSVP('u2', 'v1', 'going'),
      makeRSVP('u3', 'v1', 'going'),
      makeRSVP('u4', 'v2', 'maybe'),
    ]

    const suggested = getSuggestedVenues('u1', friendRsvps, [venue1, venue2])

    expect(suggested[0].id).toBe('v1')
    expect(suggested[0].friendCount).toBe(2)
    expect(suggested[1].id).toBe('v2')
    expect(suggested[1].friendCount).toBe(1)
  })

  it('excludes the user\'s own RSVPs', () => {
    const rsvps: VenueRSVP[] = [
      makeRSVP('u1', 'v1', 'going'),
    ]

    const suggested = getSuggestedVenues('u1', rsvps, [venue1])

    expect(suggested).toHaveLength(0)
  })

  it('returns empty when no friend RSVPs', () => {
    const suggested = getSuggestedVenues('u1', [], [venue1])
    expect(suggested).toHaveLength(0)
  })
})

// ── isTonight ────────────────────────────────────────────────

describe('isTonight', () => {
  it('returns false at 5:59 PM (before tonight window)', () => {
    const now = new Date('2026-03-17T22:00:00Z') // some reference
    now.setHours(22, 0, 0, 0) // doesn't matter, we control "now"

    const referenceNow = new Date('2026-03-17T20:00:00Z')
    referenceNow.setHours(20, 0, 0, 0)

    // 5:59 PM same day
    const at559PM = new Date('2026-03-17T00:00:00Z')
    at559PM.setHours(17, 59, 0, 0)

    const now8PM = new Date('2026-03-17T00:00:00Z')
    now8PM.setHours(20, 0, 0, 0)

    expect(isTonight(at559PM, now8PM)).toBe(false)
  })

  it('returns true at 6:00 PM (start of tonight)', () => {
    const at6PM = new Date('2026-03-17T00:00:00Z')
    at6PM.setHours(18, 0, 0, 0)

    const now8PM = new Date('2026-03-17T00:00:00Z')
    now8PM.setHours(20, 0, 0, 0)

    expect(isTonight(at6PM, now8PM)).toBe(true)
  })

  it('returns true at 11:00 PM', () => {
    const at11PM = new Date('2026-03-17T00:00:00Z')
    at11PM.setHours(23, 0, 0, 0)

    const now8PM = new Date('2026-03-17T00:00:00Z')
    now8PM.setHours(20, 0, 0, 0)

    expect(isTonight(at11PM, now8PM)).toBe(true)
  })

  it('returns true at 3:59 AM next day (still tonight)', () => {
    // "now" is 2 AM on the 18th — tonight started 6 PM on the 17th
    const now2AM = new Date('2026-03-18T00:00:00Z')
    now2AM.setHours(2, 0, 0, 0)

    const at359AM = new Date('2026-03-18T00:00:00Z')
    at359AM.setHours(3, 59, 0, 0)

    expect(isTonight(at359AM, now2AM)).toBe(true)
  })

  it('returns false at 4:00 AM (end of tonight)', () => {
    const now2AM = new Date('2026-03-18T00:00:00Z')
    now2AM.setHours(2, 0, 0, 0)

    const at4AM = new Date('2026-03-18T00:00:00Z')
    at4AM.setHours(4, 0, 0, 0)

    expect(isTonight(at4AM, now2AM)).toBe(false)
  })

  it('returns true for early morning reference with late night date', () => {
    // It's 1 AM on the 18th, checking 11 PM on the 17th
    const now1AM = new Date('2026-03-18T00:00:00Z')
    now1AM.setHours(1, 0, 0, 0)

    const at11PM = new Date('2026-03-17T00:00:00Z')
    at11PM.setHours(23, 0, 0, 0)

    expect(isTonight(at11PM, now1AM)).toBe(true)
  })

  it('returns false for a completely different day', () => {
    const now8PM = new Date('2026-03-17T00:00:00Z')
    now8PM.setHours(20, 0, 0, 0)

    const yesterday = new Date('2026-03-16T00:00:00Z')
    yesterday.setHours(22, 0, 0, 0)

    expect(isTonight(yesterday, now8PM)).toBe(false)
  })
})

// ── Deduplication ────────────────────────────────────────────

describe('deduplication', () => {
  it('keeps only the latest RSVP per user per venue', () => {
    const rsvps: VenueRSVP[] = [
      makeRSVP('u1', 'v1', 'going', '2026-03-17T20:00:00Z'),
      makeRSVP('u1', 'v1', 'maybe', '2026-03-17T21:00:00Z'),
      makeRSVP('u1', 'v1', 'going', '2026-03-17T22:00:00Z'),
    ]

    const deduped = _deduplicateRsvps(rsvps)

    expect(deduped).toHaveLength(1)
    expect(deduped[0].timestamp).toBe('2026-03-17T22:00:00Z')
    expect(deduped[0].status).toBe('going')
  })

  it('keeps separate entries for different users', () => {
    const rsvps: VenueRSVP[] = [
      makeRSVP('u1', 'v1', 'going'),
      makeRSVP('u2', 'v1', 'going'),
    ]

    const deduped = _deduplicateRsvps(rsvps)

    expect(deduped).toHaveLength(2)
  })

  it('keeps separate entries for different venues', () => {
    const rsvps: VenueRSVP[] = [
      makeRSVP('u1', 'v1', 'going'),
      makeRSVP('u1', 'v2', 'going'),
    ]

    const deduped = _deduplicateRsvps(rsvps)

    expect(deduped).toHaveLength(2)
  })

  it('handles empty array', () => {
    const deduped = _deduplicateRsvps([])
    expect(deduped).toHaveLength(0)
  })
})

// ── Empty states ─────────────────────────────────────────────

describe('empty states', () => {
  it('getVenueNightPlan with no RSVPs returns zero counts', () => {
    const plan = getVenueNightPlan('v1', '2026-03-17', [], [])
    expect(plan.totalGoing).toBe(0)
    expect(plan.friendsGoing).toHaveLength(0)
  })

  it('getFriendsGoingTonight with no friends returns empty map', () => {
    const result = getFriendsGoingTonight('u1', [], [makeRSVP('u2', 'v1', 'going')])
    expect(result.size).toBe(0)
  })

  it('getPopularVenuesTonight with no venues returns empty', () => {
    const result = getPopularVenuesTonight([makeRSVP('u1', 'v1', 'going')], [])
    expect(result).toHaveLength(0)
  })

  it('getSuggestedVenues with no venues returns empty', () => {
    const result = getSuggestedVenues('u1', [makeRSVP('u2', 'v1', 'going')], [])
    expect(result).toHaveLength(0)
  })
})
