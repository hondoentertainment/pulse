import { describe, it, expect } from 'vitest'
import { createVenueBoost } from '../promoted-discoveries'
import {
  assertBoostDoesNotAffectOrganicRanking,
  assertOrganicOrderPreserved,
  mergeTonightPicksWithSponsorship,
  mergeVenuesWithSponsorship,
} from '../sponsorship-integrity'
import type { TonightPick } from '../tonight-feed'
import type { Venue } from '../types'

function makeVenue(id: string, score = 50): Venue {
  return {
    id,
    name: `Venue ${id}`,
    location: { lat: 47.6, lng: -122.3, address: '' },
    pulseScore: score,
  }
}

function makePick(venue: Venue): TonightPick {
  return {
    recommendation: { venue, score: venue.pulseScore, reasons: [] },
    explanation: {
      headline: 'Test',
      explanation: 'Test explanation',
      worthGoing: 'maybe',
      confidenceLabel: 'Medium',
      freshnessLabel: 'Recent',
      frictionNotes: [],
    },
    confidence: 'medium',
    trend: 'steady',
    freshnessMinutes: 10,
    reportCount: 2,
    distanceMiles: 1,
    energyMatch: true,
  }
}

describe('sponsorship integrity contracts', () => {
  it('preserves organic venue order when inserting sponsored slots', () => {
    const venues = [makeVenue('o1', 90), makeVenue('s1', 40), makeVenue('o2', 80), makeVenue('o3', 70)]
    const promoted = new Set(['s1'])
    const merged = mergeVenuesWithSponsorship(venues, promoted)
    expect(assertOrganicOrderPreserved(venues, merged, promoted)).toBe(true)
    expect(merged.some((v) => v.id === 's1')).toBe(true)
  })

  it('proves boosts change boosted rank but organic path ignores them', () => {
    const scores = [
      { id: 'a', baseScore: 60 },
      { id: 'b', baseScore: 55 },
      { id: 'c', baseScore: 50 },
    ]
    const boosts = [createVenueBoost('c', 2, 4, 100)]
    expect(assertBoostDoesNotAffectOrganicRanking(scores, boosts)).toBe(true)
  })

  it('marks sponsored Tonight picks without reordering organic-only items', () => {
    const picks = [makePick(makeVenue('o1')), makePick(makeVenue('s1')), makePick(makeVenue('o2'))]
    const promoted = new Set(['s1'])
    const merged = mergeTonightPicksWithSponsorship(picks, promoted)
    const sponsored = merged.find((p) => p.recommendation.venue.id === 's1')
    expect(sponsored?.isSponsored).toBe(true)
    const organicIds = merged.filter((p) => !p.isSponsored).map((p) => p.recommendation.venue.id)
    expect(organicIds).toEqual(['o1', 'o2'])
  })
})
