/**
 * PATCH /api/notifications/read
 *
 * Mark one or all notifications read for the authenticated user.
 * Body: `{ id?: string, all?: boolean }` — provide `id` or `all: true`.
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
import { asString, isPlainObject } from '../_lib/validate'
import { createUserClient } from '../_lib/supabase-server'

export default async function handler(req: RequestLike, res: ResponseLike): Promise<void> {
  if (handlePreflight(req, res)) return

  if (req.method !== 'PATCH') {
    methodNotAllowed(res, ['PATCH'])
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

  const markAll = req.body.all === true
  const id = typeof req.body.id === 'string' ? asString(req.body.id, 1, 128) : null

  if (!markAll && !id) {
    fail(res, 400, 'invalid_input', 'Provide `id` or `all: true`')
    return
  }

  const client = createUserClient(auth.context.token)
  const query = client.from('notifications').update({ read: true }).eq('user_id', auth.context.userId)

  const { error } = markAll
    ? await query.eq('read', false)
    : await query.eq('id', id!)

  if (error) {
    fail(res, 500, 'notifications_read_failed', error.message)
    return
  }

  ok(res, { updated: true, all: markAll, id: id ?? undefined })
}
