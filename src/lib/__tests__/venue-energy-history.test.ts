import { describe, it, expect } from 'vitest'
import {
  generateEnergyHistory,
  findPeakHour,
  findBestTimeToVisit,
  calculateTrend,
  compareToLastWeek,
  getEnergyForecast,
  smoothDataPoints,
  type EnergyDataPoint,
} from '../venue-energy-history'
import type { Venue } from '../types'

function makeVenue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: 'v1',
    name: 'Test Venue',
    location: { lat: 40.7, lng: -74.0, address: '123 Main St' },
    pulseScore: 70,
    ...overrides,
  }
}

function makeDataPoints(scores: number[]): EnergyDataPoint[] {
  return scores.map((score, i) => ({
    timestamp: i,
    score,
    checkinCount: Math.round(score / 10),
    isCurrentHour: false,
  }))
}

describe('generateEnergyHistory', () => {
  it('generates 24 data points for a nightclub', () => {
    const venue = makeVenue({ category: 'Nightclub' })
    const history = generateEnergyHistory(venue, new Date('2025-03-14T22:00:00'))
    expect(history.dataPoints).toHaveLength(24)
    expect(history.venueId).toBe('v1')
    expect(history.dataPoints.every(dp => dp.score >= 0 && dp.score <= 100)).toBe(true)
  })

  it('nightclub peaks in late evening hours', () => {
    const venue = makeVenue({ id: 'nightclub-1', category: 'Nightclub', pulseScore: 80 })
    const history = generateEnergyHistory(venue, new Date('2025-03-14T23:00:00'))
    const lateNightScores = history.dataPoints.filter(dp => dp.timestamp >= 21 || dp.timestamp <= 1)
    const morningScores = history.dataPoints.filter(dp => dp.timestamp >= 7 && dp.timestamp <= 11)
    const avgLateNight = lateNightScores.reduce((s, dp) => s + dp.score, 0) / lateNightScores.length
    const avgMorning = morningScores.reduce((s, dp) => s + dp.score, 0) / morningScores.length
    expect(avgLateNight).toBeGreaterThan(avgMorning)
  })

  it('bar peaks in evening hours (9PM-midnight)', () => {
    const venue = makeVenue({ id: 'bar-1', category: 'Bar', pulseScore: 75 })
    const history = generateEnergyHistory(venue, new Date('2025-03-14T22:00:00'))
    const eveningScores = history.dataPoints.filter(dp => dp.timestamp >= 19 && dp.timestamp <= 23)
    const morningScores = history.dataPoints.filter(dp => dp.timestamp >= 6 && dp.timestamp <= 10)
    const avgEvening = eveningScores.reduce((s, dp) => s + dp.score, 0) / eveningScores.length
    const avgMorning = morningScores.reduce((s, dp) => s + dp.score, 0) / morningScores.length
    expect(avgEvening).toBeGreaterThan(avgMorning)
  })

  it('restaurant peaks at dinner time (7-9PM)', () => {
    const venue = makeVenue({ id: 'rest-1', category: 'Restaurant', pulseScore: 65 })
    const history = generateEnergyHistory(venue, new Date('2025-03-14T20:00:00'))
    const dinnerScores = history.dataPoints.filter(dp => dp.timestamp >= 18 && dp.timestamp <= 20)
    const lateNightScores = history.dataPoints.filter(dp => dp.timestamp >= 1 && dp.timestamp <= 4)
    const avgDinner = dinnerScores.reduce((s, dp) => s + dp.score, 0) / dinnerScores.length
    const avgLateNight = lateNightScores.reduce((s, dp) => s + dp.score, 0) / lateNightScores.length
    expect(avgDinner).toBeGreaterThan(avgLateNight)
  })

  it('coffee shop peaks in morning (8-10AM)', () => {
    const venue = makeVenue({ id: 'cafe-1', category: 'Coffee', pulseScore: 60 })
    const history = generateEnergyHistory(venue, new Date('2025-03-14T09:00:00'))
    const morningScores = history.dataPoints.filter(dp => dp.timestamp >= 7 && dp.timestamp <= 10)
    const nightScores = history.dataPoints.filter(dp => dp.timestamp >= 21 && dp.timestamp <= 23)
    const avgMorning = morningScores.reduce((s, dp) => s + dp.score, 0) / morningScores.length
    const avgNight = nightScores.reduce((s, dp) => s + dp.score, 0) / nightScores.length
    expect(avgMorning).toBeGreaterThan(avgNight)
  })

  it('marks the current hour correctly', () => {
    const venue = makeVenue()
    const time = new Date('2025-03-14T15:30:00')
    const history = generateEnergyHistory(venue, time)
    const currentHourPoints = history.dataPoints.filter(dp => dp.isCurrentHour)
    expect(currentHourPoints).toHaveLength(1)
    expect(currentHourPoints[0].timestamp).toBe(15)
  })

  it('includes checkin counts', () => {
    const venue = makeVenue({ pulseScore: 80 })
    const history = generateEnergyHistory(venue)
    expect(history.dataPoints.every(dp => dp.checkinCount >= 0)).toBe(true)
  })

  it('defaults to bar curve when no category', () => {
    const venue = makeVenue({ category: undefined })
    const history = generateEnergyHistory(venue)
    expect(history.dataPoints).toHaveLength(24)
    // Should not crash and should produce valid data
    expect(history.peakHour).toBeGreaterThanOrEqual(0)
    expect(history.peakHour).toBeLessThan(24)
  })

  it('is deterministic for the same venue ID', () => {
    const venue = makeVenue({ id: 'deterministic-test' })
    const time = new Date('2025-03-14T20:00:00')
    const h1 = generateEnergyHistory(venue, time)
    const h2 = generateEnergyHistory(venue, time)
    expect(h1.dataPoints.map(dp => dp.score)).toEqual(h2.dataPoints.map(dp => dp.score))
  })

  it('produces different curves for different venue IDs', () => {
    const venue1 = makeVenue({ id: 'venue-aaa', category: 'Bar' })
    const venue2 = makeVenue({ id: 'venue-zzz', category: 'Bar' })
    const time = new Date('2025-03-14T20:00:00')
    const h1 = generateEnergyHistory(venue1, time)
    const h2 = generateEnergyHistory(venue2, time)
    // At least some scores should differ due to per-venue variation
    const different = h1.dataPoints.some((dp, i) => dp.score !== h2.dataPoints[i].score)
    expect(different).toBe(true)
  })
})

