/**
 * POST /api/push/notify-im-here
 * Glasses-glance Web Push after the signed-in user confirms I’m here.
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
import { notifyImHere } from '../_lib/web-push-im-here.js'

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
  const venueName = asString(req.body.venueName, 1, 120)
  if (!venueId || !venueName) {
    fail(res, 400, 'invalid_input', 'venueId and venueName are required')
    return
  }

  const result = await notifyImHere({
    userId: auth.context.userId,
    venueId,
    venueName,
  })

  ok(res, { notify: result })
}
