import { describe, it, expect } from 'vitest'
import {
  estimateWaitTime,
  isWaitTimeFresh,
  toWaitTimeRow,
  MAX_WAIT_MIN,
  WAIT_TIME_TTL_MS,
} from '../wait-time-estimator'

const NOW = new Date('2026-04-17T22:00:00.000Z')

const minutesAgo = (m: number): string =>
  new Date(NOW.getTime() - m * 60 * 1000).toISOString()

describe('estimateWaitTime', () => {
  it('returns zero wait for empty input', () => {
    const r = estimateWaitTime({ checkIns: [], pulses: [], now: NOW })
    expect(r.estimatedMinutes).toBe(0)
    expect(r.confidence).toBe('low')
    expect(r.sampleSize).toBe(0)
  })

  it('ignores invalid timestamps without crashing', () => {
    const r = estimateWaitTime({
      checkIns: [{ createdAt: 'not-a-date' }, { createdAt: minutesAgo(5) }],
      pulses: [],
      now: NOW,
    })
    expect(r.sampleSize).toBe(1)
    expect(r.confidence).toBe('low')
  })

  it('scales wait with high check-in velocity', () => {
    const checkIns = Array.from({ length: 40 }, (_, i) => ({
      createdAt: minutesAgo(i % 20),
    }))
    const r = estimateWaitTime({
      checkIns,
      pulses: [],
      capacityHint: 100,
      now: NOW,
    })
    expect(r.estimatedMinutes).toBeGreaterThan(30)
    expect(r.estimatedMinutes).toBeLessThanOrEqual(MAX_WAIT_MIN)
    expect(r.confidence).toBe('high')
  })

  it('caps at MAX_WAIT_MIN even with extreme volume', () => {
    const checkIns = Array.from({ length: 500 }, (_, i) => ({
      createdAt: minutesAgo(i % 20),
    }))
    const r = estimateWaitTime({
      checkIns,
      pulses: [],
      capacityHint: 40,
      now: NOW,
    })
    expect(r.estimatedMinutes).toBe(MAX_WAIT_MIN)
  })

  it('low capacity venues tip over to "long wait" faster', () => {
    const checkIns = Array.from({ length: 15 }, (_, i) => ({
      createdAt: minutesAgo(i % 20),
    }))
    const tiny = estimateWaitTime({
      checkIns,
      pulses: [],
      capacityHint: 30,
      now: NOW,
    })
    const huge = estimateWaitTime({
      checkIns,
      pulses: [],
      capacityHint: 500,
      now: NOW,
    })
    expect(tiny.estimatedMinutes).toBeGreaterThan(huge.estimatedMinutes)
  })

  it('includes pulse pressure from electric energy posts', () => {
    const checkIns = Array.from({ length: 10 }, (_, i) => ({
      createdAt: minutesAgo(i % 20),
    }))
    const noElectric = estimateWaitTime({
      checkIns,
      pulses: Array.from({ length: 5 }, (_, i) => ({
        createdAt: minutesAgo(i * 5),
        energyRating: 'chill' as const,
      })),
      capacityHint: 100,
      now: NOW,
    })
    const electric = estimateWaitTime({
      checkIns,
      pulses: Array.from({ length: 10 }, (_, i) => ({
        createdAt: minutesAgo(i * 5),
        energyRating: 'electric' as const,
      })),
      capacityHint: 100,
      now: NOW,
    })
    expect(electric.estimatedMinutes).toBeGreaterThan(noElectric.estimatedMinutes)
  })

  it('sample-size bands map to confidence correctly', () => {
    // sample = 4 (3 check-ins + 1 pulse) -> low
    expect(
      estimateWaitTime({
        checkIns: [
          { createdAt: minutesAgo(5) },
          { createdAt: minutesAgo(10) },
          { createdAt: minutesAgo(15) },
        ],
        pulses: [{ createdAt: minutesAgo(30) }],
        now: NOW,
      }).confidence,
    ).toBe('low')

    // sample = 10 -> med
    expect(
      estimateWaitTime({
        checkIns: Array.from({ length: 10 }, (_, i) => ({
          createdAt: minutesAgo(i * 3),
        })),
        pulses: [],
        now: NOW,
      }).confidence,
    ).toBe('med')

    // sample = 20 -> high
    expect(
      estimateWaitTime({
        checkIns: Array.from({ length: 20 }, (_, i) => ({
          createdAt: minutesAgo(i * 2),
        })),
        pulses: [],
        now: NOW,
      }).confidence,
    ).toBe('high')
  })

  it('drops rows outside the 60-minute window', () => {
    const r = estimateWaitTime({
      checkIns: [
        { createdAt: minutesAgo(120) },
        { createdAt: minutesAgo(90) },
      ],
      pulses: [{ createdAt: minutesAgo(500) }],
      now: NOW,
    })
    expect(r.sampleSize).toBe(0)
    expect(r.estimatedMinutes).toBe(0)
  })

  it('handles missing / invalid capacityHint by using default', () => {
    const checkIns = Array.from({ length: 8 }, (_, i) => ({
      createdAt: minutesAgo(i),
    }))
    const r1 = estimateWaitTime({ checkIns, pulses: [], now: NOW })
    const r2 = estimateWaitTime({ checkIns, pulses: [], capacityHint: -5, now: NOW })
    expect(r1.estimatedMinutes).toBe(r2.estimatedMinutes)
  })
})

describe('toWaitTimeRow', () => {
  it('serializes an estimator result into a row', () => {
    const row = toWaitTimeRow(
      'venue-1',
      { estimatedMinutes: 12, confidence: 'med', sampleSize: 7 },
      NOW,
    )
    expect(row.venueId).toBe('venue-1')
    expect(row.estimatedMinutes).toBe(12)
    expect(row.confidence).toBe('med')
    expect(row.sampleSize).toBe(7)
    expect(row.computedAt).toBe(NOW.toISOString())
  })
})

describe('isWaitTimeFresh', () => {
  it('is true within TTL', () => {
    expect(
      isWaitTimeFresh(
        { computedAt: new Date(NOW.getTime() - WAIT_TIME_TTL_MS + 1000).toISOString() },
        NOW,
      ),
    ).toBe(true)
  })

  it('is false past TTL', () => {
    expect(
      isWaitTimeFresh(
        { computedAt: new Date(NOW.getTime() - WAIT_TIME_TTL_MS - 1000).toISOString() },
        NOW,
      ),
    ).toBe(false)
  })

  it('handles null / invalid timestamps', () => {
    expect(isWaitTimeFresh(null, NOW)).toBe(false)
    expect(isWaitTimeFresh({ computedAt: 'nope' }, NOW)).toBe(false)
  })
})
