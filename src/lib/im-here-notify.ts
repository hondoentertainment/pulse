/**
 * I’m-here Web Push decisions.
 *
 * Self glance: the person who just confirmed I’m here.
 * Follower glance: people who already follow them (`follows.target_kind = user`),
 * which is the same graph as here-now names. No new table.
 *
 * Surge quiet hours do not apply to the self glance — that control is for
 * Electric alerts, and the user just confirmed. Follower pushes honor quiet
 * hours on the recipient’s web push row. Surge mute stays surge-only.
 */

import { glanceText, type GlancePushPayload } from './glance-push'
import { getImHereMapPath } from './im-here'
import { isWithinQuietHours } from './venue-surge-notify'

export const IM_HERE_KIND = 'im_here'
/** Matches the 90-minute here-now window. */
export const IM_HERE_NOTIFY_WINDOW_MS = 90 * 60 * 1000
export const IM_HERE_SELF_TITLE_MAX = 48

export type ImHereVisibility = 'everyone' | 'friends' | 'off'
export type ImHerePushRole = 'self' | 'follower'

export interface ImHereTokenRow {
  userId: string
  endpoint: string
  p256dh: string
  auth: string
  quietStart: number | null
  quietEnd: number | null
}

export interface ImHereDelivery extends ImHereTokenRow {
  role: ImHerePushRole
}

export function parseImHereVisibility(value: unknown): ImHereVisibility {
  if (value === 'everyone' || value === 'friends' || value === 'off') return value
  return 'everyone'
}

export function readPresenceGlancePolicy(settings: unknown): {
  enabled: boolean
  visibility: ImHereVisibility
} {
  if (!settings || typeof settings !== 'object') {
    return { enabled: true, visibility: 'everyone' }
  }
  const row = settings as { enabled?: unknown; visibility?: unknown }
  return {
    enabled: row.enabled !== false,
    visibility: parseImHereVisibility(row.visibility),
  }
}

/** Follower pushes only. Self glance ignores this. */
export function presenceAllowsFollowerGlance(input: {
  enabled: boolean
  visibility: ImHereVisibility
}): boolean {
  if (!input.enabled) return false
  return input.visibility !== 'off'
}

/**
 * `recentPresenceCount` includes the row just written.
 * A second I’m-here inside the window does not ping again.
 * Unknown counts (query failed) stay open so the self glance can still send.
 */
export function imHereRateLimitOpen(recentPresenceCount: number): boolean {
  if (!Number.isFinite(recentPresenceCount) || recentPresenceCount < 0) return true
  return recentPresenceCount <= 1
}

/**
 * Whether this confirm should call the notify endpoint.
 * `recentPresenceCount` is open rows already stored before this confirm's insert.
 * The endpoint counts the row just written and sends only when that total is <= 1.
 * Unknown counts stay open so the server can still decide.
 */
export function imHereGlanceStillOpen(
  recentPresenceCount: number | null,
  wrotePresence: boolean,
): boolean {
  if (recentPresenceCount === null || !Number.isFinite(recentPresenceCount)) return true
  const counted = Math.max(0, recentPresenceCount) + (wrotePresence ? 1 : 0)
  return imHereRateLimitOpen(counted)
}

/** Follower pushes need the presence row that says they are actually here. */
export function imHereFollowerFanoutOpen(recentPresenceCount: number): boolean {
  return recentPresenceCount === 1
}

export function imHereFollowerInQuietHours(input: {
  hour: number
  quietStart: number | null
  quietEnd: number | null
}): boolean {
  return isWithinQuietHours({
    hour: input.hour,
    start: input.quietStart,
    end: input.quietEnd,
  })
}

export function imHereDisplayName(input: {
  displayName?: string | null
  username?: string | null
}): string {
  const raw = (input.displayName || input.username || '').trim()
  if (!raw || raw.includes('@')) return 'Someone you follow'
  return glanceText(raw, 28)
}

export function imHereSelfTitle(venueName: string): string {
  const prefix = "You're at "
  const suffix = ' · Pulse'
  const room = IM_HERE_SELF_TITLE_MAX - prefix.length - suffix.length
  return `${prefix}${glanceText(venueName, Math.max(8, room))}${suffix}`
}

export function imHereSelfGlancePayload(input: {
  venueId: string
  venueName: string
}): GlancePushPayload {
  return {
    title: imHereSelfTitle(input.venueName),
    body: 'Open the map',
    url: getImHereMapPath(input.venueId),
    kind: IM_HERE_KIND,
    tag: `im-here:${input.venueId}`,
    renotify: false,
  }
}

export function imHereFollowerGlancePayload(input: {
  venueId: string
  venueName: string
  displayName: string
}): GlancePushPayload {
  const who = glanceText(input.displayName || 'Someone you follow', 28)
  return {
    title: glanceText(`${who} is here`, 42),
    body: glanceText(input.venueName, 42),
    url: getImHereMapPath(input.venueId),
    kind: IM_HERE_KIND,
    tag: `im-here:${input.venueId}`,
    renotify: false,
  }
}

function tokenReady(token: ImHereTokenRow): boolean {
  return Boolean(token.userId && token.endpoint && token.p256dh && token.auth)
}

/**
 * Who receives this confirm.
 * Self tokens always qualify when the rate limit is open (quiet hours do not apply).
 * Follower tokens qualify only when presence allows it, they follow the actor,
 * and their quiet hours are open.
 */
export function selectImHereDeliveries(input: {
  actorUserId: string
  hour: number
  rateLimitOpen: boolean
  notifyFollowers: boolean
  followerIds: ReadonlySet<string>
  tokens: readonly ImHereTokenRow[]
}): ImHereDelivery[] {
  if (!input.rateLimitOpen || !input.actorUserId) return []
  const deliveries: ImHereDelivery[] = []
  for (const token of input.tokens) {
    if (!tokenReady(token)) continue
    if (token.userId === input.actorUserId) {
      deliveries.push({ ...token, role: 'self' })
      continue
    }
    if (!input.notifyFollowers) continue
    if (!input.followerIds.has(token.userId)) continue
    if (imHereFollowerInQuietHours({
      hour: input.hour,
      quietStart: token.quietStart,
      quietEnd: token.quietEnd,
    })) {
      continue
    }
    deliveries.push({ ...token, role: 'follower' })
  }
  return deliveries
}
