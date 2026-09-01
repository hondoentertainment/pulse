import { extractBearer, verifySupabaseJwt } from '../_lib/auth.js'
import { createUserClient } from '../_lib/supabase-server.js'
import { badRequest, handlePreflight, methodNotAllowed, ok, serverError, unauthorized, type RequestLike, type ResponseLike } from '../_lib/http.js'

export default async function handler(req: RequestLike, res: ResponseLike) {
  if (handlePreflight(req, res)) return
  if (req.method !== 'POST') {
    methodNotAllowed(res, ['POST', 'OPTIONS'])
    return
  }

  const auth = await verifySupabaseJwt(req)
  if (!auth.ok || !auth.user) {
    if (auth.error === 'Auth not configured on server') {
      ok(res, { registered: true, logOnly: true })
      return
    }
    unauthorized(res, auth.error ?? 'Unauthorized')
    return
  }

  const token = extractBearer(req)
  if (!token) {
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

  const client = createUserClient(token)
  const { error } = await client.from('signal_push_subscriptions').upsert({
    user_id: auth.user.id,
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
