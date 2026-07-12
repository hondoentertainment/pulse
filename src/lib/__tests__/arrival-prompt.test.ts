import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  recordPendingArrival,
  getDueArrivalPrompt,
  clearPendingArrival,
  ARRIVAL_PROMPT_AFTER_MS,
} from '../arrival-prompt'

describe('arrival-prompt', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-22T22:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns null before prompt window', () => {
    recordPendingArrival({ venueId: 'v1', venueName: 'Neon Room', pulseScore: 80 })
    expect(getDueArrivalPrompt()).toBeNull()
  })

  it('surfaces prompt after arrival window', () => {
    recordPendingArrival({ venueId: 'v1', venueName: 'Neon Room', pulseScore: 80 })
    vi.advanceTimersByTime(ARRIVAL_PROMPT_AFTER_MS + 1)
    const due = getDueArrivalPrompt()
    expect(due?.venueId).toBe('v1')
    expect(due?.displayedEnergy).toBe('electric')
  })

  it('clears pending arrival after feedback', () => {
    recordPendingArrival({ venueId: 'v1', venueName: 'Neon Room', pulseScore: 30 })
    clearPendingArrival('v1')
    vi.advanceTimersByTime(ARRIVAL_PROMPT_AFTER_MS + 1)
    expect(getDueArrivalPrompt()).toBeNull()
  })
})
