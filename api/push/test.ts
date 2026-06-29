/**
 * POST /api/push/test
 *
 * Send a test push to verify FCM/APNs + Realtime wiring on a real device.
 *
 * Auth:
 *   - Any authenticated user may send a test to **themselves** (default).
 *   - Admins (`SUPABASE_ADMIN_EMAILS`) may target any `userId` in the body.
 *
 * Body (all optional):
 *   { userId?: string, title?: string, body?: string }
 */

import {
  handlePreflight,
  methodNotAllowed,
  ok,
  fail,
  forbidden,
  type RequestLike,
  type ResponseLike,
} from '../_lib/http'
import { verifySupabaseJwt } from '../_lib/auth'
import { consume } from '../_lib/rate-limit'
import { dispatchUserNotification } from '../_lib/dispatch-notification'

export default async function handler(req: RequestLike, res: ResponseLike): Promise<void> {
  if (handlePreflight(req, res)) return
  if (req.method !== 'POST') {
    methodNotAllowed(res, ['POST', 'OPTIONS'])
    return
  }

  const auth = await verifySupabaseJwt(req)
  if (!auth.ok || !auth.user) {
    fail(res, 401, 'unauthenticated', auth.error ?? 'Authentication required')
    return
  }

  const limit = consume(`push-test:${auth.user.id}`, 'push_test')
  if (!limit.allowed) {
    fail(res, 429, 'rate_limited', 'Test push is rate-limited. Try again later.')
    return
  }

  const body = (req.body ?? {}) as { userId?: string; title?: string; body?: string }
  const targetUserId = typeof body.userId === 'string' ? body.userId.trim() : auth.user.id

  if (targetUserId !== auth.user.id && !auth.user.isAdmin) {
    forbidden(res, 'Only admins may send test pushes to other users')
    return
  }

  const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : 'Pulse test'
  const message =
    typeof body.body === 'string' && body.body.trim()
      ? body.body.trim()
      : 'Push delivery is working.'

  const result = await dispatchUserNotification({
    userId: targetUserId,
    title,
    body: message,
    data: { kind: 'test' },
  })

  ok(res, {
    targetUserId,
    realtime: result.realtime,
    native: result.native,
  })
}
