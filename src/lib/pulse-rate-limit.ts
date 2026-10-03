/**
 * Pulse / live-review abuse limits.
 * Server SQL trigger is the source of truth; this module is the matching
 * soft client throttle and shared error copy.
 */

import type { Pulse } from './types'

export const PULSE_USER_WINDOW_MS = 10 * 60 * 1000
export const PULSE_USER_MAX = 5
export const PULSE_VENUE_WINDOW_MS = 2 * 60 * 1000
export const PULSE_VENUE_MAX = 1

export const PULSE_RATE_LIMIT_COPY = {
  user: 'Too many pulses — max 5 every 10 minutes',
  venue: 'Wait 2 minutes before another pulse at this venue',
} as const

export interface PulseRateLimitInput {
  userId: string
  venueId: string
  pulses: readonly Pick<Pulse, 'userId' | 'venueId' | 'createdAt'>[]
  nowMs?: number
}

export interface PulseRateLimitResult {
  allowed: boolean
  reason?: 'user' | 'venue'
  message?: string
  retryAfterMs: number
}

function countInWindow(
  pulses: readonly Pick<Pulse, 'userId' | 'venueId' | 'createdAt'>[],
  predicate: (pulse: Pick<Pulse, 'userId' | 'venueId' | 'createdAt'>) => boolean,
  nowMs: number,
  windowMs: number,
): number {
  const cutoff = nowMs - windowMs
  return pulses.filter((pulse) => {
    if (!predicate(pulse)) return false
    const created = new Date(pulse.createdAt).getTime()
    return Number.isFinite(created) && created > cutoff
  }).length
}

export function checkPulseRateLimit(input: PulseRateLimitInput): PulseRateLimitResult {
  const nowMs = input.nowMs ?? Date.now()
  const userCount = countInWindow(
    input.pulses,
    (pulse) => pulse.userId === input.userId,
    nowMs,
    PULSE_USER_WINDOW_MS,
  )
  if (userCount >= PULSE_USER_MAX) {
    return {
      allowed: false,
      reason: 'user',
      message: PULSE_RATE_LIMIT_COPY.user,
      retryAfterMs: PULSE_USER_WINDOW_MS,
    }
  }

  const venueCount = countInWindow(
    input.pulses,
    (pulse) => pulse.userId === input.userId && pulse.venueId === input.venueId,
    nowMs,
    PULSE_VENUE_WINDOW_MS,
  )
  if (venueCount >= PULSE_VENUE_MAX) {
    return {
      allowed: false,
      reason: 'venue',
      message: PULSE_RATE_LIMIT_COPY.venue,
      retryAfterMs: PULSE_VENUE_WINDOW_MS,
    }
  }

  return { allowed: true, retryAfterMs: 0 }
}

export function isPulseRateLimitMessage(message: string | undefined | null): boolean {
  if (!message) return false
  return message.includes('max 5 every 10 minutes')
    || message.includes('Wait 2 minutes before another pulse')
    || message.includes('P0001')
}

export function pulseRateLimitFromUnknown(error: unknown): string | null {
  const message = error instanceof Error ? error.message : String(error ?? '')
  if (isPulseRateLimitMessage(message)) {
    if (message.includes('10 minutes')) return PULSE_RATE_LIMIT_COPY.user
    if (message.includes('2 minutes')) return PULSE_RATE_LIMIT_COPY.venue
    return message
  }
  return null
}
