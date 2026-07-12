import { describe, it, expect } from 'vitest'
import { analyzeDecisionConversion } from '../decision-analytics'

describe('analyzeDecisionConversion', () => {
  it('computes conversion rate from decision events', () => {
    const events = [
      { type: 'decision_session_start', timestamp: 1, sessionId: 's1' },
      { type: 'decision_session_start', timestamp: 2, sessionId: 's2' },
      { type: 'go_selected', timestamp: 3, sessionId: 's1' },
      { type: 'directions_started', timestamp: 4, sessionId: 's2' },
    ]
    const result = analyzeDecisionConversion(events)
    expect(result.qualifiedSessions).toBe(2)
    expect(result.conversions).toBe(2)
    expect(result.rate).toBe(1)
  })
})
