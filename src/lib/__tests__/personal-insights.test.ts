import { describe, it, expect } from 'vitest'
import {
  generateWeeklyInsights,
  determineVibeType,
  generateActivityHeatmap,
  generateYearInReview,
  calculateMilesExplored,
  getInsightHighlights,
} from '../personal-insights'
import type { Pulse, User, Venue } from '../types'

function makePulse(overrides: Partial<Pulse> = {}): Pulse {
  return {
    id: `p-${Math.random().toString(36).slice(2)}`,
    userId: 'u1', venueId: 'v1', photos: ['img.jpg'],
    energyRating: 'buzzing',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 90 * 60000).toISOString(),
    reactions: { fire: [], eyes: [], skull: [], lightning: [] },
    views: 0,
    ...overrides,
  }
}

function makeUser(overrides: Partial<User> = {}): User {
  return { id: 'u1', username: 'alice', friends: [], createdAt: new Date().toISOString(), ...overrides }
}

function makeVenue(overrides: Partial<Venue> = {}): Venue {
  return { id: 'v1', name: 'Bar A', location: { lat: 40.7, lng: -74.0, address: '' }, pulseScore: 70, ...overrides }
}

describe('generateWeeklyInsights', () => {
  it('calculates weekly stats', () => {
    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - weekStart.getDay())
    weekStart.setHours(0, 0, 0, 0)
    const ws = weekStart.toISOString()
    const pulses = [
      makePulse({ userId: 'u1', venueId: 'v1', createdAt: new Date(weekStart.getTime() + 86400000).toISOString() }),
      makePulse({ userId: 'u1', venueId: 'v2', createdAt: new Date(weekStart.getTime() + 2 * 86400000).toISOString() }),
    ]
    const venues = [makeVenue({ id: 'v1' }), makeVenue({ id: 'v2', name: 'Bar B' })]
    const insights = generateWeeklyInsights('u1', pulses, venues, ws)
    expect(insights.totalPulses).toBe(2)
    expect(insights.uniqueVenues).toBe(2)
  })

  it('returns zero for no pulses', () => {
    const insights = generateWeeklyInsights('u1', [], [], new Date().toISOString())
    expect(insights.totalPulses).toBe(0)
  })
})

describe('determineVibeType', () => {
  it('detects Night Owl', () => {
    const late = new Date()
    late.setHours(23, 0, 0, 0)
    const pulses = Array.from({ length: 6 }, () => makePulse({ createdAt: late.toISOString() }))
    const result = determineVibeType(pulses, makeUser())
    expect(result.type).toBe('Night Owl')
    expect(result.emoji).toBe('🦉')
  })

  it('detects Explorer', () => {
    const noon = new Date()
    noon.setHours(12, 0, 0, 0)
    const pulses = Array.from({ length: 10 }, (_, i) => makePulse({ venueId: `v${i}`, createdAt: noon.toISOString() }))
    const result = determineVibeType(pulses, makeUser())
    expect(result.type).toBe('Explorer')
  })

  it('returns Trendsetter as default', () => {
    const result = determineVibeType([], makeUser())
    expect(result.type).toBe('Trendsetter')
  })
})

describe('generateActivityHeatmap', () => {
  it('builds heatmap cells', () => {
    const pulses = [makePulse({ userId: 'u1' }), makePulse({ userId: 'u1' })]
    const heatmap = generateActivityHeatmap('u1', pulses)
    expect(heatmap.userId).toBe('u1')
    expect(heatmap.cells.length).toBeGreaterThanOrEqual(1)
  })

  it('empty for other user', () => {
    const heatmap = generateActivityHeatmap('u999', [makePulse({ userId: 'u1' })])
    expect(heatmap.cells).toHaveLength(0)
  })
})

describe('generateYearInReview', () => {
  it('generates year review', () => {
    const year = new Date().getFullYear()
    const pulses = [
      makePulse({ userId: 'u1', venueId: 'v1', createdAt: new Date(year, 5, 15).toISOString() }),
      makePulse({ userId: 'u1', venueId: 'v2', energyRating: 'electric', createdAt: new Date(year, 6, 20).toISOString() }),
    ]
    const venues = [
      makeVenue({ id: 'v1', category: 'bar' }),
      makeVenue({ id: 'v2', name: 'Club B', category: 'club' }),
    ]
    const review = generateYearInReview('u1', year, pulses, venues, makeUser())
    expect(review.totalPulses).toBe(2)
    expect(review.uniqueVenues).toBe(2)
    expect(review.topVenues.length).toBeGreaterThanOrEqual(1)
  })
})

describe('calculateMilesExplored', () => {
  it('sums distances between venues', () => {
    const pulses = [
      makePulse({ venueId: 'v1', createdAt: new Date(Date.now() - 60000).toISOString() }),
      makePulse({ venueId: 'v2', createdAt: new Date().toISOString() }),
    ]
    const venues = [
      makeVenue({ id: 'v1', location: { lat: 40.7, lng: -74.0, address: '' } }),
      makeVenue({ id: 'v2', location: { lat: 40.71, lng: -74.01, address: '' } }),
    ]
    const miles = calculateMilesExplored(pulses, venues)
    expect(miles).toBeGreaterThan(0)
  })

  it('returns 0 for single pulse', () => {
    expect(calculateMilesExplored([makePulse()], [makeVenue()])).toBe(0)
  })
})

describe('getInsightHighlights', () => {
  it('returns highlights', () => {
    const insights = {
      userId: 'u1', weekStart: '', venuesVisited: 3, uniqueVenues: 2,
      totalPulses: 5, energyContributed: { dead: 0, chill: 1, buzzing: 3, electric: 1 },
      milesExplored: 2.5, topVenue: 'Bar A', mostActiveDay: 5,
    }
    const highlights = getInsightHighlights(insights)
    expect(highlights.length).toBeGreaterThanOrEqual(1)
    expect(highlights.some(h => h.includes('Bar A'))).toBe(true)
  })
})
