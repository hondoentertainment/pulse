/**
 * Followed-venue surge push decisions.
 * Not Signal. Missing VAPID keys stay an honest no-op in the sender.
 */

export const SURGE_NOTIFY_WINDOW_MS = 2 * 60 * 60 * 1000
export const SURGE_ENERGY = 'electric'

export type SurgeSkipReason =
  | 'not_electric'
  | 'already_electric'
  | 'rate_limited'

export interface SurgeNotifyDecision {
  send: boolean
  reason: 'electric_cross' | SurgeSkipReason
}

/** True when this pulse is the first Electric in the recent window. */
export function decideVenueSurgeNotify(input: {
  energyRating?: string | null
  priorEnergies?: readonly string[]
  lastNotifiedAt?: string | null
  nowMs?: number
}): SurgeNotifyDecision {
  const energy = (input.energyRating ?? '').toLowerCase()
  if (energy !== SURGE_ENERGY) {
    return { send: false, reason: 'not_electric' }
  }
  const prior = input.priorEnergies ?? []
  if (prior.some((rating) => rating.toLowerCase() === SURGE_ENERGY)) {
    return { send: false, reason: 'already_electric' }
  }
  if (!surgeRateLimitOpen(input.lastNotifiedAt, input.nowMs ?? Date.now())) {
    return { send: false, reason: 'rate_limited' }
  }
  return { send: true, reason: 'electric_cross' }
}

export function surgeRateLimitOpen(
  lastNotifiedAt: string | null | undefined,
  nowMs: number,
  windowMs: number = SURGE_NOTIFY_WINDOW_MS,
): boolean {
  if (!lastNotifiedAt) return true
  const then = Date.parse(lastNotifiedAt)
  if (!Number.isFinite(then)) return true
  return nowMs - then >= windowMs
}

/**
 * Quiet hours use Seattle local time. A window that wraps midnight
 * (22 → 7) is quiet overnight. Equal or null bounds mean no quiet hours.
 */
export function isWithinQuietHours(input: {
  hour: number
  start: number | null
  end: number | null
}): boolean {
  const { hour, start, end } = input
  if (start == null || end == null) return false
  if (!Number.isInteger(start) || !Number.isInteger(end)) return false
  if (start < 0 || start > 23 || end < 0 || end > 23) return false
  if (start === end) return false
  if (start < end) return hour >= start && hour < end
  return hour >= start || hour < end
}

export function seattleHour(now: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    hour: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(now)
  const hour = Number(parts.find((part) => part.type === 'hour')?.value)
  return Number.isInteger(hour) ? hour : now.getUTCHours()
}

export function shouldDeliverSurgePush(input: {
  muted: boolean
  quietStart: number | null
  quietEnd: number | null
  hour: number
}): boolean {
  if (input.muted) return false
  return !isWithinQuietHours({
    hour: input.hour,
    start: input.quietStart,
    end: input.quietEnd,
  })
}

export function venueSurgeNotifyPayload(input: {
  venueId: string
  venueName: string
}): { title: string; body: string; url: string } {
  return {
    title: `${input.venueName} just went Electric`,
    body: 'A venue you follow is surging.',
    url: `/venue/${input.venueId}`,
  }
}

export function parseQuietHour(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value)) return null
  if (value < 0 || value > 23) return null
  return value
}
