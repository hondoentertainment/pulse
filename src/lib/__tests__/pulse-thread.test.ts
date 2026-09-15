import { describe, expect, it } from 'vitest'
import {
  checkPulseReplyRateLimit,
  oneTapPulseReply,
  pulseReplyAuthPath,
  repliesForPulse,
  sanitizePulseReplyBody,
  PULSE_REPLY_BODY,
} from '../pulse-thread'

describe('pulse thread', () => {
  it('one-tap reply stays on the venue and sanitizes body', () => {
    const reply = oneTapPulseReply({
      pulseId: 'p1',
      venueId: 'neumos',
      userId: 'me',
      nowIso: '2026-09-14T04:00:00.000Z',
    })
    expect(reply.body).toBe(PULSE_REPLY_BODY)
    expect(reply.venueId).toBe('neumos')
    expect(sanitizePulseReplyBody('   ')).toBe(PULSE_REPLY_BODY)
    expect(sanitizePulseReplyBody('On my way')).toBe('On my way')
    expect(repliesForPulse([reply], 'p1')).toHaveLength(1)
    expect(repliesForPulse([reply], 'other')).toEqual([])
  })

  it('rate-limits replies like pulses and sends guests to /auth', () => {
    const now = Date.parse('2026-09-14T04:10:00.000Z')
    const replies = Array.from({ length: 5 }, (_, i) => ({
      userId: 'me',
      venueId: 'neumos',
      createdAt: new Date(now - i * 30_000).toISOString(),
    }))
    expect(checkPulseReplyRateLimit({
      userId: 'me',
      venueId: 'neumos',
      replies,
      nowMs: now,
    }).allowed).toBe(false)
    expect(pulseReplyAuthPath('neumos', 'p1')).toBe('/auth?next=%2Fvenue%2Fneumos%3Freply%3Dp1')
  })
})
