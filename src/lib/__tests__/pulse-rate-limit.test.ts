import { describe, expect, it } from 'vitest'
import {
  checkPulseRateLimit,
  PULSE_RATE_LIMIT_COPY,
  pulseRateLimitFromUnknown,
} from '../pulse-rate-limit'
import type { Pulse } from '../types'

function makePulse(overrides: Partial<Pulse> = {}): Pulse {
  return {
    id: 'p1',
    userId: 'user-1',
    venueId: 'neumos',
    photos: [],
    energyRating: 'buzzing',
    caption: 'Go',
    kind: 'review',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
    reactions: { fire: [], eyes: [], skull: [], lightning: [] },
    views: 0,
    ...overrides,
  }
}

describe('checkPulseRateLimit', () => {
  const nowMs = Date.parse('2026-09-12T02:00:00.000Z')

  it('allows the first pulse then denies a second at the same venue within 2 minutes', () => {
    const first = checkPulseRateLimit({
      userId: 'user-1',
      venueId: 'neumos',
      pulses: [],
      nowMs,
    })
    expect(first.allowed).toBe(true)

    const second = checkPulseRateLimit({
      userId: 'user-1',
      venueId: 'neumos',
      pulses: [makePulse({ createdAt: new Date(nowMs - 30_000).toISOString() })],
      nowMs,
    })
    expect(second.allowed).toBe(false)
    expect(second.reason).toBe('venue')
    expect(second.message).toBe(PULSE_RATE_LIMIT_COPY.venue)
  })

  it('allows 5 pulses in 10 minutes then denies the 6th', () => {
    const pulses = Array.from({ length: 5 }, (_, i) => makePulse({
      id: `p-${i}`,
      venueId: `venue-${i}`,
      createdAt: new Date(nowMs - 60_000).toISOString(),
    }))
    const allowed = checkPulseRateLimit({
      userId: 'user-1',
      venueId: 'venue-5',
      pulses: pulses.slice(0, 4),
      nowMs,
    })
    expect(allowed.allowed).toBe(true)

    const denied = checkPulseRateLimit({
      userId: 'user-1',
      venueId: 'venue-5',
      pulses,
      nowMs,
    })
    expect(denied.allowed).toBe(false)
    expect(denied.reason).toBe('user')
    expect(denied.message).toBe(PULSE_RATE_LIMIT_COPY.user)
  })

  it('maps SQL trigger text to the same client copy', () => {
    expect(pulseRateLimitFromUnknown(new Error('Too many pulses — max 5 every 10 minutes')))
      .toBe(PULSE_RATE_LIMIT_COPY.user)
    expect(pulseRateLimitFromUnknown(new Error('Wait 2 minutes before another pulse at this venue')))
      .toBe(PULSE_RATE_LIMIT_COPY.venue)
  })
})