describe('findPeakHour', () => {
  it('returns the hour with the highest score', () => {
    const points = makeDataPoints([10, 20, 90, 30, 40, 50, 60, 70, 80, 85, 15, 5,
      10, 20, 30, 40, 50, 60, 70, 80, 85, 95, 75, 50])
    expect(findPeakHour(points)).toBe(21)
  })

  it('returns first peak if multiple hours tie', () => {
    const points = makeDataPoints([50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50,
      50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50])
    expect(findPeakHour(points)).toBe(0)
  })
})

describe('findBestTimeToVisit', () => {
  it('returns a future hour with high score', () => {
    const points = makeDataPoints([10, 20, 30, 40, 50, 60, 70, 80, 90, 80, 70, 60,
      50, 40, 30, 20, 10, 20, 30, 40, 60, 80, 95, 70])
    const best = findBestTimeToVisit(points, 10) // Current hour is 10AM
    expect(best).toBeGreaterThan(10) // Should be in the future
    expect(best).toBe(22) // 10PM has score 95
  })

  it('wraps to global peak if all future hours have passed', () => {
    const points = makeDataPoints([10, 20, 30, 40, 50, 60, 70, 80, 90, 80, 70, 60,
      50, 40, 30, 20, 10, 20, 30, 40, 60, 80, 95, 70])
    const best = findBestTimeToVisit(points, 23) // Last hour of the day
    // Should return global peak since no future hours
    expect(best).toBe(22) // Global peak
  })

  it('does not return an hour that has passed', () => {
    const points = makeDataPoints([95, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10,
      10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 50])
    const best = findBestTimeToVisit(points, 5)
    // Hour 0 has highest score but has passed. Future best is hour 23
    expect(best).toBe(23)
  })
})

describe('calculateTrend', () => {
  it('returns quiet when score is very low', () => {
    const points = makeDataPoints(Array(24).fill(5))
    expect(calculateTrend(points, 12)).toBe('quiet')
  })

  it('returns peaking when current is highest nearby', () => {
    const scores = Array(24).fill(20)
    scores[12] = 80
    scores[11] = 60
    scores[13] = 60
    const points = makeDataPoints(scores)
    expect(calculateTrend(points, 12)).toBe('peaking')
  })

  it('returns rising when trending upward', () => {
    const scores = Array(24).fill(20)
    scores[11] = 30
    scores[12] = 50
    scores[13] = 60
    const points = makeDataPoints(scores)
    expect(calculateTrend(points, 12)).toBe('rising')
  })

  it('returns falling when trending downward', () => {
    const scores = Array(24).fill(20)
    scores[11] = 80
    scores[12] = 60
    scores[13] = 40
    const points = makeDataPoints(scores)
    expect(calculateTrend(points, 12)).toBe('falling')
  })

  it('handles midnight boundary (hour 0)', () => {
    const scores = Array(24).fill(20)
    scores[23] = 80
    scores[0] = 5
    scores[1] = 3
    const points = makeDataPoints(scores)
    const trend = calculateTrend(points, 0)
    expect(['quiet', 'falling']).toContain(trend)
  })

  it('handles hour 23 wrapping to 0', () => {
    const scores = Array(24).fill(20)
    scores[22] = 50
    scores[23] = 70
    scores[0] = 80
    const points = makeDataPoints(scores)
    expect(calculateTrend(points, 23)).toBe('rising')
  })

  it('handles early morning hours (3-5AM)', () => {
    const scores = Array(24).fill(5)
    const points = makeDataPoints(scores)
    expect(calculateTrend(points, 3)).toBe('quiet')
    expect(calculateTrend(points, 4)).toBe('quiet')
  })
})

