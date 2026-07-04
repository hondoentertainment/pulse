/**
 * POST /api/notifications/trending-venue
 *
 * Persist + push a trending-venue alert for the authenticated user.
 * Client calls when a nearby venue crosses the surge threshold.
 * Respects `profiles.notification_settings.trendingVenues`.
 */

import {
  handlePreflight,
  methodNotAllowed,
  ok,
  fail,
  type RequestLike,
  type ResponseLike,
} from '../_lib/http'
import { requireAuth } from '../_lib/auth'
import { consume } from '../_lib/rate-limit'
import { asString, isPlainObject } from '../_lib/validate'
import { createAdminClient, createUserClient } from '../_lib/supabase-server'
import { dispatchUserNotification } from '../_lib/dispatch-notification'
import { isTrendingVenuesEnabled } from '../_lib/notification-settings'

export default async function handler(
  req: RequestLike,
  res: ResponseLike,
): Promise<void> {
  if (handlePreflight(req, res)) return

  if (req.method !== 'POST') {
    methodNotAllowed(res, ['POST'])
    return
  }

  const auth = requireAuth(req)
  if (!auth.ok) {
    fail(res, auth.status, auth.code, auth.message)
    return
  }

  const rl = consume(auth.context.userId, 'trending_venue')
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(Math.ceil(rl.retryAfterMs / 1000)))
    fail(res, 429, 'rate_limited', 'Too many trending alerts', {
      retryAfterMs: rl.retryAfterMs,
      limit: rl.limit,
    })
    return
  }

  if (!isPlainObject(req.body)) {
    fail(res, 400, 'invalid_body', 'Request body must be a JSON object')
    return
  }

  const venueId = asString(req.body.venueId, 1, 128)
  if (!venueId) {
    fail(res, 400, 'invalid_input', 'venueId must be a non-empty string (max 128)')
    return
  }

  const scoreRaw = req.body.pulseScore
  const pulseScore =
    typeof scoreRaw === 'number' && Number.isFinite(scoreRaw) ? Math.round(scoreRaw) : undefined

  const userClient = createUserClient(auth.context.token)
  const { data: profile } = await userClient
    .from('profiles')
    .select('notification_settings')
    .eq('id', auth.context.userId)
    .maybeSingle()

  if (!isTrendingVenuesEnabled(profile?.notification_settings)) {
    ok(res, { skipped: true, reason: 'trendingVenues_disabled' })
    return
  }

  const admin = createAdminClient()
  if (!admin) {
    fail(res, 503, 'not_configured', 'Notification service unavailable')
    return
  }

  const { data: venue } = await admin.from('venues').select('name').eq('id', venueId).maybeSingle()
  const venueName = venue?.name ?? 'A venue near you'
  const title = `${venueName} is surging`
  const body =
    pulseScore != null
      ? `Energy hit ${pulseScore} — check it out before the crowd moves on`
      : 'A venue near you is popping off right now'

  const { error: insertErr } = await admin.from('notifications').insert({
    user_id: auth.context.userId,
    type: 'trending_venue',
    venue_id: venueId,
    read: false,
  })

  if (insertErr) {
    fail(res, 500, 'persist_failed', 'Failed to persist notification', {
      details: insertErr.message,
    })
    return
  }

  void dispatchUserNotification({
    userId: auth.context.userId,
    title,
    body,
    data: { kind: 'trending_venue', venueId },
  })

  res.setHeader('X-RateLimit-Limit', String(rl.limit))
  res.setHeader('X-RateLimit-Remaining', String(rl.remaining))
  ok(res, { notified: true, venueId })
}
