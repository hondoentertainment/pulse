/**
 * I’m-here Web Push.
 * Self glance to the confirmer, plus followers who already follow them.
 * Missing VAPID keys stay an honest no-op. Does not rotate keys.
 */

import { createAdminClient } from './supabase-server.js'
import { deliverWebPush, getVapidConfig, hasVapidKeys, type WebPushEnv } from './web-push-live.js'
import {
  IM_HERE_NOTIFY_WINDOW_MS,
  imHereDisplayName,
  imHereFollowerFanoutOpen,
  imHereFollowerGlancePayload,
  imHereRateLimitOpen,
  imHereSelfGlancePayload,
  presenceAllowsFollowerGlance,
  readPresenceGlancePolicy,
  selectImHereDeliveries,
  type ImHereTokenRow,
} from '../../src/lib/im-here-notify.js'
import { parseQuietHour, seattleHour } from '../../src/lib/venue-surge-notify.js'

export const IM_HERE_FOLLOWER_CAP = 40

const VENUE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface ImHereNotifyInput {
  userId: string
  venueId: string
  venueName: string
}

export interface ImHereNotifyResult {
  attempted: boolean
  sent: number
  skipped: number
  selfSent: number
  followerSent: number
  reason: 'missing_vapid' | 'missing_admin' | 'ok' | 'rate_limited'
}

function asToken(row: Record<string, unknown>): ImHereTokenRow | null {
  if (typeof row.user_id !== 'string' || typeof row.token !== 'string') return null
  if (typeof row.p256dh !== 'string' || typeof row.auth !== 'string') return null
  if (!row.token || !row.p256dh || !row.auth) return null
  return {
    userId: row.user_id,
    endpoint: row.token,
    p256dh: row.p256dh,
    auth: row.auth,
    quietStart: parseQuietHour(row.quiet_hours_start),
    quietEnd: parseQuietHour(row.quiet_hours_end),
  }
}

export async function notifyImHere(
  input: ImHereNotifyInput,
  env: WebPushEnv = process.env,
): Promise<ImHereNotifyResult> {
  if (!hasVapidKeys(env)) {
    console.info('[web-push] im-here no-op (VAPID keys missing)', { venueId: input.venueId })
    return { attempted: false, sent: 0, skipped: 0, selfSent: 0, followerSent: 0, reason: 'missing_vapid' }
  }

  const admin = createAdminClient()
  if (!admin) {
    console.info('[web-push] im-here no-op (service role missing)', { venueId: input.venueId })
    return { attempted: false, sent: 0, skipped: 0, selfSent: 0, followerSent: 0, reason: 'missing_admin' }
  }

  const vapid = getVapidConfig(env)
  if (!vapid) {
    return { attempted: false, sent: 0, skipped: 0, selfSent: 0, followerSent: 0, reason: 'missing_vapid' }
  }

  const venueIsUuid = VENUE_UUID.test(input.venueId)
  const since = new Date(Date.now() - IM_HERE_NOTIFY_WINDOW_MS).toISOString()

  const profileQuery = admin
    .from('profiles')
    .select('username, display_name, presence_settings')
    .eq('id', input.userId)
    .maybeSingle()

  const presenceQuery = venueIsUuid
    ? admin
      .from('presence')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', input.userId)
      .eq('venue_id', input.venueId)
      .is('left_at', null)
      .gte('checked_in_at', since)
    : Promise.resolve({ count: 1, error: null })

  const [profileResult, presenceResult] = await Promise.all([profileQuery, presenceQuery])

  let recentCount = 0
  let presenceKnown = false
  if (!venueIsUuid || presenceResult.error) {
    if (presenceResult.error) {
      console.info('[web-push] im-here presence count unavailable', presenceResult.error.message)
    }
  } else {
    recentCount = typeof presenceResult.count === 'number' ? presenceResult.count : 0
    presenceKnown = true
  }
  const rateLimitOpen = presenceKnown ? imHereRateLimitOpen(recentCount) : true

  let displayName = 'Someone you follow'
  let notifyFollowers = false
  if (!profileResult.error && profileResult.data) {
    const row = profileResult.data as {
      username?: string | null
      display_name?: string | null
      presence_settings?: unknown
    }
    displayName = imHereDisplayName({
      displayName: row.display_name,
      username: row.username,
    })
    notifyFollowers = presenceKnown
      && imHereFollowerFanoutOpen(recentCount)
      && presenceAllowsFollowerGlance(readPresenceGlancePolicy(row.presence_settings))
  }

  if (!rateLimitOpen) {
    return { attempted: false, sent: 0, skipped: 0, selfSent: 0, followerSent: 0, reason: 'rate_limited' }
  }

  const followerIds = new Set<string>()
  if (notifyFollowers) {
    const { data: followRows, error: followError } = await admin
      .from('follows')
      .select('follower_id')
      .eq('target_kind', 'user')
      .eq('target_user_id', input.userId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(IM_HERE_FOLLOWER_CAP)
    if (followError) {
      console.info('[web-push] im-here follower lookup failed', followError.message)
      notifyFollowers = false
    } else {
      for (const row of followRows ?? []) {
        if (typeof row.follower_id === 'string' && row.follower_id !== input.userId) {
          followerIds.add(row.follower_id)
        }
      }
    }
  }

  const tokenUserIds = [input.userId, ...followerIds]
  const { data: tokenRows, error: tokenError } = await admin
    .from('push_tokens')
    .select('user_id, token, p256dh, auth, quiet_hours_start, quiet_hours_end')
    .eq('platform', 'web')
    .in('user_id', tokenUserIds)

  if (tokenError) {
    console.info('[web-push] im-here token lookup failed', tokenError.message)
    return { attempted: true, sent: 0, skipped: 0, selfSent: 0, followerSent: 0, reason: 'ok' }
  }

  const tokens = (tokenRows ?? [])
    .map((row) => asToken(row as Record<string, unknown>))
    .filter((row): row is ImHereTokenRow => row !== null)

  const deliveries = selectImHereDeliveries({
    actorUserId: input.userId,
    hour: seattleHour(new Date()),
    rateLimitOpen,
    notifyFollowers: notifyFollowers && followerIds.size > 0,
    followerIds,
    tokens,
  })

  const selfPayload = imHereSelfGlancePayload({
    venueId: input.venueId,
    venueName: input.venueName,
  })
  const followerPayload = imHereFollowerGlancePayload({
    venueId: input.venueId,
    venueName: input.venueName,
    displayName,
  })

  let sent = 0
  let skipped = tokens.length - deliveries.length
  let selfSent = 0
  let followerSent = 0
  if (skipped < 0) skipped = 0

  for (const delivery of deliveries) {
    const ok = await deliverWebPush(
      { endpoint: delivery.endpoint, keys: { p256dh: delivery.p256dh, auth: delivery.auth } },
      delivery.role === 'self' ? selfPayload : followerPayload,
      vapid,
      { urgency: 'normal', ttlSeconds: Math.floor(IM_HERE_NOTIFY_WINDOW_MS / 1000) },
    )
    if (!ok) {
      skipped += 1
      continue
    }
    sent += 1
    if (delivery.role === 'self') selfSent += 1
    else followerSent += 1
  }

  console.info('[web-push] im-here', {
    venueId: input.venueId,
    sent,
    skipped,
    selfSent,
    followerSent,
  })

  return { attempted: true, sent, skipped, selfSent, followerSent, reason: 'ok' }
}
