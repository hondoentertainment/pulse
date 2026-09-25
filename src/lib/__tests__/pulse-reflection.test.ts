import { describe, expect, it, beforeEach } from 'vitest'
import {
  recordPulseReflection,
  reflectionPercentile,
  resetPulseReflectionSamples,
} from '../pulse-reflection'

describe('pulse reflection latency', () => {
  beforeEach(() => {
    resetPulseReflectionSamples()
  })

  it('computes p95 from created_at to local reflection', () => {
    expect(reflectionPercentile([10, 20, 30, 40, 100], 95)).toBe(100)
    const createdAt = '2026-09-24T04:00:00.000Z'
    const sample = recordPulseReflection({
      pulseId: 'p1',
      createdAt,
      reflectedAtMs: Date.parse(createdAt) + 800,
    })
    expect(sample).toEqual({
      pulseId: 'p1',
      latencyMs: 800,
      p95Ms: 800,
      sampleCount: 1,
    })
  })

  it('drops clock-skewed or stale samples', () => {
    expect(recordPulseReflection({
      pulseId: 'future',
      createdAt: '2026-09-24T05:00:00.000Z',
      reflectedAtMs: Date.parse('2026-09-24T04:00:00.000Z'),
    })).toBeNull()
  })
})
