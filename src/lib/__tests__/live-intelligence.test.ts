import { describe, it, expect, beforeEach } from 'vitest'
import {
  reportWaitTime,
  reportCoverCharge,
  reportMusicPlaying,
  reportCrowdLevel,
  reportDressCode,
  reportNowPlaying,
  reportAgeRange,
  getVenueLiveData,
  forecastCrowdLevel,
  estimateWaitTime,
  getCityHeatmap,
  clearReports,
  getReportCount,
  seedDemoReports,
} from '../live-intelligence'
import type { Venue } from '../types'

function makeVenue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: `venue-${Math.random().toString(36).slice(2, 8)}`,
    name: 'Test Venue',
    location: { lat: 40.7128, lng: -74.006, address: '' },
    pulseScore: 50,
    category: 'bar',
    ...overrides,
  }
}

beforeEach(() => {
  clearReports()
})

describe('report functions', () => {
  it('reportWaitTime stores a report with the correct type', () => {
    const r = reportWaitTime('v1', 'u1', 15)
    expect(r.venueId).toBe('v1')
    expect(r.userId).toBe('u1')
    expect(r.type).toBe('wait_time')
    expect(r.value).toBe(15)
    expect(getReportCount('v1')).toBe(1)
  })

  it('reportCoverCharge stores amount and optional note', () => {
    const r = reportCoverCharge('v1', 'u1', 20, 'After 11pm')
    expect(r.type).toBe('cover_charge')
    expect(r.value).toEqual({ amount: 20, note: 'After 11pm' })
  })

  it('reportMusicPlaying stores genre', () => {
    const r = reportMusicPlaying('v1', 'u1', 'hip-hop')
    expect(r.type).toBe('music')
    expect(r.value).toBe('hip-hop')
  })

  it('reportCrowdLevel clamps to 0-100 range', () => {
    const low = reportCrowdLevel('v1', 'u1', -50)
    const high = reportCrowdLevel('v1', 'u2', 200)
    expect(low.value).toBe(0)
    expect(high.value).toBe(100)
  })

  it('reportDressCode stores the dress code value', () => {
    const r = reportDressCode('v1', 'u1', 'smart-casual')
    expect(r.type).toBe('dress_code')
    expect(r.value).toBe('smart-casual')
  })

  it('reportNowPlaying stores track and artist', () => {
    const r = reportNowPlaying('v1', 'u1', 'Flowers', 'Miley Cyrus')
    expect(r.type).toBe('now_playing')
    expect(r.value).toEqual({ track: 'Flowers', artist: 'Miley Cyrus' })
  })

  it('reportAgeRange stores min and max', () => {
    const r = reportAgeRange('v1', 'u1', 21, 35)
    expect(r.type).toBe('age_range')
    expect(r.value).toEqual({ min: 21, max: 35 })
  })

  it('getReportCount returns the number of reports for a venue', () => {
    reportWaitTime('v1', 'u1', 10)
    reportCrowdLevel('v1', 'u2', 50)
    reportWaitTime('v2', 'u1', 5)
    expect(getReportCount('v1')).toBe(2)
    expect(getReportCount('v2')).toBe(1)
  })
})

describe('getVenueLiveData', () => {
  it('returns zeros and null values when there are no reports', () => {
    const data = getVenueLiveData('v1')
    expect(data.venueId).toBe('v1')
    expect(data.crowdLevel).toBe(0)
    expect(data.waitTime).toBeNull()
    expect(data.coverCharge).toBeNull()
    expect(data.musicGenre).toBeNull()
    expect(data.dressCode).toBeNull()
    expect(data.nowPlaying).toBeNull()
    expect(data.ageRange).toBeNull()
    expect(data.capacity).toBeNull()
    expect(data.confidence.waitTime).toBe('low')
  })

  it('aggregates wait time as a weighted average', () => {
    reportWaitTime('v1', 'u1', 10)
    reportWaitTime('v1', 'u2', 20)
    const data = getVenueLiveData('v1')
    expect(data.waitTime).toBeGreaterThanOrEqual(10)
    expect(data.waitTime).toBeLessThanOrEqual(20)
  })

  it('picks the most-reported dress code value by consensus', () => {
    reportDressCode('v1', 'u1', 'smart-casual')
    reportDressCode('v1', 'u2', 'smart-casual')
    reportDressCode('v1', 'u3', 'casual')
    const data = getVenueLiveData('v1')
    expect(data.dressCode).toBe('smart-casual')
  })

  it('returns capacity object when crowd level is above zero', () => {
    reportCrowdLevel('v1', 'u1', 75)
    const data = getVenueLiveData('v1')
    expect(data.capacity).not.toBeNull()
    expect(data.capacity!.percentFull).toBe(75)
  })

  it('computes confidence based on report count', () => {
    // Single report -> low
    reportWaitTime('v1', 'u1', 10)
    expect(getVenueLiveData('v1').confidence.waitTime).toBe('low')

    // Multiple reports -> medium
    reportWaitTime('v1', 'u2', 12)
    expect(['medium', 'high']).toContain(getVenueLiveData('v1').confidence.waitTime)
  })

  it('computes average age range', () => {
    reportAgeRange('v1', 'u1', 20, 30)
    reportAgeRange('v1', 'u2', 22, 34)
    const data = getVenueLiveData('v1')
    expect(data.ageRange).not.toBeNull()
    expect(data.ageRange!.min).toBe(21)
    expect(data.ageRange!.max).toBe(32)
    expect(data.ageRange!.average).toBe(27)
  })

  it('tracks nowPlaying consensus', () => {
    reportNowPlaying('v1', 'u1', 'Song A', 'Artist 1')
    reportNowPlaying('v1', 'u2', 'Song A', 'Artist 1')
    const data = getVenueLiveData('v1')
    expect(data.nowPlaying).toEqual({ track: 'Song A', artist: 'Artist 1' })
  })
})

