/**
 * Live-pulse Web Push fan-out.
 * Missing VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY is an honest no-op.
 */

import {
  collectLivePulseNotifyUserIds,
  livePulseNotifyPayload,
  selectLivePulseNotifyTargets,
  type NotifySubscriber,
} from '../../src/lib/live-pulse-notify.js'
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
  venueLocation?: { lat: number; lng: number } | null
}

export interface LivePulseNotifyResult {
  attempted: boolean
  sent: number
  skipped: number
  reason?: 'missing_vapid' | 'missing_admin' | 'ok'
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

  const [{ data: followRows }, { data: subRows }] = await Promise.all([
    admin
      .from('follows')
      .select('follower_id')
      .eq('target_kind', 'venue')
      .eq('target_venue_id', input.venueId)
      .is('deleted_at', null),
    admin
      .from('push_tokens')
      .select('user_id, token, p256dh, auth, lat, lng, scope, platform')
      .eq('platform', 'web'),
  ])

  const followedUserIds = (followRows ?? [])
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
  const payload = livePulseNotifyPayload(input)

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

  let sent = 0
  let skipped = 0
  for (const row of subRows ?? []) {
    if (typeof row.user_id !== 'string' || !webPushUserIds.has(row.user_id)) continue
    if (typeof row.token !== 'string' || typeof row.p256dh !== 'string' || typeof row.auth !== 'string') {
      skipped += 1
      continue
    }
    const ok = await sendOne(
      { endpoint: row.token, keys: { p256dh: row.p256dh, auth: row.auth } },
      payload,
      vapid,
    )
    if (ok) sent += 1
    else skipped += 1
  }

  return { attempted: true, sent, skipped, reason: 'ok' }
}
