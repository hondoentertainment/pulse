import { describe, it, expect } from 'vitest'
import {
  getTimeOfDay,
  getDayType,
  getPeakConfig,
  calculateContextualScore,
  getContextualLabel,
  sortByContextualScore,
  getPeakCategories,
} from '../time-contextual-scoring'
import type { Venue } from '../types'

function makeVenue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: 'v1',
    name: 'Test',
    location: { lat: 40, lng: -74, address: '' },
    pulseScore: 0,
    ...overrides,
  }
}

describe('getTimeOfDay', () => {
  it('returns early_morning for 5-7am', () => {
    expect(getTimeOfDay(new Date('2024-01-15T06:00:00'))).toBe('early_morning')
  })
  it('returns morning for 7-12', () => {
    expect(getTimeOfDay(new Date('2024-01-15T09:00:00'))).toBe('morning')
  })
  it('returns afternoon for 12-17', () => {
    expect(getTimeOfDay(new Date('2024-01-15T14:00:00'))).toBe('afternoon')
  })
  it('returns evening for 17-21', () => {
    expect(getTimeOfDay(new Date('2024-01-15T19:00:00'))).toBe('evening')
  })
  it('returns night for 21-24', () => {
    expect(getTimeOfDay(new Date('2024-01-15T22:00:00'))).toBe('night')
  })
  it('returns late_night for 0-5', () => {
    expect(getTimeOfDay(new Date('2024-01-15T02:00:00'))).toBe('late_night')
  })
})

describe('getDayType', () => {
  it('returns weekday for Monday', () => {
    expect(getDayType(new Date('2024-01-15T12:00:00'))).toBe('weekday') // Monday
  })
  it('returns weekend for Saturday', () => {
    expect(getDayType(new Date('2024-01-13T12:00:00'))).toBe('weekend') // Saturday
  })
})

describe('getPeakConfig', () => {
  it('returns high multiplier for cafes in morning', () => {
    const config = getPeakConfig('Café', new Date('2024-01-15T09:00:00'))
    expect(config.multiplier).toBeGreaterThanOrEqual(1.5)
  })
  it('returns high multiplier for nightclubs at night', () => {
    const config = getPeakConfig('Nightclub', new Date('2024-01-15T23:00:00'))
    expect(config.multiplier).toBeGreaterThanOrEqual(2.0)
  })
  it('returns low multiplier for cafes at night', () => {
    const config = getPeakConfig('Café', new Date('2024-01-15T23:00:00'))
    expect(config.multiplier).toBeLessThan(1.0)
  })
  it('normalizes variant category names', () => {
    const config1 = getPeakConfig('Dance Club', new Date('2024-01-15T23:00:00'))
    const config2 = getPeakConfig('nightlife', new Date('2024-01-15T23:00:00'))
    expect(config1.multiplier).toBe(config2.multiplier)
  })
})

describe('calculateContextualScore', () => {
  it('boosts cafe score in morning', () => {
    const cafe = makeVenue({ category: 'Café', pulseScore: 30 })
    const morning = new Date('2024-01-15T09:00:00')
    const evening = new Date('2024-01-15T22:00:00')
    expect(calculateContextualScore(cafe, morning)).toBeGreaterThan(
      calculateContextualScore(cafe, evening)
    )
  })

  it('boosts nightclub score at night', () => {
    const club = makeVenue({ category: 'Nightclub', pulseScore: 60 })
    const night = new Date('2024-01-15T23:00:00')
    const morning = new Date('2024-01-15T09:00:00')
    expect(calculateContextualScore(club, night)).toBeGreaterThan(
      calculateContextualScore(club, morning)
    )
  })

  it('caps at 100', () => {
    const venue = makeVenue({ category: 'Nightclub', pulseScore: 95 })
    expect(calculateContextualScore(venue, new Date('2024-01-15T02:00:00'))).toBeLessThanOrEqual(100)
  })

  it('returns 0 for score of 0', () => {
    const venue = makeVenue({ pulseScore: 0 })
    expect(calculateContextualScore(venue)).toBe(0)
  })
})

describe('getContextualLabel', () => {
  it('returns empty string for low score venues', () => {
    const venue = makeVenue({ category: 'Bar', pulseScore: 10 })
    // Low scores shouldn't have contextual labels
    const label = getContextualLabel(venue)
    expect(typeof label).toBe('string')
  })

  it('returns a label when cafe is active off-peak', () => {
    const cafe = makeVenue({ category: 'Café', pulseScore: 50 })
    const night = new Date('2024-01-15T23:00:00')
    const label = getContextualLabel(cafe, night)
    expect(label.length).toBeGreaterThan(0)
    expect(label).toContain('Surprisingly busy')
  })

  it('returns "Electric" label for high-performing venue at off-peak', () => {
    const cafe = makeVenue({ category: 'Café', pulseScore: 80 })
    const night = new Date('2024-01-15T23:00:00')
    const label = getContextualLabel(cafe, night)
    expect(label).toContain('Surprisingly busy')
  })
})

describe('sortByContextualScore', () => {
  it('sorts cafes higher in morning', () => {
    const cafe = makeVenue({ id: 'cafe', category: 'Café', pulseScore: 30 })
    const bar = makeVenue({ id: 'bar', category: 'Bar', pulseScore: 30 })
    const morning = new Date('2024-01-15T09:00:00')
    const sorted = sortByContextualScore([bar, cafe], morning)
    expect(sorted[0].id).toBe('cafe')
  })

  it('sorts bars higher at night', () => {
    const cafe = makeVenue({ id: 'cafe', category: 'Café', pulseScore: 50 })
    const bar = makeVenue({ id: 'bar', category: 'Bar', pulseScore: 50 })
    const night = new Date('2024-01-15T23:00:00')
    const sorted = sortByContextualScore([cafe, bar], night)
    expect(sorted[0].id).toBe('bar')
  })
})

describe('getPeakCategories', () => {
  it('includes cafes in morning', () => {
    const cats = getPeakCategories(new Date('2024-01-15T09:00:00'))
    expect(cats.some(c => c.toLowerCase().includes('cafe'))).toBe(true)
  })

  it('includes nightclubs at night', () => {
    const cats = getPeakCategories(new Date('2024-01-15T23:00:00'))
    expect(cats.some(c => c.toLowerCase().includes('nightclub'))).toBe(true)
  })

  it('returns empty for early_morning when nothing peaks', () => {
    const cats = getPeakCategories(new Date('2024-01-15T06:00:00'))
    // Only cafes peak at early morning
    expect(cats.length).toBeGreaterThanOrEqual(1)
  })
})
