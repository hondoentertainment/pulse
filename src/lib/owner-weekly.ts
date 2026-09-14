/**
 * Owner weekly — verified owner only, Sunday in-app notification.
 * Push only if existing VAPID. Missing secret = no-op. Pending claims stay locked.
 */

import type { Pulse } from './types'
import type { VenueClaim } from './venue-owner'
import { localDateKey, localHour } from './tonight-digest'
import { canAccessVenueInbox } from './live-reviews'

export const OWNER_WEEKLY_TZ = 'America/Los_Angeles'
export const OWNER_WEEKLY_WEEKDAY = 0
export const OWNER_WEEKLY_STORAGE_KEY = 'pulse_owner_weekly_v1'

export interface OwnerWeeklyStats {
  venueId: string
  pulseCount: number
  hereNowCount: number
}

export interface OwnerWeeklyNote {
  title: string
  body: string
  localDateKey: string
  stats: OwnerWeeklyStats[]
}

export function isSundayInSeattle(now: Date = new Date()): boolean {
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: OWNER_WEEKLY_TZ,
    weekday: 'short',
  }).format(now)
  return weekday === 'Sun'
}

export function canSendOwnerWeekly(input: {
  userId: string | null | undefined
  venueId: string
  claims: VenueClaim[]
}): boolean {
  return canAccessVenueInbox(input)
}

export function lastWeekWindow(now: Date = new Date()): { start: Date; end: Date } {
  const end = new Date(now)
  const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  return { start, end }
}

export function buildOwnerWeeklyNote(input: {
  venueId: string
  venueName: string
  pulses: readonly Pulse[]
  hereNowCount: number
  now?: Date
}): OwnerWeeklyNote {
  const now = input.now ?? new Date()
  const { start } = lastWeekWindow(now)
  const pulseCount = input.pulses.filter((pulse) => (
    pulse.venueId === input.venueId
    && Date.parse(pulse.createdAt) >= start.getTime()
  )).length
  const here = Math.max(0, Math.floor(input.hereNowCount))
  return {
    title: `Last week at ${input.venueName}`,
    body: `${pulseCount} pulses · ${here} here-now this hour. Pending claims stay locked.`,
    localDateKey: localDateKey(now, OWNER_WEEKLY_TZ),
    stats: [{ venueId: input.venueId, pulseCount, hereNowCount: here }],
  }
}

export function shouldShowOwnerWeekly(input: {
  now?: Date
  lastShownDateKey?: string | null
  verified: boolean
}): boolean {
  if (!input.verified) return false
  const now = input.now ?? new Date()
  if (!isSundayInSeattle(now)) return false
  if (localHour(now, OWNER_WEEKLY_TZ) < 10) return false
  return input.lastShownDateKey !== localDateKey(now, OWNER_WEEKLY_TZ)
}

export function ownerWeeklyNoopReason(
  env: { CRON_SECRET?: string; VAPID_PUBLIC_KEY?: string; VAPID_PRIVATE_KEY?: string } = {},
): 'missing_secret' | null {
  return env.CRON_SECRET?.trim() ? null : 'missing_secret'
}
