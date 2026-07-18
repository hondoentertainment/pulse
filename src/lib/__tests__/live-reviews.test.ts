import { describe, it, expect } from 'vitest'
import {
  buildLiveReviewProof,
  formatPulseTtlLabel,
  getLatestVenuePulsePhoto,
  getPulseTtlMinutes,
  LIVE_REVIEW_LABELS,
  sortLiveReviews,
} from '../live-reviews'
import type { Pulse, Venue } from '../types'

const venue: Venue = {
  id: 'v1',
  name: 'Test Club',
  location: { lat: 47.61, lng: -122.32, address: '1 Main' },
  city: 'Seattle',
  state: 'WA',
  category: 'Nightclub',
  pulseScore: 72,
}

function makePulse(overrides: Partial<Pulse> & { id: string }): Pulse {
  const now = Date.now()
  return {
    userId: 'u1',
    venueId: 'v1',
    photos: [],
    energyRating: 'buzzing',
    createdAt: new Date(now - 10 * 60 * 1000).toISOString(),
    expiresAt: new Date(now + 80 * 60 * 1000).toISOString(),
    reactions: { fire: [], eyes: [], skull: [], lightning: [] },
    views: 0,
    ...overrides,
  }
}

describe('buildLiveReviewProof', () => {
  it('returns empty labels when no recent pulses', () => {
    const proof = buildLiveReviewProof(venue, [])
    expect(proof.reportCount).toBe(0)
    expect(proof.proofLine).toBe(LIVE_REVIEW_LABELS.empty)
    expect(proof.proofChip).toBe(LIVE_REVIEW_LABELS.empty)
  })

  it('builds Google-style proof line from recent pulses', () => {
    const now = Date.now()
    const pulses = [
      makePulse({ id: 'p1', energyRating: 'buzzing', createdAt: new Date(now - 8 * 60 * 1000).toISOString() }),
      makePulse({ id: 'p2', energyRating: 'buzzing', createdAt: new Date(now - 12 * 60 * 1000).toISOString() }),
      makePulse({ id: 'p3', energyRating: 'electric', createdAt: new Date(now - 20 * 60 * 1000).toISOString() }),
    ]
    const proof = buildLiveReviewProof(venue, pulses, now)
    expect(proof.reportCount).toBe(3)
    expect(proof.proofLine).toMatch(/said buzzing/)
    expect(proof.proofLine).toMatch(/last/)
    expect(proof.proofChip).toMatch(/3 reviews/)
    expect(proof.proofSummary).toMatch(/3 live reviews/)
    expect(proof.dominantEnergy).toBe('buzzing')
  })
})

describe('pulse TTL labels', () => {
  it('formats fades-in countdown', () => {
    const now = Date.now()
    const pulse = makePulse({
      id: 'p1',
      createdAt: new Date(now - 50 * 60 * 1000).toISOString(),
      expiresAt: new Date(now + 40 * 60 * 1000).toISOString(),
    })
    expect(getPulseTtlMinutes(pulse, now)).toBe(40)
    expect(formatPulseTtlLabel(pulse, now)).toBe('Live · fades in 40m')
  })

  it('returns Expired when past expiresAt', () => {
    const now = Date.now()
    const pulse = makePulse({
      id: 'p1',
      expiresAt: new Date(now - 1000).toISOString(),
    })
    expect(getPulseTtlMinutes(pulse, now)).toBeNull()
    expect(formatPulseTtlLabel(pulse, now)).toBe('Expired')
  })
})

describe('getLatestVenuePulsePhoto', () => {
  it('returns newest photo from venue pulses', () => {
    const now = Date.now()
    const pulses = [
      makePulse({
        id: 'old',
        photos: ['old.jpg'],
        createdAt: new Date(now - 40 * 60 * 1000).toISOString(),
      }),
      makePulse({
        id: 'new',
        photos: ['new.jpg'],
        createdAt: new Date(now - 5 * 60 * 1000).toISOString(),
      }),
    ]
    expect(getLatestVenuePulsePhoto('v1', pulses, now)).toBe('new.jpg')
  })
})

describe('sortLiveReviews', () => {
  it('sorts newest first', () => {
    const now = Date.now()
    const sorted = sortLiveReviews([
      makePulse({ id: 'a', createdAt: new Date(now - 30 * 60 * 1000).toISOString() }),
      makePulse({ id: 'b', createdAt: new Date(now - 5 * 60 * 1000).toISOString() }),
    ])
    expect(sorted.map((p) => p.id)).toEqual(['b', 'a'])
  })
})
