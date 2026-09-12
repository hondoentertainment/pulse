import { describe, expect, it } from 'vitest'
import type { Pulse, Venue } from '../types'
import { buildTrustGlance, formatWhySurging, shouldShowMapTrustHover } from '../trust-glance'

function makeVenue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: 'v1',
    name: 'Neumos',
    location: { lat: 47.614, lng: -122.32, address: '1 Pike' },
    pulseScore: 88,
    ...overrides,
  }
}

function makePulse(overrides: Partial<Pulse> = {}): Pulse {
  return {
    id: 'p1',
    userId: 'u1',
    venueId: 'v1',
    photos: [],
    energyRating: 'electric',
    caption: 'Floor packed',
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

describe('buildTrustGlance', () => {
  it('shows freshness, GPS, and why-surging for a hot pin', () => {
    const nowMs = Date.parse('2026-09-10T21:00:00.000Z')
    const pulses = Array.from({ length: 8 }, (_, i) => makePulse({
      id: `p-${i}`,
      createdAt: new Date(nowMs - (i + 1) * 60 * 1000).toISOString(),
    }))
    const glance = buildTrustGlance(makeVenue(), pulses, nowMs)
    expect(glance.verification).toBe('GPS ✓')
    expect(glance.freshness).toBe('1m ago')
    expect(glance.whySurging).toBe('Why surging: +8 reviews / 20m')
    expect(glance.line).toContain('GPS ✓')
    expect(glance.line).toContain('Why surging')
    expect(glance.chips.map((chip) => chip.id)).toEqual(['freshness', 'verified', 'density'])
    expect(glance.chips[1].label).toBe('Verified')
    expect(glance.chips[2].tone).toBe('hot')
  })

  it('marks claimed venues as Claimed without inventing pulses', () => {
    const glance = buildTrustGlance(makeVenue({ claimVerified: true }), [], Date.now())
    expect(glance.chips[0].label).toBe('No pulses yet')
    expect(glance.chips[1].label).toBe('Claimed')
  })

  it('marks unverified soft signals', () => {
    const nowMs = Date.parse('2026-09-10T21:00:00.000Z')
    const glance = buildTrustGlance(
      makeVenue({ name: 'Barrio' }),
      [makePulse({
        locationVerified: false,
        createdAt: new Date(nowMs - 41 * 60 * 1000).toISOString(),
      })],
      nowMs,
    )
    expect(glance.verification).toBe('Unverified')
    expect(glance.whySurging).toBe('Soft signal')
    expect(glance.line).toContain('Unverified')
  })
})

describe('shouldShowMapTrustHover', () => {
  it('shows chips on heatmap and full chrome unless the camera is moving', () => {
    expect(shouldShowMapTrustHover({ hasHoveredVenue: true })).toBe(true)
    expect(shouldShowMapTrustHover({ hasHoveredVenue: true, isDragging: true })).toBe(false)
    expect(shouldShowMapTrustHover({ hasHoveredVenue: false })).toBe(false)
  })
})

describe('formatWhySurging', () => {
  it('requires at least 3 reviews in the window', () => {
    expect(formatWhySurging(2)).toBe('Soft signal')
    expect(formatWhySurging(3)).toBe('Why surging: +3 reviews / 20m')
  })
})
