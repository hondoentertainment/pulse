import { describe, it, expect } from 'vitest'
import { calculateUserCredibility, getUserTrustBadges, getPulseCredibilityWeight } from '../credibility'
import type { User, Pulse } from '../types'

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    username: 'testuser',
    friends: [],
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(), // 60 days ago
    ...overrides,
  }
}

function makePulse(overrides: Partial<Pulse> = {}): Pulse {
  return {
    id: `pulse-${Math.random()}`,
    userId: 'user-1',
    venueId: 'venue-1',
    photos: [],
    energyRating: 'buzzing',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
    reactions: { fire: [], eyes: [], skull: [], lightning: [] },
    views: 0,
    ...overrides,
  }
}

describe('calculateUserCredibility', () => {
  it('returns base score of 1.0 for established account with no pulses', () => {
    const user = makeUser()
    expect(calculateUserCredibility(user, [])).toBe(1.0)
  })

  it('penalizes brand new accounts (< 1 day)', () => {
    const user = makeUser({ createdAt: new Date().toISOString() })
    const score = calculateUserCredibility(user, [])
    expect(score).toBe(0.5)
  })

  it('penalizes accounts < 7 days old', () => {
    const user = makeUser({
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    })
    const score = calculateUserCredibility(user, [])
    expect(score).toBe(0.7)
  })

  it('penalizes accounts < 30 days old', () => {
    const user = makeUser({
      createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    })
    const score = calculateUserCredibility(user, [])
    expect(score).toBe(0.9)
  })

  it('boosts score for 10+ pulses', () => {
    const user = makeUser()
    const pulses = Array.from({ length: 10 }, () => makePulse())
    expect(calculateUserCredibility(user, pulses)).toBe(1.1) // 1.0 + 0.1
  })

  it('boosts score for 20+ pulses', () => {
    const user = makeUser()
    const pulses = Array.from({ length: 20 }, () => makePulse())
    expect(calculateUserCredibility(user, pulses)).toBe(1.2) // 1.0 + 0.2
  })

  it('boosts score for 50+ pulses', () => {
    const user = makeUser()
    const pulses = Array.from({ length: 50 }, () => makePulse())
    expect(calculateUserCredibility(user, pulses)).toBe(1.3) // 1.0 + 0.3
  })

  it('caps at 2.0', () => {
    const user = makeUser()
    // 50+ pulses (+0.3) with high engagement (+0.2) on established account (1.0) = 1.5
    // Even with max bonuses should not exceed 2.0
    const pulses = Array.from({ length: 100 }, () =>
      makePulse({
        reactions: {
          fire: Array.from({ length: 20 }, (_, i) => `user-${i}`),
          eyes: Array.from({ length: 10 }, (_, i) => `user-${i}`),
          skull: [],
          lightning: Array.from({ length: 10 }, (_, i) => `user-${i}`),
        },
      })
    )
    expect(calculateUserCredibility(user, pulses)).toBeLessThanOrEqual(2.0)
  })

  it('only counts pulses belonging to the user', () => {
    const user = makeUser({ id: 'user-1' })
    const myPulses = Array.from({ length: 5 }, () => makePulse({ userId: 'user-1' }))
    const otherPulses = Array.from({ length: 50 }, () => makePulse({ userId: 'user-other' }))
    const allPulses = [...myPulses, ...otherPulses]
    // Only 5 pulses belong to user-1 (no pulse count bonus)
    expect(calculateUserCredibility(user, allPulses)).toBe(1.0)
  })
})

describe('getUserTrustBadges', () => {
  it('returns empty array for new users with no activity', () => {
    const user = makeUser({ venueCheckInHistory: {} })
    expect(getUserTrustBadges(user, 'venue-1', [])).toEqual([])
  })

  it('returns "Regular here" badge for 10+ check-ins', () => {
    const user = makeUser({ venueCheckInHistory: { 'venue-1': 10 } })
    const badges = getUserTrustBadges(user, 'venue-1', [])
    expect(badges.some(b => b.id === 'regular')).toBe(true)
  })

  it('returns "Frequent visitor" badge for 5+ check-ins', () => {
    const user = makeUser({ venueCheckInHistory: { 'venue-1': 5 } })
    const badges = getUserTrustBadges(user, 'venue-1', [])
    expect(badges.some(b => b.id === 'frequent')).toBe(true)
  })

  it('returns max 2 badges', () => {
    const user = makeUser({
      venueCheckInHistory: { 'venue-1': 15 },
      createdAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(),
    })
    const pulses = Array.from({ length: 30 }, (_, i) =>
      makePulse({
        venueId: 'venue-1',
        createdAt: new Date(Date.now() - i * 60 * 60 * 1000).toISOString(),
        reactions: {
          fire: Array.from({ length: 15 }, (_, j) => `u-${j}`),
          eyes: [],
          skull: [],
          lightning: [],
        },
      })
    )
    const badges = getUserTrustBadges(user, 'venue-1', pulses)
    expect(badges.length).toBeLessThanOrEqual(2)
  })
})

describe('getPulseCredibilityWeight', () => {
  it('returns existing weight if present on pulse', () => {
    const pulse = makePulse({ credibilityWeight: 1.5 })
    const user = makeUser()
    expect(getPulseCredibilityWeight(pulse, user, [])).toBe(1.5)
  })

  it('calculates weight if not present on pulse', () => {
    const pulse = makePulse({ credibilityWeight: undefined })
    const user = makeUser()
    const weight = getPulseCredibilityWeight(pulse, user, [])
    expect(weight).toBeGreaterThan(0)
  })
})
