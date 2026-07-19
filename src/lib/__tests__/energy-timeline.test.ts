import { describe, it, expect } from 'vitest'
import {
  buildEnergyTimelineFromPulses,
  generateSyntheticTimeline,
} from '../energy-timeline'
import type { Pulse } from '../types'

function makePulse(overrides: Partial<Pulse> & { createdAt: string }): Pulse {
  return {
    id: 'p1',
    venueId: 'venue-1',
    userId: 'u1',
    energyRating: 'buzzing',
    caption: '',
    photos: [],
    reactions: { fire: [], lightning: [], eyes: [], skull: [] },
    views: 0,
    expiresAt: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
    ...overrides,
  }
}

describe('buildEnergyTimelineFromPulses', () => {
  const now = new Date('2026-07-15T22:00:00Z').getTime()

  it('returns honest empty timeline when no recent reports exist', () => {
    const summary = buildEnergyTimelineFromPulses('venue-1', [], 72, { now })
    expect(summary.usesSyntheticFallback).toBe(true)
    expect(summary.hasLiveHistory).toBe(false)
    expect(summary.trend).toBe('unknown')
    expect(summary.points).toHaveLength(12)
    expect(summary.points.every((v) => v === 0)).toBe(true)
  })

  it('builds rising trend from recent electric reports', () => {
    const pulses = [
      makePulse({
        id: 'old',
        energyRating: 'chill',
        createdAt: new Date(now - 4 * 60 * 60 * 1000).toISOString(),
      }),
      makePulse({
        id: 'mid',
        energyRating: 'buzzing',
        createdAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
      }),
      makePulse({
        id: 'new',
        energyRating: 'electric',
        createdAt: new Date(now - 20 * 60 * 1000).toISOString(),
      }),
    ]

    const summary = buildEnergyTimelineFromPulses('venue-1', pulses, 85, { now })
    expect(summary.usesSyntheticFallback).toBe(false)
    expect(summary.hasLiveHistory).toBe(true)
    expect(summary.trend).toBe('rising')
    expect(summary.points[summary.points.length - 1]).toBe(85)
  })

  it('generateSyntheticTimeline is stable for a venue id', () => {
    const a = generateSyntheticTimeline('venue-abc', 60)
    const b = generateSyntheticTimeline('venue-abc', 60)
    expect(a).toEqual(b)
  })
})
