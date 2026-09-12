/**
 * Live-pulse Web Push fan-out.
 * Missing VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY is an honest no-op.
 */

import { createAdminClient } from './supabase-server.js'

type NotifySubscriber = {
  userId: string
  lat?: number | null
  lng?: number | null
  scope?: 'followed' | 'nearby' | 'followed_or_nearby'
}

function livePulseNotifyPayload(input: {
  venueId: string
  venueName: string
  caption?: string | null
}): { title: string; body: string; url: string } {
  const snippet = (input.caption ?? '').trim()
  return {
    title: input.venueName,
    body: snippet || 'New live pulse',
    url: `/venue/${input.venueId}`,
  }
}

function haversineMiles(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 3958.8
  const toRad = (x: number) => (x * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(Math.min(1, h)))
}

function selectLivePulseNotifyTargets(input: {
  authorUserId?: string | null
  followedUserIds: readonly string[]
  subscribers: readonly NotifySubscriber[]
  venueLocation?: { lat: number; lng: number } | null
}): Array<{ userId: string }> {
  const followed = new Set(input.followedUserIds)
  const seen = new Set<string>()
  const targets: Array<{ userId: string }> = []
  for (const sub of input.subscribers) {
    if (!sub.userId || seen.has(sub.userId)) continue
    if (input.authorUserId && sub.userId === input.authorUserId) continue
    const scope = sub.scope ?? 'followed_or_nearby'
    if ((scope === 'followed' || scope === 'followed_or_nearby') && followed.has(sub.userId)) {
      seen.add(sub.userId)
      targets.push({ userId: sub.userId })
      continue
    }
    const canNearby = scope === 'nearby' || scope === 'followed_or_nearby'
    if (
      canNearby
      && input.venueLocation
      && typeof sub.lat === 'number'
      && typeof sub.lng === 'number'
    ) {
      const miles = haversineMiles(input.venueLocation, { lat: sub.lat, lng: sub.lng })
      if (miles <= 1.5) {
        seen.add(sub.userId)
        targets.push({ userId: sub.userId })
      }
    }
  }
  return targets
}

export interface WebPushEnv {
  VAPID_PUBLIC_KEY?: string
  VAPID_PRIVATE_KEY?: string
  VAPID_SUBJECT?: string
}

export interface LivePulseNotifyInput {
  venueId: string
  venueName: string
  caption?: string | null
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
    admin.from('venue_follows').select('user_id').eq('venue_id', input.venueId),
    admin.from('web_push_subscriptions').select('user_id, endpoint, p256dh, auth, lat, lng, scope'),
  ])

  const followedUserIds = (followRows ?? [])
    .map((row) => (typeof row.user_id === 'string' ? row.user_id : ''))
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
  const targetIds = new Set(targets.map((t) => t.userId))
  const payload = livePulseNotifyPayload(input)

  let sent = 0
  let skipped = 0
  for (const row of subRows ?? []) {
    if (typeof row.user_id !== 'string' || !targetIds.has(row.user_id)) continue
    if (typeof row.endpoint !== 'string' || typeof row.p256dh !== 'string' || typeof row.auth !== 'string') {
      skipped += 1
      continue
    }
    const ok = await sendOne(
      { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
      payload,
      vapid,
    )
    if (ok) sent += 1
    else skipped += 1
  }

  return { attempted: true, sent, skipped, reason: 'ok' }
}