describe('forecastCrowdLevel', () => {
  it('returns "Not enough data" when fewer than 2 reports exist', () => {
    const result = forecastCrowdLevel('v1', new Date(Date.now() + 60 * 60 * 1000))
    expect(result.label).toBe('Not enough data')
    expect(result.confidence).toBe('low')
  })

  it('returns a forecast when data is available', () => {
    reportCrowdLevel('v1', 'u1', 40)
    reportCrowdLevel('v1', 'u2', 60)
    const result = forecastCrowdLevel('v1', new Date(Date.now() + 30 * 60 * 1000))
    expect(result.predicted).toBeGreaterThanOrEqual(0)
    expect(result.predicted).toBeLessThanOrEqual(100)
    expect(['low', 'medium', 'high']).toContain(result.confidence)
    expect(result.label.length).toBeGreaterThan(0)
  })

  it('clamps predicted value to 0-100', () => {
    reportCrowdLevel('v1', 'u1', 10)
    reportCrowdLevel('v1', 'u2', 90)
    // far-future timestamp
    const result = forecastCrowdLevel('v1', new Date(Date.now() + 10 * 60 * 60 * 1000))
    expect(result.predicted).toBeGreaterThanOrEqual(0)
    expect(result.predicted).toBeLessThanOrEqual(100)
  })
})

describe('estimateWaitTime', () => {
  it('returns null minutes and "No data" when nothing is reported', () => {
    const result = estimateWaitTime('v1')
    expect(result.minutes).toBeNull()
    expect(result.label).toBe('No data')
  })

  it('returns the weighted average when wait reports exist', () => {
    reportWaitTime('v1', 'u1', 10)
    reportWaitTime('v1', 'u2', 12)
    const result = estimateWaitTime('v1')
    expect(result.minutes).toBeGreaterThanOrEqual(10)
    expect(result.minutes).toBeLessThanOrEqual(13)
    expect(result.label).toContain('min')
  })

  it('labels zero wait explicitly', () => {
    reportWaitTime('v1', 'u1', 0)
    const result = estimateWaitTime('v1')
    expect(result.label).toBe('No wait')
  })

  it('falls back to crowd-level estimation when no wait reports exist', () => {
    reportCrowdLevel('v1', 'u1', 85)
    const result = estimateWaitTime('v1')
    expect(result.minutes).toBeGreaterThan(0)
    expect(result.confidence).toBe('low')
    expect(result.label).toContain('est.')
  })

  it('returns 0 estimated wait for a low-crowd venue', () => {
    reportCrowdLevel('v1', 'u1', 10)
    const result = estimateWaitTime('v1')
    expect(result.minutes).toBe(0)
    expect(result.label).toContain('No wait (est.)')
  })
})

describe('getCityHeatmap', () => {
  it('returns a 10x10 grid', () => {
    const cells = getCityHeatmap({ lat: 40.7128, lng: -74.006 }, 3, [])
    expect(cells).toHaveLength(100)
  })

  it('assigns zero intensity to empty cells', () => {
    const cells = getCityHeatmap({ lat: 40.7128, lng: -74.006 }, 3, [])
    expect(cells.every((c) => c.intensity === 0 && c.venueCount === 0)).toBe(true)
  })

  it('assigns non-zero intensity to cells with venues', () => {
    const venues = [
      makeVenue({ id: 'v1', pulseScore: 80, location: { lat: 40.7128, lng: -74.006, address: '' } }),
    ]
    const cells = getCityHeatmap({ lat: 40.7128, lng: -74.006 }, 3, venues)
    const hot = cells.find((c) => c.venueCount > 0)
    expect(hot).toBeDefined()
    expect(hot!.intensity).toBeGreaterThan(0)
    expect(hot!.topVenueId).toBe('v1')
  })

  it('caps intensity at 100', () => {
    const venues = Array.from({ length: 20 }, (_, i) =>
      makeVenue({
        id: `v${i}`,
        pulseScore: 100,
        location: { lat: 40.7128, lng: -74.006, address: '' },
      })
    )
    const cells = getCityHeatmap({ lat: 40.7128, lng: -74.006 }, 3, venues)
    const hot = cells.find((c) => c.venueCount > 0)
    expect(hot!.intensity).toBeLessThanOrEqual(100)
  })
})

describe('clearReports & seedDemoReports', () => {
  it('clearReports empties the store', () => {
    reportWaitTime('v1', 'u1', 10)
    clearReports()
    expect(getReportCount('v1')).toBe(0)
  })

  it('seedDemoReports is a no-op (no fabricated data)', () => {
    seedDemoReports(['v1', 'v2'])
    expect(getReportCount('v1')).toBe(0)
    expect(getReportCount('v2')).toBe(0)
  })
})
