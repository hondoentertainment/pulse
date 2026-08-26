import { describe, expect, it } from 'vitest'
import type { LiveReport } from '../live-intelligence'
import type { Pulse, Venue } from '../types'
import {
  DEFAULT_VENUE_SIGNAL_MODEL,
  SIGNAL_PROPAGATION_SLA_MS,
  VENUE_SIGNAL_MODEL_VERSION,
  computeVenueSignal,
  isSignalWithinPropagationSla,
} from '../venue-signal'

function makeVenue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: 'venue-1',
    name: 'Test Room',
    location: { lat: 47.61, lng: -122.32, address: 'Seattle, WA' },
    city: 'Seattle',
    state: 'WA',
    pulseScore: 0,
    seeded: true,
    inventorySource: 'curated-seed',
    ...overrides,
  }
}

function makePulse(overrides: Partial<Pulse> = {}): Pulse {
  const now = Date.now()
  return {
    id: 'pulse-1',
    userId: 'user-1',
    venueId: 'venue-1',
    photos: [],
    energyRating: 'electric',
    createdAt: new Date(now - 5 * 60_000).toISOString(),
    expiresAt: new Date(now + 80 * 60_000).toISOString(),
    reactions: { fire: ['user-2'], eyes: [], skull: [], lightning: [] },
    views: 4,
    ...overrides,
  }
}

describe('computeVenueSignal', () => {
  it('returns a versioned model configuration and curated-only source mix', () => {
    const signal = computeVenueSignal({ venue: makeVenue() })
    expect(signal.model_configuration.version).toBe(VENUE_SIGNAL_MODEL_VERSION)
    expect(signal.model_configuration.propagationSlaMs).toBe(SIGNAL_PROPAGATION_SLA_MS)
    expect(signal.sourceMix.sources).toEqual(['curated_seed'])
    expect(signal.confidence).toBe('low')
    expect(signal.energyScore).toBe(0)
  })

  it('unifies pulses and live intel into one score, confidence, and trend', () => {
    const now = new Date('2026-08-25T23:00:00.000Z')
    const pulses = [
      makePulse({ createdAt: '2026-08-25T22:50:00.000Z' }),
      makePulse({ id: 'pulse-2', createdAt: '2026-08-25T22:55:00.000Z', energyRating: 'buzzing' }),
      makePulse({ id: 'pulse-3', createdAt: '2026-08-25T22:58:00.000Z', energyRating: 'electric' }),
    ]
    const liveReports: LiveReport[] = [
      {
        id: 'report-1',
        venueId: 'venue-1',
        userId: 'user-2',
        type: 'crowd_level',
        value: 80,
        createdAt: '2026-08-25T22:40:00.000Z',
      },
      {
        id: 'report-2',
        venueId: 'venue-1',
        userId: 'user-3',
        type: 'wait_time',
        value: 8,
        createdAt: '2026-08-25T22:39:00.000Z',
      },
    ]

    const signal = computeVenueSignal({
      venue: makeVenue({
        lastPulseAt: '2026-08-25T22:40:00.000Z',
        scoreVelocity: 2.4,
        liveSummary: {
          reportCount: 2,
          waitTime: 8,
          coverCharge: null,
          crowdLevel: 80,
          dressCode: null,
          musicGenre: null,
          nowPlaying: null,
          confidence: { crowdLevel: 'medium', waitTime: 'medium' },
          lastReportAt: '2026-08-25T22:40:00.000Z',
          updatedAt: '2026-08-25T22:40:00.000Z',
        },
      }),
      pulses,
      liveReports,
      now,
      ingestedAt: new Date(now.getTime() - 8_000),
    })

    expect(signal.energyScore).toBeGreaterThan(40)
    expect(signal.confidence).toBe('medium')
    expect(signal.trend).toBe('rising')
    expect(signal.sourceMix.sources).toEqual(expect.arrayContaining(['pulse', 'live_intel']))
    expect(signal.friction.waitMinutes).toBe(8)
    expect(signal.withinPropagationSla).toBe(true)
  })

  it('decays live intel to zero once it is older than the model window', () => {
    const now = new Date('2026-08-25T23:00:00.000Z')
    const stale = computeVenueSignal({
      venue: makeVenue({
        liveSummary: {
          reportCount: 1,
          waitTime: 5,
          coverCharge: null,
          crowdLevel: 90,
          dressCode: null,
          musicGenre: null,
          nowPlaying: null,
          confidence: { crowdLevel: 'low' },
          lastReportAt: '2026-08-25T22:20:00.000Z',
          updatedAt: '2026-08-25T22:20:00.000Z',
        },
      }),
      liveReports: [{
        id: 'report-stale',
        venueId: 'venue-1',
        userId: 'user-2',
        type: 'crowd_level',
        value: 90,
        createdAt: '2026-08-25T22:20:00.000Z',
      }],
      now,
      model: { ...DEFAULT_VENUE_SIGNAL_MODEL, liveIntelDecayMinutes: 30 },
    })

    expect(stale.energyScore).toBe(0)
    expect(stale.freshnessMinutes).toBeGreaterThan(30)
  })

  it('fails the 30s SLA when computation lags ingestion', () => {
    const ingestedAt = new Date('2026-08-25T23:00:00.000Z')
    const computedAt = new Date(ingestedAt.getTime() + 31_000)
    expect(isSignalWithinPropagationSla(computedAt.toISOString(), ingestedAt.toISOString())).toBe(false)
    expect(isSignalWithinPropagationSla(new Date(ingestedAt.getTime() + 12_000).toISOString(), ingestedAt.toISOString())).toBe(true)
  })
})
