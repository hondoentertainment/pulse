import { describe, it, expect } from 'vitest'
import { buildPersonalDashboard, buildVisitHistory } from '../personal-dashboard'
import type { Pulse, User, Venue } from '../types'

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'u1',
    username: 'kyle',
    friends: [],
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

function makeVenue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: 'v1',
    name: 'Bar A',
    category: 'bar',
    location: { lat: 47.6, lng: -122.3, address: '' },
    pulseScore: 72,
    ...overrides,
  }
}

function makePulse(overrides: Partial<Pulse> = {}): Pulse {
  return {
    id: `p-${Math.random().toString(36).slice(2)}`,
    userId: 'u1',
    venueId: 'v1',
    photos: [],
    energyRating: 'buzzing',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 90 * 60_000).toISOString(),
    reactions: { fire: [], eyes: [], skull: [], lightning: [] },
    views: 0,
    ...overrides,
  }
}

describe('buildVisitHistory', () => {
  it('merges check-in counts with pulse timestamps', () => {
    const user = makeUser({ venueCheckInHistory: { v1: 4, v2: 1 } })
    const venues = [
      makeVenue({ id: 'v1', name: 'Bar A' }),
      makeVenue({ id: 'v2', name: 'Club B', category: 'nightclub', pulseScore: 80 }),
    ]
    const pulses = [
      makePulse({ venueId: 'v1', createdAt: '2026-07-10T22:00:00.000Z', energyRating: 'electric' }),
    ]
    const history = buildVisitHistory(user, venues, pulses)
    expect(history).toHaveLength(2)
    expect(history[0].venueId).toBe('v1')
    expect(history[0].visitCount).toBe(4)
    expect(history[0].lastEnergy).toBe('electric')
    expect(history[1].visitCount).toBe(1)
  })

  it('counts pulses as visits when check-in history is empty', () => {
    const user = makeUser()
    const venues = [makeVenue()]
    const pulses = [makePulse(), makePulse({ id: 'p2' })]
    const history = buildVisitHistory(user, venues, pulses)
    expect(history).toHaveLength(1)
    expect(history[0].visitCount).toBe(2)
  })
})

describe('buildPersonalDashboard', () => {
  it('builds choice guides from personal history', () => {
    const now = new Date('2026-07-14T21:00:00.000Z')
    const user = makeUser({
      venueCheckInHistory: { v1: 5, v2: 3 },
      favoriteCategories: ['bar'],
    })
    const venues = [
      makeVenue({ id: 'v1', name: 'Canon', category: 'bar', pulseScore: 78 }),
      makeVenue({ id: 'v2', name: 'Nevins', category: 'bar', pulseScore: 65 }),
      makeVenue({ id: 'v3', name: 'Fresh Bar', category: 'bar', pulseScore: 70 }),
    ]
    const pulses = [
      makePulse({
        venueId: 'v1',
        energyRating: 'buzzing',
        createdAt: '2026-07-14T21:30:00.000Z',
      }),
      makePulse({
        venueId: 'v1',
        energyRating: 'buzzing',
        createdAt: '2026-07-13T21:15:00.000Z',
      }),
      makePulse({
        venueId: 'v2',
        energyRating: 'electric',
        createdAt: '2026-07-12T22:00:00.000Z',
      }),
    ]

    const dash = buildPersonalDashboard(user, venues, pulses, now)
    expect(dash.empty).toBe(false)
    expect(dash.userId).toBe('u1')
    expect(dash.summary.uniqueVenues).toBe(2)
    expect(dash.summary.totalVisits).toBe(8)
    expect(dash.summary.goToVenues.length).toBeGreaterThan(0)
    expect(dash.choiceGuides.length).toBeGreaterThan(0)
    expect(dash.choiceGuides.some((g) => g.kind === 'return' || g.kind === 'explore' || g.kind === 'vibe')).toBe(true)
    expect(dash.suggestedVibe).toBeTruthy()
  })

  it('handles empty history with onboarding taste', () => {
    const user = makeUser({ favoriteCategories: ['lounge'] })
    const venues = [
      makeVenue({ id: 'v9', name: 'Soft Spot', category: 'lounge', pulseScore: 60 }),
    ]
    const dash = buildPersonalDashboard(user, venues, [])
    expect(dash.empty).toBe(true)
    expect(dash.summary.topCategories.some((c) => c.category.includes('lounge') || c.label.toLowerCase().includes('lounge'))).toBe(true)
    expect(dash.choiceGuides.some((g) => g.kind === 'taste')).toBe(true)
  })

  it('isolates history per user', () => {
    const alice = makeUser({ id: 'alice', username: 'alice', venueCheckInHistory: { v1: 2 } })
    const bob = makeUser({ id: 'bob', username: 'bob', venueCheckInHistory: { v2: 9 } })
    const venues = [
      makeVenue({ id: 'v1', name: 'A Spot' }),
      makeVenue({ id: 'v2', name: 'B Spot', category: 'club' }),
    ]
    const pulses = [
      makePulse({ userId: 'alice', venueId: 'v1' }),
      makePulse({ userId: 'bob', venueId: 'v2', energyRating: 'chill' }),
    ]
    const a = buildPersonalDashboard(alice, venues, pulses)
    const b = buildPersonalDashboard(bob, venues, pulses)
    expect(a.history.every((h) => h.venueId === 'v1')).toBe(true)
    expect(b.history.every((h) => h.venueId === 'v2')).toBe(true)
    expect(a.summary.totalVisits).not.toBe(b.summary.totalVisits)
  })
})