describe('compareToLastWeek', () => {
  it('returns a percentage comparison string', () => {
    const points = makeDataPoints(Array(24).fill(50))
    const result = compareToLastWeek(points, 5) // Friday
    expect(result).toContain('Friday')
    expect(result).toMatch(/[+-]?\d+%/)
  })

  it('includes the correct day name', () => {
    const points = makeDataPoints(Array(24).fill(50))
    expect(compareToLastWeek(points, 0)).toContain('Sunday')
    expect(compareToLastWeek(points, 1)).toContain('Monday')
    expect(compareToLastWeek(points, 6)).toContain('Saturday')
  })

  it('uses busier or quieter wording appropriately', () => {
    const points = makeDataPoints(Array(24).fill(50))
    // Day 5 (Friday) has +22% variation
    const friday = compareToLastWeek(points, 5)
    expect(friday).toContain('busier')

    // Day 0 (Sunday) has -18% variation
    const sunday = compareToLastWeek(points, 0)
    expect(sunday).toContain('quieter')
  })
})

describe('getEnergyForecast', () => {
  it('returns the correct number of forecast points', () => {
    const venue = makeVenue({ category: 'Bar' })
    const time = new Date('2025-03-14T18:00:00')
    const history = generateEnergyHistory(venue, time)
    const forecast = getEnergyForecast(history, 3)
    expect(forecast).toHaveLength(3)
  })

  it('returns future hours after current', () => {
    const venue = makeVenue({ category: 'Bar' })
    const time = new Date('2025-03-14T20:00:00')
    const history = generateEnergyHistory(venue, time)
    const forecast = getEnergyForecast(history, 4)
    // Forecast should start from hour 21
    expect(forecast[0].timestamp).toBe(21)
    expect(forecast[1].timestamp).toBe(22)
    expect(forecast[2].timestamp).toBe(23)
    expect(forecast[3].timestamp).toBe(0) // wraps to midnight
  })

  it('wraps around midnight', () => {
    const venue = makeVenue({ category: 'Nightclub' })
    const time = new Date('2025-03-14T23:00:00')
    const history = generateEnergyHistory(venue, time)
    const forecast = getEnergyForecast(history, 3)
    expect(forecast[0].timestamp).toBe(0)
    expect(forecast[1].timestamp).toBe(1)
    expect(forecast[2].timestamp).toBe(2)
  })

  it('forecast points are not marked as current hour', () => {
    const venue = makeVenue()
    const time = new Date('2025-03-14T15:00:00')
    const history = generateEnergyHistory(venue, time)
    const forecast = getEnergyForecast(history, 5)
    expect(forecast.every(dp => !dp.isCurrentHour)).toBe(true)
  })

  it('returns empty if no current hour found', () => {
    const venue = makeVenue()
    const history = generateEnergyHistory(venue)
    // Remove isCurrentHour flags
    history.dataPoints.forEach(dp => { dp.isCurrentHour = false })
    const forecast = getEnergyForecast(history, 3)
    expect(forecast).toHaveLength(0)
  })
})

describe('smoothDataPoints', () => {
  it('reduces sharp jumps between adjacent hours', () => {
    const raw = makeDataPoints([10, 10, 10, 90, 10, 10, 10, 10, 10, 10, 10, 10,
      10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10])
    const smoothed = smoothDataPoints(raw)

    // The spike at index 3 should be dampened
    expect(smoothed[3].score).toBeLessThan(90)
    // Neighbors should be pulled up
    expect(smoothed[2].score).toBeGreaterThan(10)
    expect(smoothed[4].score).toBeGreaterThan(10)
  })

  it('maintains scores within 0-100 range', () => {
    const raw = makeDataPoints([0, 100, 0, 100, 0, 100, 0, 100, 0, 100, 0, 100,
      0, 100, 0, 100, 0, 100, 0, 100, 0, 100, 0, 100])
    const smoothed = smoothDataPoints(raw)
    expect(smoothed.every(dp => dp.score >= 0 && dp.score <= 100)).toBe(true)
  })

  it('also smooths checkin counts', () => {
    const raw = makeDataPoints([10, 10, 10, 90, 10, 10, 10, 10, 10, 10, 10, 10,
      10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10])
    const smoothed = smoothDataPoints(raw)
    // Checkin counts should also be smoothed
    expect(smoothed[3].checkinCount).toBeLessThanOrEqual(raw[3].checkinCount)
  })

  it('handles arrays with 2 or fewer points', () => {
    const single = makeDataPoints([50])
    expect(smoothDataPoints(single)).toHaveLength(1)

    const pair = makeDataPoints([30, 70])
    expect(smoothDataPoints(pair)).toHaveLength(2)
  })

  it('wraps around (hour 23 smoothed with hour 0)', () => {
    const scores = Array(24).fill(10)
    scores[23] = 80
    scores[0] = 80
    const raw = makeDataPoints(scores)
    const smoothed = smoothDataPoints(raw)
    // Hour 22 should be pulled up by high hour 23
    expect(smoothed[22].score).toBeGreaterThan(10)
  })
})
