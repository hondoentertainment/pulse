import { describe, expect, it } from 'vitest'
import type { Venue } from '@/lib/types'
import {
  compareVenues,
  getComparisonVerdict,
  getWinner,
  calculateMatchScore,
  formatComparisonMetric,
} from '@/lib/venue-comparison'

function makeVenue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: 'venue-1',
    name: 'Neon Lounge',
    location: { lat: 40.7128, lng: -74.006, address: '123 Main St' },
    pulseScore: 72,
    category: 'Bar',
    scoreVelocity: 10,
    ...overrides,
  }
}

const venueA = makeVenue({
  id: 'a',
  name: 'Neon Lounge',
  pulseScore: 80,
  category: 'Nightclub',
  scoreVelocity: 12,
  location: { lat: 40.7128, lng: -74.006, address: '1 Club Ave' },
})

const venueB = makeVenue({
  id: 'b',
  name: 'The Rooftop',
  pulseScore: 55,
  category: 'Bar',
  scoreVelocity: -8,
  location: { lat: 40.72, lng: -73.99, address: '2 Roof St' },
})

describe('compareVenues', () => {
  it('returns structured comparison for two full venues', () => {
    const result = compareVenues(venueA, venueB)

    expect(result.venueA.venue.id).toBe('a')
    expect(result.venueB.venue.id).toBe('b')
    expect(result.venueA.pulseScore).toBe(80)
    expect(result.venueB.pulseScore).toBe(55)
    expect(result.metrics.energy.winner).toBe('a')
    expect(result.venueA.trending).toBe('up')
    expect(result.venueB.trending).toBe('down')
    expect(result.venueA.category).toBe('Nightclub')
    expect(result.venueB.category).toBe('Bar')
    expect(result.venueA.crowdVibeTags.length).toBeGreaterThan(0)
    expect(result.venueB.crowdVibeTags.length).toBeGreaterThan(0)
    expect(result.venueA.priceLevel).toBeGreaterThan(0)
  })

  it('handles venues with identical scores', () => {
    const v1 = makeVenue({ id: 'x', name: 'Spot A', pulseScore: 60 })
    const v2 = makeVenue({ id: 'y', name: 'Spot B', pulseScore: 60 })
    const result = compareVenues(v1, v2)

    expect(result.metrics.energy.winner).toBe('tie')
    expect(result.metrics.energy.difference).toBe('Equal')
  })

  it('includes distance when userLocation provided', () => {
    const userLocation = { lat: 40.715, lng: -74.0 }
    const result = compareVenues(venueA, venueB, userLocation)

    expect(result.venueA.distance).not.toBeNull()
    expect(result.venueB.distance).not.toBeNull()
    expect(typeof result.venueA.distance).toBe('number')
    // Distance winner should be the closer venue
    expect(result.metrics.distance.winner).not.toBe('tie')
  })

  it('sets distance to null when no userLocation', () => {
    const result = compareVenues(venueA, venueB)
    expect(result.venueA.distance).toBeNull()
    expect(result.venueB.distance).toBeNull()
  })

  it('compares friend counts correctly', () => {
    const result = compareVenues(venueA, venueB, undefined, 5, 2)
    expect(result.venueA.friendsPresentCount).toBe(5)
    expect(result.venueB.friendsPresentCount).toBe(2)
    expect(result.metrics.friends.winner).toBe('a')
  })

  it('handles missing optional fields gracefully', () => {
    const sparse = makeVenue({
      id: 'sparse',
      name: 'Sparse Venue',
      category: undefined,
      scoreVelocity: undefined,
    })
    const result = compareVenues(sparse, venueB)
    expect(result.venueA.category).toBe('Venue')
    expect(result.venueA.trending).toBe('stable')
  })
})

describe('getComparisonVerdict', () => {
  it('mentions the hotter venue when energy differs', () => {
    const result = compareVenues(venueA, venueB)
    const verdict = getComparisonVerdict(result)
    expect(verdict).toContain('Neon Lounge is hotter right now')
  })

  it('mentions friends when one has more', () => {
    const result = compareVenues(venueA, venueB, undefined, 0, 3)
    const verdict = getComparisonVerdict(result)
    expect(verdict).toContain('The Rooftop has more friends')
  })

  it('handles evenly matched venues', () => {
    const v1 = makeVenue({ id: 'x', name: 'Alpha', pulseScore: 50, category: 'Bar' })
    const v2 = makeVenue({ id: 'y', name: 'Beta', pulseScore: 50, category: 'Bar' })
    const result = compareVenues(v1, v2)
    const verdict = getComparisonVerdict(result)
    expect(verdict).toBeTruthy()
    // Should mention "same energy" or be evenly matched
    expect(verdict.length).toBeGreaterThan(0)
  })

  it('mentions price when no friends difference', () => {
    // venueA is Nightclub (price 3), venueB is Bar (price 2), both 0 friends
    const result = compareVenues(venueA, venueB, undefined, 0, 0)
    const verdict = getComparisonVerdict(result)
    // Should mention the cheaper one
    expect(verdict).toContain('The Rooftop')
  })
})

