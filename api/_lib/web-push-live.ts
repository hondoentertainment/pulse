/**
 * Live-pulse Web Push fan-out.
 * Missing VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY is an honest no-op.
 */

import {
  collectLivePulseNotifyUserIds,
  selectLivePulseNotifyTargets,
  type NotifySubscriber,
} from '../../src/lib/live-pulse-notify.js'
import {
  decideVenueSurgeNotify,
  parseQuietHour,
  seattleHour,
  shouldDeliverSurgePush,
  venueSurgeNotifyPayload,
} from '../../src/lib/venue-surge-notify.js'
import { createAdminClient } from './supabase-server.js'

export interface WebPushEnv {
  VAPID_PUBLIC_KEY?: string
  VAPID_PRIVATE_KEY?: string
  VAPID_SUBJECT?: string
}

export interface LivePulseNotifyInput {
  venueId: string
  venueName: string
  caption?: string | null
  pulseId?: string | null
  authorUserId?: string | null
  energyRating?: string | null
  venueLocation?: { lat: number; lng: number } | null
}

export interface LivePulseNotifyResult {
  attempted: boolean
  sent: number
  skipped: number
  reason?: 'missing_vapid' | 'missing_admin' | 'ok' | 'not_surge' | 'rate_limited' | 'already_electric' | 'rate_limit_unavailable'
}

function readVapid(env: WebPushEnv = process.env): { publicKey: string; privateKey: string; subject: string } | null {
  const publicKey = env.VAPID_PUBLIC_KEY?.trim()
  const privateKey = env.VAPID_PRIVATE_KEY?.trim()
  if (!publicKey || !privateKey) return null
  return {
    publicKey,
    privateKey,
    subject: env.VAPID_SUBJECT?.trim() || 'mailto:ops@pulse.local',
  }
}

export function hasVapidKeys(env: WebPushEnv = process.env): boolean {
  return readVapid(env) !== null
}

async function sendOne(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: { title: string; body: string; url: string },
  vapid: { publicKey: string; privateKey: string; subject: string },
): Promise<boolean> {
  try {
    const webpush = await import('web-push')
    webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey)
    await webpush.sendNotification(subscription, JSON.stringify({
      title: payload.title,
      body: payload.body,
      data: { url: payload.url },
    }))
    return true
  } catch (err) {
    console.warn('[web-push] send failed', err)
    return false
  }
}

