import { describe, expect, it } from 'vitest'
import { getVenueFreshness, getVenueSignalFreshness, isVenueRealtimeTrusted } from '../venue-freshness'
import type { Venue } from '../types'

function makeVenue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: 'venue-1',
    name: 'Test Venue',
    location: { lat: 40.7128, lng: -74.006, address: '123 Test St' },
    pulseScore: 50,
    ...overrides,
  }
}

describe('venue freshness', () => {
  const now = new Date('2026-04-29T12:00:00Z')

  it('marks recent signals as fresh', () => {
    const freshness = getVenueSignalFreshness('pulseScore', '2026-04-29T11:55:00Z', now)
    expect(freshness.status).toBe('fresh')
    expect(freshness.ageMinutes).toBe(5)
  })

  it('marks aging signals as stale before they become untrusted', () => {
    const freshness = getVenueSignalFreshness('waitTime', '2026-04-29T11:45:00Z', now)
    expect(freshness.status).toBe('stale')
  })

  it('marks missing or old signals as untrusted', () => {
    expect(getVenueSignalFreshness('crowdLevel', undefined, now).status).toBe('untrusted')
    expect(getVenueSignalFreshness('crowdLevel', '2026-04-29T10:00:00Z', now).status).toBe('untrusted')
  })

  it('summarizes venue freshness from pulse and live report timestamps', () => {
    const venue = makeVenue({
      lastPulseAt: '2026-04-29T11:58:00Z',
      liveSummary: {
        reportCount: 3,
        waitTime: 8,
        coverCharge: null,
        crowdLevel: 72,
        dressCode: null,
        musicGenre: 'House',
        nowPlaying: null,
        confidence: { waitTime: 'medium', crowdLevel: 'medium' },
        lastReportAt: '2026-04-29T11:50:00Z',
        updatedAt: '2026-04-29T11:51:00Z',
      },
    })

    const freshness = getVenueFreshness(venue, now)
    expect(freshness.pulseScore.status).toBe('fresh')
    expect(freshness.crowdLevel.status).toBe('fresh')
    expect(isVenueRealtimeTrusted(venue, now)).toBe(true)
  })

  it('does not trust venues without fresh pulse or live report signals', () => {
    const venue = makeVenue({ lastPulseAt: '2026-04-29T08:00:00Z' })
    expect(isVenueRealtimeTrusted(venue, now)).toBe(false)
  })
})
