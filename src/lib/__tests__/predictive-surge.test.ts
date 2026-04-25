import { describe, it, expect } from 'vitest'
import {
  analyzeVenuePatterns,
  predictSurge,
  applyWeatherModifier,
  applyEventModifier,
  generateSmartNotification,
  getVenuesThatWillSurge,
  calculatePredictionAccuracy,
} from '../predictive-surge'
import type { Pulse, Venue } from '../types'

function makePulse(overrides: Partial<Pulse> = {}): Pulse {
  return {
    id: `p-${Math.random().toString(36).slice(2)}`,
    userId: 'u1', venueId: 'v1', photos: ['img.jpg'],
    energyRating: 'buzzing',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 90 * 60000).toISOString(),
    reactions: { fire: [], eyes: [], skull: [], lightning: [] },
    views: 0,
    ...overrides,
  }
}

function makeVenue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: 'v1', name: 'Bar A',
    location: { lat: 40.7, lng: -74.0, address: '123 Main St' },
    pulseScore: 70,
    ...overrides,
  }
}

describe('analyzeVenuePatterns', () => {
  it('groups pulses by day of week', () => {
    const now = new Date()
    const pulses = [
      makePulse({ venueId: 'v1', createdAt: now.toISOString() }),
      makePulse({ venueId: 'v1', createdAt: now.toISOString() }),
    ]
    const patterns = analyzeVenuePatterns('v1', pulses, 30)
    expect(patterns.length).toBeGreaterThanOrEqual(1)
    expect(patterns[0].venueId).toBe('v1')
  })

  it('returns empty for no matching pulses', () => {
    const patterns = analyzeVenuePatterns('v999', [], 30)
    expect(patterns).toHaveLength(0)
  })
})

describe('predictSurge', () => {
  it('returns low confidence with no data', () => {
    const pred = predictSurge('v1', [], 18, 5)
    expect(pred.confidence).toBe(0.1)
    expect(pred.basedOn).toBe('historical')
  })

  it('predicts from patterns', () => {
    const patterns = [{
      venueId: 'v1', dayOfWeek: 5,
      hourDistribution: { 20: { avgPulseCount: 5, avgEnergy: 2.5 }, 21: { avgPulseCount: 10, avgEnergy: 3 } },
      typicalPeakHour: 21, typicalPeakEnergy: 'electric' as const,
    }]
    const pred = predictSurge('v1', patterns, 18, 5)
    expect(pred.predictedPeakTime).toContain('PM')
    expect(pred.confidence).toBeGreaterThan(0.1)
  })
})

describe('applyWeatherModifier', () => {
  const base = { venueId: 'v1', predictedPeakTime: '9PM', predictedEnergyLevel: 'buzzing' as const, confidence: 0.5, label: 'test', basedOn: 'historical' as const }

  it('rain reduces confidence', () => {
    const modified = applyWeatherModifier(base, 'rainy')
    expect(modified.confidence).toBeLessThan(base.confidence)
    expect(modified.basedOn).toBe('combined')
  })

  it('clear weather boosts', () => {
    const modified = applyWeatherModifier(base, 'clear')
    expect(modified.confidence).toBeGreaterThanOrEqual(base.confidence)
  })
})

describe('applyEventModifier', () => {
  const base = { venueId: 'v1', predictedPeakTime: '9PM', predictedEnergyLevel: 'chill' as const, confidence: 0.3, label: 'test', basedOn: 'historical' as const }

  it('rsvps boost confidence', () => {
    const modified = applyEventModifier(base, 50)
    expect(modified.confidence).toBeGreaterThan(base.confidence)
    expect(modified.basedOn).toBe('combined')
  })

  it('no rsvps returns unchanged', () => {
    const modified = applyEventModifier(base, 0)
    expect(modified.confidence).toBe(base.confidence)
  })
})

describe('generateSmartNotification', () => {
  it('generates a message', () => {
    const pred = { venueId: 'v1', predictedPeakTime: '10PM', predictedEnergyLevel: 'electric' as const, confidence: 0.7, label: 'test', basedOn: 'historical' as const }
    const msg = generateSmartNotification('Bar A', pred)
    expect(msg).toContain('Bar A')
  })

  it('uses generic for low confidence', () => {
    const pred = { venueId: 'v1', predictedPeakTime: '10PM', predictedEnergyLevel: 'chill' as const, confidence: 0.1, label: 'test', basedOn: 'historical' as const }
    const msg = generateSmartNotification('Bar A', pred)
    expect(msg).toContain('might')
  })
})

describe('getVenuesThatWillSurge', () => {
  it('returns sorted predictions', () => {
    const venues = [makeVenue({ id: 'v1', name: 'A' }), makeVenue({ id: 'v2', name: 'B' })]
    const patterns = [
      { venueId: 'v1', dayOfWeek: 5, hourDistribution: { 21: { avgPulseCount: 10, avgEnergy: 3 } }, typicalPeakHour: 21, typicalPeakEnergy: 'electric' as const },
      { venueId: 'v2', dayOfWeek: 5, hourDistribution: { 20: { avgPulseCount: 5, avgEnergy: 2 } }, typicalPeakHour: 20, typicalPeakEnergy: 'buzzing' as const },
    ]
    const results = getVenuesThatWillSurge(venues, patterns as any, 18, 5)
    expect(results.length).toBeGreaterThanOrEqual(1)
    expect(results[0].venueName).toBeDefined()
  })
})

describe('calculatePredictionAccuracy', () => {
  it('calculates accuracy', () => {
    const predictions = [
      { venueId: 'v1', predictedPeakTime: '9PM', predictedEnergyLevel: 'electric' as const, confidence: 0.8, label: '', basedOn: 'historical' as const },
    ]
    const pulses = [makePulse({ venueId: 'v1', createdAt: new Date(new Date().setHours(21, 0, 0, 0)).toISOString() })]
    const result = calculatePredictionAccuracy(predictions, pulses)
    expect(result.total).toBe(1)
    expect(result.accuracy).toBeGreaterThanOrEqual(0)
  })

  it('returns 0 for empty predictions', () => {
    expect(calculatePredictionAccuracy([], []).accuracy).toBe(0)
  })
})
