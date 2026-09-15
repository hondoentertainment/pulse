/**
 * Tonight digest at 8pm local.
 * Followed venues that went live → in-app note; else honest “quiet — be first”.
 * Web Push only if VAPID exists (cron). Client reminder is local-safe.
 */

import type { Pulse, Venue } from './types'

export const TONIGHT_DIGEST_HOUR = 20
export const TONIGHT_DIGEST_TZ = 'America/Los_Angeles'
export const TONIGHT_DIGEST_STORAGE_KEY = 'pulse_tonight_digest_v1'
export const TONIGHT_DIGEST_QUIET = 'Quiet — be first'
export const TONIGHT_DIGEST_LIVE_PREFIX = 'Live tonight'

export interface TonightDigestVenue {
  id: string
  name: string
}

export interface TonightDigestResult {
  kind: 'live' | 'quiet'
  title: string
  body: string
  venues: TonightDigestVenue[]
  localDateKey: string
}

export function localDateKey(now: Date = new Date(), timeZone = TONIGHT_DIGEST_TZ): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

export function localHour(now: Date = new Date(), timeZone = TONIGHT_DIGEST_TZ): number {
  const hour = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    hourCycle: 'h23',
  }).format(now)
  return Number.parseInt(hour, 10)
}

export function isTonightDigestHour(now: Date = new Date(), timeZone = TONIGHT_DIGEST_TZ): boolean {
  return localHour(now, timeZone) === TONIGHT_DIGEST_HOUR
}

export function listFollowedVenuesThatWentLive(
  venues: readonly Venue[],
  pulses: readonly Pulse[],
  followedVenueIds: readonly string[],
  nowMs: number = Date.now(),
  windowMs = 6 * 60 * 60 * 1000,
): TonightDigestVenue[] {
  const followed = new Set(followedVenueIds)
  if (followed.size === 0) return []
  const liveIds = new Set<string>()
  for (const pulse of pulses) {
    if (!followed.has(pulse.venueId)) continue
    const created = Date.parse(pulse.createdAt)
    if (!Number.isFinite(created)) continue
    if (nowMs - created > windowMs || created > nowMs) continue
    liveIds.add(pulse.venueId)
  }
  return venues
    .filter((venue) => liveIds.has(venue.id))
    .map((venue) => ({ id: venue.id, name: venue.name }))
}

export function buildTonightDigest(input: {
  venues: readonly Venue[]
  pulses: readonly Pulse[]
  followedVenueIds: readonly string[]
  now?: Date
}): TonightDigestResult {
  const now = input.now ?? new Date()
  const live = listFollowedVenuesThatWentLive(
    input.venues,
    input.pulses,
    input.followedVenueIds,
    now.getTime(),
  )
  const key = localDateKey(now)
  if (live.length > 0) {
    const names = live.map((venue) => venue.name).join(', ')
    return {
      kind: 'live',
      title: TONIGHT_DIGEST_LIVE_PREFIX,
      body: names,
      venues: live,
      localDateKey: key,
    }
  }
  return {
    kind: 'quiet',
    title: TONIGHT_DIGEST_QUIET,
    body: 'No followed rooms went live. Be first — we never invent a crowd.',
    venues: [],
    localDateKey: key,
  }
}

export function shouldShowTonightDigest(input: {
  now?: Date
  lastShownDateKey?: string | null
  timeZone?: string
}): boolean {
  const now = input.now ?? new Date()
  const zone = input.timeZone ?? TONIGHT_DIGEST_TZ
  if (!isTonightDigestHour(now, zone)) return false
  return input.lastShownDateKey !== localDateKey(now, zone)
}
