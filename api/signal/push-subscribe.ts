import { getAuthenticatedUserId } from '../_lib/auth'
import { createAdminClient } from '../_lib/supabase-server'
import { badRequest, handlePreflight, methodNotAllowed, ok, serverError, unauthorized, type RequestLike, type ResponseLike } from '../_lib/http'

export default async function handler(req: RequestLike, res: ResponseLike) {
  if (handlePreflight(req, res)) return
  if (req.method !== 'POST') {
    methodNotAllowed(res, ['POST', 'OPTIONS'])
    return
  }

  const userId = getAuthenticatedUserId(req)
  if (!userId) {
    unauthorized(res)
    return
  }

  const body = (req.body ?? {}) as {
    endpoint?: string
    keys?: { p256dh?: string; auth?: string }
    userAgent?: string
  }

  if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
    badRequest(res, 'Invalid push subscription')
    return
  }

  const admin = createAdminClient()
  if (!admin) {
    ok(res, { registered: true, logOnly: true })
    return
  }

  const { error } = await admin.from('signal_push_subscriptions').upsert({
    user_id: userId,
    endpoint: body.endpoint,
    p256dh: body.keys.p256dh,
    auth: body.keys.auth,
    user_agent: body.userAgent ?? null,
    last_seen_at: new Date().toISOString(),
  }, { onConflict: 'endpoint' })

  if (error) {
    serverError(res, error.message)
    return
  }

  ok(res, { registered: true })
}