export async function notifyLivePulse(
  input: LivePulseNotifyInput,
  env: WebPushEnv = process.env,
): Promise<LivePulseNotifyResult> {
  if (!hasVapidKeys(env)) {
    console.info('[web-push] no-op (VAPID keys missing)', { venueId: input.venueId })
    return { attempted: false, sent: 0, skipped: 0, reason: 'missing_vapid' }
  }

  const admin = createAdminClient()
  if (!admin) {
    console.info('[web-push] no-op (service role missing)', { venueId: input.venueId })
    return { attempted: false, sent: 0, skipped: 0, reason: 'missing_admin' }
  }

  const vapid = readVapid(env)
  if (!vapid) {
    return { attempted: false, sent: 0, skipped: 0, reason: 'missing_vapid' }
  }

  const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  const [{ data: followRows, error: followError }, { data: subRows }, { data: recentRows }, noticeResult] = await Promise.all([
    admin
      .from('follows')
      .select('follower_id, surge_muted')
      .eq('target_kind', 'venue')
      .eq('target_venue_id', input.venueId)
      .is('deleted_at', null),
    admin
      .from('push_tokens')
      .select('user_id, token, p256dh, auth, lat, lng, scope, platform, quiet_hours_start, quiet_hours_end')
      .eq('platform', 'web'),
    admin
      .from('pulses')
      .select('id, energy_rating')
      .eq('venue_id', input.venueId)
      .gte('created_at', since)
      .limit(40),
    admin
      .from('venue_surge_notices')
      .select('notified_at')
      .eq('venue_id', input.venueId)
      .maybeSingle(),
  ])

  let resolvedFollows = followRows
  if (followError) {
    const fallback = await admin
      .from('follows')
      .select('follower_id')
      .eq('target_kind', 'venue')
      .eq('target_venue_id', input.venueId)
      .is('deleted_at', null)
    resolvedFollows = fallback.data
  }

  const mutedUserIds = new Set(
    (followError ? [] : (followRows ?? []))
      .filter((row) => row.surge_muted === true && typeof row.follower_id === 'string')
      .map((row) => row.follower_id as string),
  )

  const followedUserIds = (resolvedFollows ?? [])
    .map((row) => (typeof row.follower_id === 'string' ? row.follower_id : ''))
    .filter(Boolean)

  const subscribers: NotifySubscriber[] = (subRows ?? []).map((row) => ({
    userId: typeof row.user_id === 'string' ? row.user_id : '',
    lat: typeof row.lat === 'number' ? row.lat : null,
    lng: typeof row.lng === 'number' ? row.lng : null,
    scope: row.scope === 'followed' || row.scope === 'nearby' || row.scope === 'followed_or_nearby'
      ? row.scope
      : 'followed_or_nearby',
  }))

  const targets = selectLivePulseNotifyTargets({
    authorUserId: input.authorUserId,
    followedUserIds,
    subscribers,
    venueLocation: input.venueLocation,
  })
  const webPushUserIds = new Set(targets.map((t) => t.userId))
  const notifyUserIds = collectLivePulseNotifyUserIds({
    authorUserId: input.authorUserId,
    followedUserIds,
    subscriberTargets: targets,
  })
  const priorEnergies = (recentRows ?? [])
    .filter((row) => row.id !== input.pulseId)
    .map((row) => (typeof row.energy_rating === 'string' ? row.energy_rating : ''))
  const surge = decideVenueSurgeNotify({
    energyRating: input.energyRating,
    priorEnergies,
    lastNotifiedAt: noticeResult.error ? null : (noticeResult.data?.notified_at ?? null),
  })

  if (notifyUserIds.length > 0) {
    const rows = notifyUserIds.map((userId) => ({
      user_id: userId,
      type: 'friend_pulse',
      venue_id: input.venueId,
      pulse_id: input.pulseId ?? null,
      read: false,
    }))
    await admin.from('notifications').insert(rows).then(({ error }) => {
      if (error) console.warn('[web-push] notification insert failed', error)
    })
  }

  if (!surge.send) {
    return {
      attempted: false,
      sent: 0,
      skipped: 0,
      reason: surge.reason === 'electric_cross' ? 'ok' : surge.reason,
    }
  }
  if (noticeResult.error) {
    console.info('[web-push] surge rate-limit unavailable', noticeResult.error.message)
    return { attempted: false, sent: 0, skipped: 0, reason: 'rate_limit_unavailable' }
  }

  const surgePayload = venueSurgeNotifyPayload({
    venueId: input.venueId,
    venueName: input.venueName,
  })
  const hour = seattleHour(new Date())
  let sent = 0
  let skipped = 0
  for (const row of subRows ?? []) {
    if (typeof row.user_id !== 'string' || !webPushUserIds.has(row.user_id)) continue
    if (!followedUserIds.includes(row.user_id)) {
      skipped += 1
      continue
    }
    const deliver = shouldDeliverSurgePush({
      muted: mutedUserIds.has(row.user_id),
      quietStart: parseQuietHour(row.quiet_hours_start),
      quietEnd: parseQuietHour(row.quiet_hours_end),
      hour,
    })
    if (!deliver) {
      skipped += 1
      continue
    }
    if (typeof row.token !== 'string' || typeof row.p256dh !== 'string' || typeof row.auth !== 'string') {
      skipped += 1
      continue
    }
    const ok = await sendOne(
      { endpoint: row.token, keys: { p256dh: row.p256dh, auth: row.auth } },
      surgePayload,
      vapid,
    )
    if (ok) sent += 1
    else skipped += 1
  }

  if (sent > 0) {
    await admin.from('venue_surge_notices').upsert({
      venue_id: input.venueId,
      notified_at: new Date().toISOString(),
      pulse_id: input.pulseId ?? null,
    }, { onConflict: 'venue_id' })
  }

  return { attempted: true, sent, skipped, reason: 'ok' }
}
