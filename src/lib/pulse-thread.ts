/**
 * Pulse thread — one-tap reply under a pulse on Tonight and the venue timeline.
 * Stays on the venue. Rate-limit like pulses. Guest → /auth.
 */

import { checkPulseRateLimit, type PulseRateLimitResult } from './pulse-rate-limit'
import { buildAuthPath } from './auth-return-intent'

export const PULSE_REPLY_BODY = 'Here too'
export const PULSE_REPLY_CTA = 'Reply'
export const PULSE_REPLY_MAX = 80

export interface PulseReply {
  id: string
  pulseId: string
  venueId: string
  userId: string
  body: string
  createdAt: string
}

export function sanitizePulseReplyBody(raw: unknown): string {
  if (typeof raw !== 'string') return PULSE_REPLY_BODY
  const trimmed = raw.trim().slice(0, PULSE_REPLY_MAX)
  return trimmed || PULSE_REPLY_BODY
}

export function oneTapPulseReply(input: {
  pulseId: string
  venueId: string
  userId: string
  nowIso?: string
}): PulseReply {
  return {
    id: `reply-${input.pulseId}-${input.userId}`,
    pulseId: input.pulseId,
    venueId: input.venueId,
    userId: input.userId,
    body: PULSE_REPLY_BODY,
    createdAt: input.nowIso ?? new Date().toISOString(),
  }
}

export function repliesForPulse(
  replies: readonly PulseReply[],
  pulseId: string,
): PulseReply[] {
  return replies
    .filter((reply) => reply.pulseId === pulseId)
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
}

export function checkPulseReplyRateLimit(input: {
  userId: string
  venueId: string
  replies: readonly Pick<PulseReply, 'userId' | 'venueId' | 'createdAt'>[]
  nowMs?: number
}): PulseRateLimitResult {
  return checkPulseRateLimit({
    userId: input.userId,
    venueId: input.venueId,
    pulses: input.replies.map((reply) => ({
      userId: reply.userId,
      venueId: reply.venueId,
      createdAt: reply.createdAt,
    })),
    nowMs: input.nowMs,
  })
}

export function pulseReplyAuthNext(venueId: string, pulseId: string): string {
  return `/venue/${encodeURIComponent(venueId)}?reply=${encodeURIComponent(pulseId)}`
}

export function pulseReplyAuthPath(venueId: string, pulseId: string): string {
  return buildAuthPath(pulseReplyAuthNext(venueId, pulseId))
}
