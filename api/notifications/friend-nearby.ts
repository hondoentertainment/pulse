/**
 * POST /api/notifications/friend-nearby
 *
 * Notify friends that the authenticated user checked in at a venue.
 * Respects `friendNearbyVenues` notification pref.
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
import { notifyFriendsOfCheckIn } from '../_lib/friend-nearby-notify'

export default async function handler(req: RequestLike, res: ResponseLike): Promise<void> {
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

  const rl = consume(auth.context.userId, 'default_write')
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(Math.ceil(rl.retryAfterMs / 1000)))
    fail(res, 429, 'rate_limited', 'Too many friend-nearby alerts')
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

  const result = await notifyFriendsOfCheckIn({
    userId: auth.context.userId,
    venueId,
  })

  ok(res, result)
}
