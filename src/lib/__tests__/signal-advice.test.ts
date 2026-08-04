import { describe, expect, it } from 'vitest'
import {
  getPersonalizedAdvice,
  daysSinceTagLogged,
  MIN_ADVICE_DELTA,
  STALE_LIFT_DAYS,
} from '@/lib/signal-advice'
import type { SignalEntry } from '@/lib/signal-insights'

let seq = 0
/** Build an entry at a LOCAL date/time so assertions are timezone-independent. */
function entry(day: number, score: number, tags: string[] = [], hour = 9): SignalEntry {
  seq += 1
  return {
    id: `a${seq}`,
    userId: 'u1',
    createdAt: new Date(2026, 6, day, hour, 0, 0).toISOString(),
    focus: 'energy',
    score,
    energy: 7,
    mood: 7,
    stress: 4,
    sleepQuality: 7,
    tags,
  }
}

const NOW = new Date(2026, 6, 20, 12, 0, 0)

describe('daysSinceTagLogged', () => {
  it('returns null when the tag was never used', () => {
    expect(daysSinceTagLogged([entry(19, 70, ['calm'])], 'active', NOW)).toBeNull()
  })

  it('counts whole calendar days back to the most recent use', () => {
    const entries = [entry(20, 70, ['active']), entry(15, 70, ['active'])]
    expect(daysSinceTagLogged(entries, 'active', NOW)).toBe(0)
  })

  it('measures from the latest occurrence, not the earliest', () => {
    const entries = [entry(10, 70, ['active']), entry(17, 70, ['active'])]
    expect(daysSinceTagLogged(entries, 'active', NOW)).toBe(3)
  })
})

describe('getPersonalizedAdvice', () => {
  it('falls back to rule-based advice with no history', () => {
    const advice = getPersonalizedAdvice([], null, NOW)
    expect(advice.source).toBe('rule')
    expect(advice.text.length).toBeGreaterThan(0)
  })

  it('falls back when correlations are weaker than the noise threshold', () => {
    // active days 71 vs 70 → delta 1, far below MIN_ADVICE_DELTA
    const entries = [
      entry(18, 71, ['active']),
      entry(17, 71, ['active']),
      entry(16, 70, ['calm']),
      entry(15, 70, ['calm']),
    ]
    expect(getPersonalizedAdvice(entries, null, NOW).source).toBe('rule')
  })

  it('calls out a drain tag logged today', () => {
    const entries = [
      entry(20, 30, ['stressed']), // today
      entry(19, 32, ['stressed']),
      entry(18, 88, ['calm']),
      entry(17, 90, ['calm']),
    ]
    const advice = getPersonalizedAdvice(entries, null, NOW)
    expect(advice.source).toBe('pattern')
    expect(advice.tag).toBe('stressed')
    expect(advice.text).toMatch(/points lower/i)
  })

  it('surfaces a lift tag that has gone stale', () => {
    // 'active' last logged day 16 → 4 days ago (>= STALE_LIFT_DAYS).
    // Today is deliberately untagged so the drain rule can't pre-empt this.
    const entries = [
      entry(20, 55, []),
      entry(19, 52, ['calm']),
      entry(18, 54, ['calm']),
      entry(16, 95, ['active']),
      entry(15, 92, ['active']),
    ]
    const advice = getPersonalizedAdvice(entries, null, NOW)
    expect(advice.source).toBe('pattern')
    expect(advice.tag).toBe('active')
    expect(advice.text).toMatch(/4 days/)
  })

  it('reinforces a lift tag logged today', () => {
    const entries = [
      entry(20, 95, ['active']), // today
      entry(19, 92, ['active']),
      entry(18, 50, ['tired']),
      entry(17, 48, ['tired']),
    ]
    const advice = getPersonalizedAdvice(entries, null, NOW)
    expect(advice.source).toBe('pattern')
    expect(advice.tag).toBe('active')
    expect(advice.text).toMatch(/best days/i)
  })

  it('prioritises a drain today over a stale lift', () => {
    const entries = [
      entry(20, 30, ['stressed']), // today, a drain
      entry(19, 33, ['stressed']),
      entry(14, 95, ['active']), // stale lift
      entry(13, 92, ['active']),
    ]
    expect(getPersonalizedAdvice(entries, null, NOW).tag).toBe('stressed')
  })

  it('exposes sane thresholds', () => {
    expect(MIN_ADVICE_DELTA).toBeGreaterThan(0)
    expect(STALE_LIFT_DAYS).toBeGreaterThan(0)
  })
})
