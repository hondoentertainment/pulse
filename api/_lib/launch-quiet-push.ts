/**
 * Quiet-night Web Push for a launched city that is not Seattle.
 * Reuses the venue-surge sender: same VAPID pair, mute, and quiet hours.
 * Missing keys or a missing rate-limit table stay an honest no-op.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  launchQuietCity,
  launchQuietRateOpen,
  planLaunchQuietPush,
  shouldSendLaunchQuietPush,
  type LaunchQuietPushPlan,
} from '../../src/lib/launch-city-quiet.js'
import { isQuietNightHour } from '../../src/lib/quiet-night.js'
import { seattleHour } from '../../src/lib/venue-surge-notify.js'
import type { Pulse, Venue } from '../../src/lib/types.js'
import { deliverWebPush, hasVenueSurgeVapid, type WebPushEnv } from './web-push-live.js'

export interface LaunchQuietPushResult {
  attempted: boolean
  sent: number
  skipped: number
  reason: 'off_hour' | 'not_quiet' | 'missing_vapid' | 'rate_limited' | 'rate_limit_unavailable' | 'ok'
}

async function withoutHiddenPulses(
  admin: SupabaseClient,
  pulses: readonly Pulse[],
): Promise<Pulse[]> {
  if (pulses.length === 0) return [...pulses]
  const hidden = await admin.from('pulses').select('id').not('hidden_at', 'is', null).limit(500)
  if (hidden.error || !hidden.data) return [...pulses]
  const ids = new Set(
    hidden.data
      .map((row) => (typeof row.id === 'string' ? row.id : ''))
      .filter(Boolean),
  )
  if (ids.size === 0) return [...pulses]
  return pulses.filter((pulse) => !ids.has(pulse.id))
}

function missingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  if (error.code === '42P01' || error.code === 'PGRST205') return true
  return /launch_quiet_notices|launch_quiet_mutes|schema cache/i.test(error.message ?? '')
}

export async function notifyLaunchQuietCity(
  admin: SupabaseClient,
  input: {
    venues: readonly Venue[]
    pulses: readonly Pulse[]
    now?: Date
    env?: WebPushEnv
  },
): Promise<LaunchQuietPushResult> {
  const now = input.now ?? new Date()
  const env = input.env ?? process.env
  if (!isQuietNightHour(now)) {
    return { attempted: false, sent: 0, skipped: 0, reason: 'off_hour' }
  }
  const city = launchQuietCity(input.venues)
  if (!city) {
    return { attempted: false, sent: 0, skipped: 0, reason: 'not_quiet' }
  }
  if (!hasVenueSurgeVapid(env)) {
    console.info('[web-push] launch quiet no-op (VAPID keys missing)')
    return { attempted: false, sent: 0, skipped: 0, reason: 'missing_vapid' }
  }

  const notice = await admin
    .from('launch_quiet_notices')
    .select('notified_at')
    .eq('city_key', city.key)
    .maybeSingle()
  if (notice.error && missingTable(notice.error)) {
    console.info('[web-push] launch quiet rate-limit unavailable')
    return { attempted: false, sent: 0, skipped: 0, reason: 'rate_limit_unavailable' }
  }
  const lastNotifiedAt = typeof notice.data?.notified_at === 'string' ? notice.data.notified_at : null
  if (!launchQuietRateOpen(lastNotifiedAt, now)) {
    return { attempted: false, sent: 0, skipped: 0, reason: 'rate_limited' }
  }

  const cityVenueIds = input.venues
    .filter((venue) => (venue.city ?? '').trim().toLowerCase() === city.city.toLowerCase())
    .map((venue) => venue.id)
  const followQuery = admin
    .from('follows')
    .select('follower_id, target_venue_id, surge_muted')
    .eq('target_kind', 'venue')
    .is('deleted_at', null)
  const follows = cityVenueIds.length > 0
    ? await followQuery.in('target_venue_id', cityVenueIds)
    : { data: [], error: null }
  if (follows.error) {
    console.info('[web-push] launch quiet audience unavailable', follows.error.message)
    return { attempted: false, sent: 0, skipped: 0, reason: 'rate_limit_unavailable' }
  }
  const visiblePulses = await withoutHiddenPulses(admin, input.pulses)
  const followedVenueIds = [...new Set(
    (follows.data ?? [])
      .map((row) => (typeof row.target_venue_id === 'string' ? row.target_venue_id : ''))
      .filter(Boolean),
  )]
  const plan = planLaunchQuietPush({
    venues: input.venues,
    pulses: visiblePulses,
    followedVenueIds,
    now,
    lastNotifiedAt,
  })
  if (!plan) {
    return { attempted: false, sent: 0, skipped: 0, reason: 'not_quiet' }
  }

  return sendPlan(admin, plan, now, env, follows.data ?? [])
}

async function sendPlan(
  admin: SupabaseClient,
  plan: LaunchQuietPushPlan,
  now: Date,
  env: WebPushEnv,
  follows: ReadonlyArray<{ follower_id?: string | null; target_venue_id?: string | null; surge_muted?: boolean | null }>,
): Promise<LaunchQuietPushResult> {
  const [{ data: mutes, error: muteError }, { data: subs }] = await Promise.all([
    admin.from('launch_quiet_mutes').select('user_id').eq('city_key', plan.cityKey),
    admin
      .from('push_tokens')
      .select('user_id, token, p256dh, auth, quiet_hours_start, quiet_hours_end')
      .eq('platform', 'web'),
  ])
  if (muteError && !missingTable(muteError)) {
    console.info('[web-push] launch quiet audience unavailable', muteError.message)
    return { attempted: false, sent: 0, skipped: 0, reason: 'rate_limit_unavailable' }
  }

  const cityMuted = new Set(
    (mutes ?? [])
      .map((row) => (typeof row.user_id === 'string' ? row.user_id : ''))
      .filter(Boolean),
  )
  const surgeMuted = new Set(
    (follows ?? [])
      .filter((row) => row.surge_muted === true && row.target_venue_id === plan.venueId && typeof row.follower_id === 'string')
      .map((row) => row.follower_id as string),
  )
  const followers = new Set(
    (follows ?? [])
      .map((row) => (typeof row.follower_id === 'string' ? row.follower_id : ''))
      .filter(Boolean),
  )
  const hour = seattleHour(now)
  const vapidPublic = env.VAPID_PUBLIC_KEY?.trim() ?? ''
  const vapidPrivate = env.VAPID_PRIVATE_KEY?.trim() ?? ''
  const vapid = {
    publicKey: vapidPublic,
    privateKey: vapidPrivate,
    subject: env.VAPID_SUBJECT?.trim() || 'mailto:ops@pulse.local',
  }
  const deliverable: Array<{ token: string; p256dh: string; auth: string }> = []
  let skipped = 0
  for (const row of subs ?? []) {
    const userId = typeof row.user_id === 'string' ? row.user_id : ''
    const send = shouldSendLaunchQuietPush({
      followsCity: followers.has(userId),
      muted: cityMuted.has(userId) || surgeMuted.has(userId),
      quietStart: row.quiet_hours_start,
      quietEnd: row.quiet_hours_end,
      hour,
    })
    if (!send || typeof row.token !== 'string' || typeof row.p256dh !== 'string' || typeof row.auth !== 'string') {
      skipped += 1
      continue
    }
    deliverable.push({ token: row.token, p256dh: row.p256dh, auth: row.auth })
  }
  if (deliverable.length === 0) {
    return { attempted: true, sent: 0, skipped, reason: 'ok' }
  }

  const claimed = await admin.from('launch_quiet_notices').upsert({
    city_key: plan.cityKey,
    notified_at: now.toISOString(),
    venue_id: plan.venueId,
  })
  if (claimed.error) {
    console.info('[web-push] launch quiet rate-limit unavailable', claimed.error.message)
    return { attempted: false, sent: 0, skipped, reason: 'rate_limit_unavailable' }
  }

  let sent = 0
  for (const row of deliverable) {
    const ok = await deliverWebPush(
      { endpoint: row.token, keys: { p256dh: row.p256dh, auth: row.auth } },
      plan.payload,
      vapid,
    )
    if (ok) sent += 1
    else skipped += 1
  }
  return { attempted: true, sent, skipped, reason: 'ok' }
}
