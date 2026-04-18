import { describe, it, expect } from 'vitest'
import {
  formatDistance,
  convertMilesToMeters,
  convertMilesToKm,
  getDistanceUnitLabel,
} from '../units'

describe('formatDistance (imperial)', () => {
  it('returns feet for distances under 0.1 miles', () => {
    expect(formatDistance(0.01, 'imperial')).toBe('53ft')
  })

  it('returns miles with one decimal for distances over 0.1 miles', () => {
    expect(formatDistance(1.234, 'imperial')).toBe('1.2mi')
  })

  it('returns 0ft for zero distance', () => {
    expect(formatDistance(0, 'imperial')).toBe('0ft')
  })

  it('returns feet at the 0.1-mile boundary for values just below it', () => {
    expect(formatDistance(0.099, 'imperial')).toBe('523ft')
  })

  it('returns miles at exactly 0.1 miles', () => {
    expect(formatDistance(0.1, 'imperial')).toBe('0.1mi')
  })
})

describe('formatDistance (metric)', () => {
  it('returns meters for distances under 1 km', () => {
    // 0.3 miles = ~482 meters
    const result = formatDistance(0.3, 'metric')
    expect(result).toMatch(/^\d+m$/)
    const meters = parseInt(result.replace('m', ''), 10)
    expect(meters).toBeGreaterThan(480)
    expect(meters).toBeLessThan(490)
  })

  it('returns kilometers with one decimal for distances over 1 km', () => {
    // 2 miles = ~3.22 km
    expect(formatDistance(2, 'metric')).toBe('3.2km')
  })

  it('returns 0m for zero distance', () => {
    expect(formatDistance(0, 'metric')).toBe('0m')
  })

  it('converts 1 mile properly to km', () => {
    expect(formatDistance(1, 'metric')).toBe('1.6km')
  })
})

describe('convertMilesToMeters', () => {
  it('converts 1 mile to ~1609 meters', () => {
    expect(convertMilesToMeters(1)).toBeCloseTo(1609.34, 1)
  })

  it('returns 0 for 0 miles', () => {
    expect(convertMilesToMeters(0)).toBe(0)
  })

  it('handles fractional miles', () => {
    expect(convertMilesToMeters(0.5)).toBeCloseTo(804.67, 1)
  })
})

describe('convertMilesToKm', () => {
  it('converts 1 mile to ~1.609 km', () => {
    expect(convertMilesToKm(1)).toBeCloseTo(1.60934, 4)
  })

  it('returns 0 for 0 miles', () => {
    expect(convertMilesToKm(0)).toBe(0)
  })

  it('converts 10 miles to ~16.09 km', () => {
    expect(convertMilesToKm(10)).toBeCloseTo(16.0934, 3)
  })
})

describe('getDistanceUnitLabel', () => {
  it('returns "miles" for imperial long label', () => {
    expect(getDistanceUnitLabel('imperial')).toBe('miles')
  })

  it('returns "kilometers" for metric long label', () => {
    expect(getDistanceUnitLabel('metric')).toBe('kilometers')
  })

  it('returns "mi" for imperial short label', () => {
    expect(getDistanceUnitLabel('imperial', true)).toBe('mi')
  })

  it('returns "km" for metric short label', () => {
    expect(getDistanceUnitLabel('metric', true)).toBe('km')
  })

  it('defaults short parameter to false (long label)', () => {
    expect(getDistanceUnitLabel('imperial', false)).toBe('miles')
  })
})
