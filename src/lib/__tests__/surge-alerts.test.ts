import { describe, it, expect } from 'vitest'
import {
  meetsSurgeConfidenceGate,
  shouldEmitSurgeAlert,
  SURGE_SCORE_THRESHOLD,
  MIN_SURGE_SCORE_INCREASE,
} from '../surge-alerts'

describe('surge-alerts confidence gate', () => {
  it('allows medium and high confidence only by default', () => {
    expect(meetsSurgeConfidenceGate('none')).toBe(false)
    expect(meetsSurgeConfidenceGate('low')).toBe(false)
    expect(meetsSurgeConfidenceGate('medium')).toBe(true)
    expect(meetsSurgeConfidenceGate('high')).toBe(true)
  })

  it('emits when score surge, proximity, and confidence all pass', () => {
    expect(
      shouldEmitSurgeAlert({
        currentScore: SURGE_SCORE_THRESHOLD + 5,
        lastScore: SURGE_SCORE_THRESHOLD + 5 - MIN_SURGE_SCORE_INCREASE,
        lastAlertTime: 0,
        alertCount: 0,
        now: 1_000_000,
        confidence: 'medium',
        distanceMiles: 1,
      }),
    ).toBe(true)
  })

  it('blocks low-confidence surges even when score spikes', () => {
    expect(
      shouldEmitSurgeAlert({
        currentScore: 90,
        lastScore: 40,
        lastAlertTime: 0,
        alertCount: 0,
        now: 1_000_000,
        confidence: 'low',
        distanceMiles: 0.5,
      }),
    ).toBe(false)
  })

  it('blocks distant venues', () => {
    expect(
      shouldEmitSurgeAlert({
        currentScore: 90,
        lastScore: 40,
        lastAlertTime: 0,
        alertCount: 0,
        now: 1_000_000,
        confidence: 'high',
        distanceMiles: 12,
      }),
    ).toBe(false)
  })
})
