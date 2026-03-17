import { describe, expect, it } from 'vitest'
import type { Venue, User } from '@/lib/types'
import {
  pickTonightsVenue,
  generateExplanation,
  getAlternates,
  shouldShowPick,
  refreshPick,
  type TonightsPick,
  type PickParams,
} from '@/lib/tonights-pick'

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makeVenue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: 'venue-1',
    name: 'The Midnight Bar',
    location: { lat: 47.6145, lng: -122.3205, address: '123 Main St' },
    pulseScore: 70,
    category: 'Cocktail Bar',
    scoreVelocity: 5,
    ...overrides,
  }
}

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    username: 'testuser',
    friends: ['friend-1', 'friend-2'],
    createdAt: new Date().toISOString(),
    favoriteCategories: ['cocktail bar'],
    venueCheckInHistory: {},
    ...overrides,
  }
}

function makeParams(overrides: Partial<PickParams> = {}): PickParams {
  return {
    venues: [makeVenue()],
    user: makeUser(),
    userLocation: { lat: 47.6145, lng: -122.3205 },
    currentTime: new Date('2026-03-17T21:00:00'),
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// pickTonightsVenue
// ---------------------------------------------------------------------------

describe('pickTonightsVenue', () => {
  it('returns null for empty venues', () => {
    const result = pickTonightsVenue(makeParams({ venues: [] }))
    expect(result).toBeNull()
  })

  it('picks the highest-scoring venue from multiple options', () => {
    const venues = [
      makeVenue({ id: 'v1', name: 'Low Key', pulseScore: 20, scoreVelocity: 0 }),
      makeVenue({ id: 'v2', name: 'Hot Spot', pulseScore: 90, scoreVelocity: 8 }),
      makeVenue({ id: 'v3', name: 'Medium Vibes', pulseScore: 50, scoreVelocity: 3 }),
    ]
    const result = pickTonightsVenue(makeParams({ venues }))

    expect(result).not.toBeNull()
    expect(result!.venue.id).toBe('v2')
    expect(result!.score).toBeGreaterThan(0)
  })

  it('includes reasons array for the pick', () => {
    const result = pickTonightsVenue(makeParams())

    expect(result).not.toBeNull()
    expect(result!.reasons.length).toBeGreaterThan(0)
  })

  it('returns alternates different from the pick', () => {
    const venues = [
      makeVenue({ id: 'v1', name: 'Pick', pulseScore: 90 }),
      makeVenue({ id: 'v2', name: 'Alt 1', pulseScore: 70 }),
      makeVenue({ id: 'v3', name: 'Alt 2', pulseScore: 60 }),
    ]
    const result = pickTonightsVenue(makeParams({ venues }))

    expect(result).not.toBeNull()
    expect(result!.alternates.every((a) => a.id !== result!.venue.id)).toBe(true)
  })

  it('has a confidence between 0 and 1', () => {
    const venues = [
      makeVenue({ id: 'v1', pulseScore: 90 }),
      makeVenue({ id: 'v2', pulseScore: 30 }),
    ]
    const result = pickTonightsVenue(makeParams({ venues }))

    expect(result).not.toBeNull()
    expect(result!.confidence).toBeGreaterThanOrEqual(0)
    expect(result!.confidence).toBeLessThanOrEqual(1)
  })
})

// ---------------------------------------------------------------------------
// Scoring weight distribution
// ---------------------------------------------------------------------------

describe('scoring weight distribution', () => {
  it('pulse score and trending have the strongest influence (30%)', () => {
    const lowPulse = makeVenue({ id: 'low', pulseScore: 10, scoreVelocity: 0 })
    const highPulse = makeVenue({ id: 'high', pulseScore: 95, scoreVelocity: 9 })

    // Use a user with no preferences to isolate the pulse/trending factor
    const neutralUser = makeUser({
      favoriteCategories: [],
      venueCheckInHistory: {},
    })

    const result = pickTonightsVenue(
      makeParams({
        venues: [lowPulse, highPulse],
        user: neutralUser,
        friendActivity: undefined,
      }),
    )

    expect(result).not.toBeNull()
    expect(result!.venue.id).toBe('high')
  })

  it('friend presence boosts a venue score', () => {
    const venueA = makeVenue({ id: 'a', name: 'No Friends', pulseScore: 60, scoreVelocity: 0 })
    const venueB = makeVenue({ id: 'b', name: 'Friend Spot', pulseScore: 55, scoreVelocity: 0 })

    const friendActivity = {
      b: { count: 3, friendIds: ['f1', 'f2', 'f3'] },
    }

    const result = pickTonightsVenue(
      makeParams({
        venues: [venueA, venueB],
        friendActivity,
        user: makeUser({ favoriteCategories: [] }),
      }),
    )

    expect(result).not.toBeNull()
    expect(result!.venue.id).toBe('b')
  })

  it('time-appropriateness favors nightclubs late at night over cafes', () => {
    const cafe = makeVenue({ id: 'cafe', name: 'Coffee Shop', category: 'Cafe', pulseScore: 50, scoreVelocity: 0 })
    const club = makeVenue({ id: 'club', name: 'Night Club', category: 'Nightclub', pulseScore: 50, scoreVelocity: 0 })

    const result = pickTonightsVenue(
      makeParams({
        venues: [cafe, club],
        currentTime: new Date('2026-03-17T23:30:00'),
        user: makeUser({ favoriteCategories: [] }),
      }),
    )

    expect(result).not.toBeNull()
    expect(result!.venue.id).toBe('club')
  })

  it('novelty bonus helps unvisited venues', () => {
    // Both venues have the same pulse score. The visited one gets a small user-preference
    // boost from history, but the unvisited one should get a novelty reason.
    const visited = makeVenue({ id: 'visited', pulseScore: 50, scoreVelocity: 0, category: 'Bar' })
    const unvisited = makeVenue({ id: 'unvisited', pulseScore: 50, scoreVelocity: 0, category: 'Bar' })

    const result = pickTonightsVenue(
      makeParams({
        venues: [visited, unvisited],
        user: makeUser({
          favoriteCategories: [],
          venueCheckInHistory: {},
          favoriteVenues: [],
        }),
        recentCheckins: ['visited'],
        friendActivity: {},
      }),
    )

    expect(result).not.toBeNull()
    // The unvisited venue should get a novelty bonus reason
    const unvisitedPick = result!.venue.id === 'unvisited'
    const hasNoveltyReason = result!.reasons.some((r) => r.includes('new spot'))
    // Either the unvisited venue wins or the novelty reason appears for the unvisited alternate
    expect(unvisitedPick || hasNoveltyReason).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// generateExplanation
// ---------------------------------------------------------------------------

describe('generateExplanation', () => {
  it('generates an explanation with venue name', () => {
    const pick: TonightsPick = {
      venue: makeVenue({ name: 'Blue Moon' }),
      score: 0.8,
      reasons: ['surging right now', '3 friends nearby'],
      explanation: '',
      confidence: 0.7,
      alternates: [],
    }

    const explanation = generateExplanation(pick)
    expect(explanation).toContain('Blue Moon')
  })

  it('combines favorite and trending into a single explanation', () => {
    const pick: TonightsPick = {
      venue: makeVenue({ name: 'Sip', category: 'Cocktail Bar' }),
      score: 0.8,
      reasons: ['your favorite cocktail bar', 'surging right now', '4 friends nearby'],
      explanation: '',
      confidence: 0.7,
      alternates: [],
    }

    const explanation = generateExplanation(pick)
    expect(explanation).toContain('favorite')
    expect(explanation).toContain('surging')
  })

  it('handles novelty reason', () => {
    const pick: TonightsPick = {
      venue: makeVenue({ name: 'New Place' }),
      score: 0.5,
      reasons: ['new spot for you'],
      explanation: '',
      confidence: 0.5,
      alternates: [],
    }

    const explanation = generateExplanation(pick)
    expect(explanation).toContain('new spot')
  })

  it('handles empty reasons gracefully', () => {
    const pick: TonightsPick = {
      venue: makeVenue({ name: 'Default' }),
      score: 0.3,
      reasons: [],
      explanation: '',
      confidence: 0.3,
      alternates: [],
    }

    const explanation = generateExplanation(pick)
    expect(explanation).toContain('Default')
    expect(explanation).toContain('great tonight')
  })
})

// ---------------------------------------------------------------------------
// getAlternates
// ---------------------------------------------------------------------------

describe('getAlternates', () => {
  it('returns venues different from the pick', () => {
    const venues = [
      makeVenue({ id: 'a' }),
      makeVenue({ id: 'b' }),
      makeVenue({ id: 'c' }),
      makeVenue({ id: 'd' }),
    ]
    const pick: TonightsPick = {
      venue: venues[0],
      score: 0.9,
      reasons: [],
      explanation: '',
      confidence: 0.8,
      alternates: [],
    }

    const alts = getAlternates(venues, pick, 2)
    expect(alts).toHaveLength(2)
    expect(alts.every((a) => a.id !== 'a')).toBe(true)
  })

  it('returns up to count venues', () => {
    const venues = [makeVenue({ id: 'a' }), makeVenue({ id: 'b' })]
    const pick: TonightsPick = {
      venue: venues[0],
      score: 0.9,
      reasons: [],
      explanation: '',
      confidence: 0.8,
      alternates: [],
    }

    const alts = getAlternates(venues, pick, 5)
    expect(alts).toHaveLength(1) // Only 1 alternate possible
  })

  it('returns empty array when no other venues exist', () => {
    const venues = [makeVenue({ id: 'only' })]
    const pick: TonightsPick = {
      venue: venues[0],
      score: 0.9,
      reasons: [],
      explanation: '',
      confidence: 0.8,
      alternates: [],
    }

    const alts = getAlternates(venues, pick, 3)
    expect(alts).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// shouldShowPick
// ---------------------------------------------------------------------------

describe('shouldShowPick', () => {
  it('returns true at 5 PM', () => {
    expect(shouldShowPick(new Date('2026-03-17T17:00:00'))).toBe(true)
  })

  it('returns true at 9 PM', () => {
    expect(shouldShowPick(new Date('2026-03-17T21:00:00'))).toBe(true)
  })

  it('returns true at 1 AM', () => {
    expect(shouldShowPick(new Date('2026-03-18T01:00:00'))).toBe(true)
  })

  it('returns false at 2 AM', () => {
    expect(shouldShowPick(new Date('2026-03-18T02:00:00'))).toBe(false)
  })

  it('returns false at 10 AM', () => {
    expect(shouldShowPick(new Date('2026-03-17T10:00:00'))).toBe(false)
  })

  it('returns false at 3 PM', () => {
    expect(shouldShowPick(new Date('2026-03-17T15:00:00'))).toBe(false)
  })

  it('returns true at 11:59 PM', () => {
    expect(shouldShowPick(new Date('2026-03-17T23:59:00'))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// refreshPick
// ---------------------------------------------------------------------------

describe('refreshPick', () => {
  it('does not refresh when same venue and similar score', () => {
    const currentPick: TonightsPick = {
      venue: makeVenue({ id: 'v1', pulseScore: 70 }),
      score: 0.6,
      reasons: ['buzzing tonight'],
      explanation: 'The Midnight Bar is buzzing tonight',
      confidence: 0.7,
      alternates: [],
    }

    const newData = makeParams({
      venues: [makeVenue({ id: 'v1', pulseScore: 72 })],
    })

    const result = refreshPick(currentPick, newData)
    expect(result.shouldRefresh).toBe(false)
  })

  it('refreshes when a significantly better venue emerges', () => {
    const currentPick: TonightsPick = {
      venue: makeVenue({ id: 'v1', pulseScore: 50 }),
      score: 0.4,
      reasons: [],
      explanation: '',
      confidence: 0.5,
      alternates: [],
    }

    const newData = makeParams({
      venues: [
        makeVenue({ id: 'v1', pulseScore: 50 }),
        makeVenue({ id: 'v2', pulseScore: 95, scoreVelocity: 9 }),
      ],
    })

    const result = refreshPick(currentPick, newData)
    expect(result.shouldRefresh).toBe(true)
    expect(result.newPick).not.toBeNull()
    expect(result.newPick!.venue.id).toBe('v2')
  })

  it('refreshes when score changes significantly for same venue', () => {
    const currentPick: TonightsPick = {
      venue: makeVenue({ id: 'v1', pulseScore: 50 }),
      score: 0.3,
      reasons: [],
      explanation: '',
      confidence: 0.5,
      alternates: [],
    }

    const newData = makeParams({
      venues: [makeVenue({ id: 'v1', pulseScore: 95, scoreVelocity: 9 })],
    })

    const result = refreshPick(currentPick, newData)
    expect(result.shouldRefresh).toBe(true)
  })

  it('returns shouldRefresh false when no venues provided', () => {
    const currentPick: TonightsPick = {
      venue: makeVenue(),
      score: 0.5,
      reasons: [],
      explanation: '',
      confidence: 0.5,
      alternates: [],
    }

    const result = refreshPick(currentPick, makeParams({ venues: [] }))
    expect(result.shouldRefresh).toBe(false)
    expect(result.newPick).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('edge cases', () => {
  it('handles single venue', () => {
    const result = pickTonightsVenue(makeParams({ venues: [makeVenue()] }))
    expect(result).not.toBeNull()
    expect(result!.alternates).toHaveLength(0)
  })

  it('handles all venues far away', () => {
    const farVenues = [
      makeVenue({ id: 'v1', location: { lat: 0, lng: 0, address: 'Far away' } }),
      makeVenue({ id: 'v2', location: { lat: -33.8, lng: 151.2, address: 'Sydney' } }),
    ]

    const result = pickTonightsVenue(
      makeParams({
        venues: farVenues,
        userLocation: { lat: 47.6, lng: -122.3 },
      }),
    )

    expect(result).not.toBeNull()
    // Should still pick something even if far away
    expect(result!.score).toBeGreaterThan(0)
  })

  it('handles user with no friends', () => {
    const result = pickTonightsVenue(
      makeParams({
        user: makeUser({ friends: [] }),
      }),
    )

    expect(result).not.toBeNull()
  })

  it('handles null user location', () => {
    const result = pickTonightsVenue(
      makeParams({ userLocation: null }),
    )

    expect(result).not.toBeNull()
  })

  it('handles user with no check-in history or preferences', () => {
    const result = pickTonightsVenue(
      makeParams({
        user: makeUser({
          favoriteCategories: [],
          venueCheckInHistory: {},
          favoriteVenues: [],
        }),
      }),
    )

    expect(result).not.toBeNull()
  })
})
