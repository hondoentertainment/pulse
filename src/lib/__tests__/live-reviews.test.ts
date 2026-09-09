import { describe, expect, it } from 'vitest'
import type { Pulse } from '../types'
import type { VenueClaim } from '../venue-owner'
import {
  canAccessVenueInbox,
  canPostLiveReview,
  countLiveReviewsInWindow,
  energyChipLabel,
  evaluateLocationProof,
  getLiveNowReviews,
  getTonightLiveReviews,
  isLiveReview,
  isWithinLiveNowWindow,
  LIVE_NOW_WINDOW_MINUTES,
  LIVE_REVIEW_CAPTION_MAX,
  mapLiveReviewFields,
  snippetCaption,
  tonightWindowStart,
  validateLiveReviewCaption,
} from '../live-reviews'

function makePulse(overrides: Partial<Pulse> = {}): Pulse {
  return {
    id: `p-${Math.random()}`,
    userId: 'user-1',
    venueId: 'venue-1',
    photos: [],
    energyRating: 'buzzing',
    caption: 'Packed dance floor',
    kind: 'review',
    hasBody: true,
    locationVerified: true,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
    reactions: { fire: [], eyes: [], skull: [], lightning: [] },
    views: 0,
    ...overrides,
  }
}

describe('validateLiveReviewCaption', () => {
  it('requires a non-empty caption', () => {
    expect(validateLiveReviewCaption('').ok).toBe(false)
    expect(validateLiveReviewCaption('   ').ok).toBe(false)
  })

  it('accepts captions up to 280 characters', () => {
    const ok = validateLiveReviewCaption('Great energy tonight')
    expect(ok.ok).toBe(true)
    expect(ok.caption).toBe('Great energy tonight')
    expect(validateLiveReviewCaption('a'.repeat(LIVE_REVIEW_CAPTION_MAX)).ok).toBe(true)
  })

  it('rejects captions over 280 characters', () => {
    expect(validateLiveReviewCaption('a'.repeat(LIVE_REVIEW_CAPTION_MAX + 1)).ok).toBe(false)
  })
})

describe('isLiveReview', () => {
  it('treats kind=review as a live review', () => {
    expect(isLiveReview(makePulse({ kind: 'review', caption: '' }))).toBe(true)
  })

  it('does not treat explicit energy-only pulses as reviews', () => {
    expect(isLiveReview(makePulse({ kind: 'pulse', caption: 'still a pulse', hasBody: true }))).toBe(false)
  })

  it('treats legacy captioned pulses without kind as reviews', () => {
    expect(isLiveReview(makePulse({ kind: undefined, caption: 'Old captioned pulse' }))).toBe(true)
  })
})

describe('evaluateLocationProof', () => {
  const venue = { lat: 47.6062, lng: -122.3321 }

  it('marks unverified when GPS is missing', () => {
    expect(evaluateLocationProof(null, venue)).toEqual({
      locationVerified: false,
      reason: 'location_unavailable',
    })
  })

  it('verifies when the user is inside the check-in radius', () => {
    const proof = evaluateLocationProof({ lat: 47.6062, lng: -122.3321 }, venue)
    expect(proof.locationVerified).toBe(true)
    expect(proof.reason).toBe('verified')
  })

  it('marks unverified when the user is outside the radius', () => {
    const proof = evaluateLocationProof({ lat: 47.7, lng: -122.4 }, venue)
    expect(proof.locationVerified).toBe(false)
    expect(proof.reason).toBe('outside_radius')
    expect(proof.distanceMi).toBeGreaterThan(0.062)
  })
})

describe('live now window', () => {
  it('includes reviews inside the 90 minute window', () => {
    const recent = makePulse({
      createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    })
    const stale = makePulse({
      id: 'stale',
      createdAt: new Date(Date.now() - (LIVE_NOW_WINDOW_MINUTES + 5) * 60 * 1000).toISOString(),
    })
    const live = getLiveNowReviews([recent, stale], 'venue-1')
    expect(live.map((p) => p.id)).toEqual([recent.id])
    expect(countLiveReviewsInWindow([recent, stale], 'venue-1')).toBe(1)
  })

  it('rejects future timestamps', () => {
    expect(isWithinLiveNowWindow(new Date(Date.now() + 60_000).toISOString())).toBe(false)
  })
})

describe('canPostLiveReview', () => {
  it('enforces the per-venue cooldown', () => {
    const recent = makePulse({
      userId: 'me',
      createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    })
    const blocked = canPostLiveReview('venue-1', [recent])
    expect(blocked.canPost).toBe(false)
    expect(blocked.remainingMinutes ?? 0).toBeGreaterThan(0)
  })
})

describe('tonight inbox helpers', () => {
  it('starts tonight at 16:00, or yesterday 16:00 before then', () => {
    const afternoon = new Date('2026-09-09T18:00:00')
    const morning = new Date('2026-09-09T10:00:00')
    expect(tonightWindowStart(afternoon).getHours()).toBe(16)
    expect(tonightWindowStart(afternoon).getDate()).toBe(9)
    expect(tonightWindowStart(morning).getDate()).toBe(8)
  })

  it('returns only tonight live reviews for a venue', () => {
    const now = new Date('2026-09-09T20:00:00')
    const tonight = makePulse({
      id: 'tonight',
      createdAt: new Date('2026-09-09T18:30:00').toISOString(),
    })
    const yesterday = makePulse({
      id: 'yesterday',
      createdAt: new Date('2026-09-08T12:00:00').toISOString(),
    })
    const otherVenue = makePulse({
      id: 'other',
      venueId: 'venue-2',
      createdAt: new Date('2026-09-09T18:30:00').toISOString(),
    })
    expect(getTonightLiveReviews([tonight, yesterday, otherVenue], 'venue-1', now).map((p) => p.id)).toEqual(['tonight'])
  })
})

describe('canAccessVenueInbox', () => {
  it('denies anonymous users', () => {
    expect(canAccessVenueInbox({ userId: null, venueId: 'venue-1' })).toBe(false)
  })

  it('allows a verified claimant', () => {
    const claims: VenueClaim[] = [{
      id: 'c1',
      venueId: 'venue-1',
      claimantUserId: 'owner-1',
      businessName: 'Test',
      businessEmail: 'a@b.com',
      verificationMethod: 'email',
      status: 'verified',
      createdAt: new Date().toISOString(),
    }]
    expect(canAccessVenueInbox({ userId: 'owner-1', venueId: 'venue-1', claims })).toBe(true)
    expect(canAccessVenueInbox({ userId: 'owner-1', venueId: 'venue-2', claims })).toBe(false)
  })

  it('allows venue staff', () => {
    expect(canAccessVenueInbox({
      userId: 'staff-1',
      venueId: 'venue-1',
      staffRoles: [{ venueId: 'venue-1', userId: 'staff-1' }],
    })).toBe(true)
  })
})

describe('mapLiveReviewFields', () => {
  it('maps row columns onto the Pulse shape', () => {
    expect(mapLiveReviewFields({
      kind: 'review',
      location_verified: true,
      caption: '  packed  ',
    })).toEqual({
      kind: 'review',
      locationVerified: true,
      hasBody: true,
    })
  })
})

describe('snippetCaption / energyChipLabel', () => {
  it('truncates long captions', () => {
    expect(snippetCaption('short')).toBe('short')
    expect(snippetCaption('a'.repeat(90), 80).endsWith('…')).toBe(true)
  })

  it('labels energy chips', () => {
    expect(energyChipLabel('electric')).toBe('Electric')
  })
})