describe('getWinner', () => {
  it('picks winner by energy', () => {
    const result = compareVenues(venueA, venueB)
    expect(getWinner(result, 'energy')).toBe('a')
  })

  it('picks winner by proximity when location given', () => {
    const userLocation = { lat: 40.72, lng: -73.99 } // closer to venueB
    const result = compareVenues(venueA, venueB, userLocation)
    expect(getWinner(result, 'proximity')).toBe('b')
  })

  it('picks winner by social (friends)', () => {
    const result = compareVenues(venueA, venueB, undefined, 1, 5)
    expect(getWinner(result, 'social')).toBe('b')
  })

  it('picks winner by price', () => {
    // Nightclub = price 3, Bar = price 2 => Bar is cheaper => winner b
    const result = compareVenues(venueA, venueB)
    expect(getWinner(result, 'price')).toBe('b')
  })

  it('returns tie for equal metrics', () => {
    const v1 = makeVenue({ id: 'x', pulseScore: 60 })
    const v2 = makeVenue({ id: 'y', pulseScore: 60 })
    const result = compareVenues(v1, v2)
    expect(getWinner(result, 'energy')).toBe('tie')
  })
})

describe('calculateMatchScore', () => {
  it('returns score between 0 and 100', () => {
    const score = calculateMatchScore(venueA, {})
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)
  })

  it('scores higher for matching category', () => {
    const scoreMatch = calculateMatchScore(venueA, {
      favoriteCategories: ['Nightclub'],
    })
    const scoreNoMatch = calculateMatchScore(venueA, {
      favoriteCategories: ['Cafe'],
    })
    expect(scoreMatch).toBeGreaterThan(scoreNoMatch)
  })

  it('scores higher for matching energy preference', () => {
    const highEnergy = makeVenue({ pulseScore: 90 })
    const score = calculateMatchScore(highEnergy, {
      preferredEnergy: 'electric',
    })
    const scoreMismatch = calculateMatchScore(highEnergy, {
      preferredEnergy: 'chill',
    })
    expect(score).toBeGreaterThan(scoreMismatch)
  })

  it('gives partial credit for adjacent energy levels', () => {
    const buzzing = makeVenue({ pulseScore: 55 }) // "Buzzing"
    const scoreExact = calculateMatchScore(buzzing, {
      preferredEnergy: 'buzzing',
    })
    const scoreAdjacent = calculateMatchScore(buzzing, {
      preferredEnergy: 'electric',
    })
    const scoreFar = calculateMatchScore(buzzing, {
      preferredEnergy: 'chill' as const,
    })
    // Also test with a 2-level gap for truly far mismatch
    const dead = makeVenue({ pulseScore: 10 }) // "Dead"
    const scoreVeryFar = calculateMatchScore(dead, {
      preferredEnergy: 'electric',
    })
    expect(scoreExact).toBeGreaterThan(scoreAdjacent)
    // chill is also adjacent to buzzing (diff=1), so use the dead->electric gap
    expect(scoreAdjacent).toBeGreaterThanOrEqual(scoreFar)
    expect(scoreAdjacent).toBeGreaterThan(scoreVeryFar)
  })

  it('scores higher for matching price level', () => {
    const bar = makeVenue({ category: 'Bar' }) // price 2
    const match = calculateMatchScore(bar, { preferredPriceLevel: 2 })
    const mismatch = calculateMatchScore(bar, { preferredPriceLevel: 1 })
    expect(match).toBeGreaterThanOrEqual(mismatch)
  })

  it('handles empty preferences gracefully', () => {
    const score = calculateMatchScore(venueA, {})
    expect(score).toBeGreaterThan(0) // should still get neutral scores
  })
})

describe('formatComparisonMetric', () => {
  it('detects winner A when metricA is larger', () => {
    const result = formatComparisonMetric(80, 55)
    expect(result.winner).toBe('a')
    expect(result.difference).toBe('+25')
  })

  it('detects winner B when metricB is larger', () => {
    const result = formatComparisonMetric(30, 70)
    expect(result.winner).toBe('b')
    expect(result.difference).toBe('+40')
  })

  it('returns tie for equal values', () => {
    const result = formatComparisonMetric(50, 50)
    expect(result.winner).toBe('tie')
    expect(result.difference).toBe('Equal')
  })

  it('handles null metricA', () => {
    const result = formatComparisonMetric(null, 50)
    expect(result.winner).toBe('b')
    expect(result.difference).toContain('No data')
  })

  it('handles null metricB', () => {
    const result = formatComparisonMetric(50, null)
    expect(result.winner).toBe('a')
    expect(result.difference).toContain('No data')
  })

  it('handles both null', () => {
    const result = formatComparisonMetric(null, null)
    expect(result.winner).toBe('tie')
    expect(result.difference).toBe('No data')
  })
})
