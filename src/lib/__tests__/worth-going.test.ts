import { describe, expect, it } from 'vitest'
import { DEFAULT_VENUE_SIGNAL_MODEL, type VenueSignal } from '../venue-signal'
import { buildWorthGoingSummary } from '../worth-going'

function makeSignal(overrides: Partial<VenueSignal> = {}): VenueSignal {
  return {
    venueId: 'venue-1',
    model_configuration: DEFAULT_VENUE_SIGNAL_MODEL,
    energyScore: 72,
    energyLabel: 'Buzzing',
    confidence: 'high',
    trend: 'rising',
    freshnessMinutes: 6,
    sourceMix: { pulses: 3, liveReports: 2, curatedSeed: true, sources: ['pulse', 'live_intel'] },
    friction: { waitMinutes: 5, lineStatus: 'moving', coverCharge: 10, label: '~5 min door · $10 cover' },
    computedAt: new Date().toISOString(),
    withinPropagationSla: true,
    ...overrides,
  }
}

describe('buildWorthGoingSummary', () => {
  it('returns a single-block verdict with confidence, freshness, friction, and source mix', () => {
    const summary = buildWorthGoingSummary(makeSignal())
    expect(summary.verdict).toBe('go')
    expect(summary.headline).toBe('Worth going')
    expect(summary.confidence).toBe('high')
    expect(summary.freshness).toContain('Fresh')
    expect(summary.friction).toContain('5 min')
    expect(summary.sourceMix).toContain('3 pulses')
    expect(summary.sourceMix).toContain('2 live reports')
  })

  it('does not invent a go verdict from curated seed alone', () => {
    const summary = buildWorthGoingSummary(makeSignal({
      energyScore: 0,
      energyLabel: 'Dead',
      confidence: 'low',
      trend: 'unknown',
      freshnessMinutes: null,
      sourceMix: { pulses: 0, liveReports: 0, curatedSeed: true, sources: ['curated_seed'] },
      friction: { waitMinutes: null, lineStatus: null, coverCharge: null, label: 'Door friction unknown' },
    }))
    expect(summary.verdict).toBe('unknown')
    expect(summary.sourceMix).toContain('Curated seed')
  })
})
