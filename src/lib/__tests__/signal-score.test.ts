import { describe, expect, it } from 'vitest'
import { computeDraftScore, scoreBucket, scoreBucketLabel } from '@/lib/signal-score'

describe('signal-score', () => {
  it('computes a mid-range score for balanced draft', () => {
    const score = computeDraftScore({ energy: 7, mood: 7, stress: 4, sleepQuality: 7 })
    expect(score).toBeGreaterThan(40)
    expect(score).toBeLessThan(90)
  })

  it('lowers score when stress is high', () => {
    const calm = computeDraftScore({ energy: 7, mood: 7, stress: 3, sleepQuality: 7 })
    const stressed = computeDraftScore({ energy: 7, mood: 7, stress: 9, sleepQuality: 7 })
    expect(stressed).toBeLessThan(calm)
  })

  it('maps buckets to labels', () => {
    expect(scoreBucketLabel(scoreBucket(30))).toBe('Recovery mode')
    expect(scoreBucketLabel(scoreBucket(55))).toBe('Steady')
    expect(scoreBucketLabel(scoreBucket(85))).toBe('Peak signal')
  })
})
