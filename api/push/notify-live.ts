/**
 * POST /api/push/notify-live
 * Fan out a live pulse to followed-venue / nearby Web Push subscribers.
 */

import {
  fail,
  handlePreflight,
  methodNotAllowed,
  ok,
  type RequestLike,
  type ResponseLike,
} from '../_lib/http.js'
import { requireAuth } from '../_lib/auth.js'
import { asString, isPlainObject } from '../_lib/validate.js'
import { notifyLivePulse } from '../_lib/web-push-live.js'

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

  if (!isPlainObject(req.body)) {
    fail(res, 400, 'invalid_body', 'Request body must be a JSON object')
    return
  }

  const venueId = asString(req.body.venueId, 1, 128)
  const venueName = asString(req.body.venueName, 1, 200)
  if (!venueId || !venueName) {
    fail(res, 400, 'invalid_input', 'venueId and venueName are required')
    return
  }

  const caption = typeof req.body.caption === 'string' ? req.body.caption : undefined
  const lat = typeof req.body.lat === 'number' ? req.body.lat : undefined
  const lng = typeof req.body.lng === 'number' ? req.body.lng : undefined

  const result = await notifyLivePulse({
    venueId,
    venueName,
    caption,
    authorUserId: auth.context.userId,
    venueLocation: lat !== undefined && lng !== undefined ? { lat, lng } : null,
  })

  ok(res, { notify: result })
}
