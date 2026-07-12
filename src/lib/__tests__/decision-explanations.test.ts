import { describe, it, expect } from 'vitest'
import { buildDecisionExplanation, deriveWorthGoing } from '../decision-explanations'
import type { Venue } from '../types'

const venue: Venue = {
  id: 'v1',
  name: 'Little Red Hen',
  location: { lat: 47.61, lng: -122.32, address: '1 Main' },
  city: 'Seattle',
  state: 'WA',
  category: 'Nightclub',
  pulseScore: 68,
}

describe('buildDecisionExplanation', () => {
  it('formats PRD-style headline and confidence', () => {
    const result = buildDecisionExplanation({
      venue,
      reasons: [{ type: 'nearby', label: 'Close to you' }],
      confidence: 'high',
      freshnessMinutes: 14,
      reportCount: 5,
      distanceMiles: 2,
      trend: 'rising',
      energyMatch: true,
      desiredVibe: 'buzzing',
    })

    expect(result.headline).toContain('Little Red Hen')
    expect(result.headline).toContain('Buzzing')
    expect(result.explanation).toContain('Confidence: High')
    expect(result.explanation).toContain('14 min ago')
    expect(result.worthGoing).toBe('yes')
  })

  it('returns caution for low confidence', () => {
    expect(deriveWorthGoing('low', true, 30)).toBe('caution')
    expect(deriveWorthGoing('none', false, null)).toBe('unknown')
  })
})
