/**
 * POST /api/signal/account-delete
 * Deletes the caller's Signal rows. Auth user deletion is best-effort when
 * the service role is configured.
 */
import { extractBearer, verifySupabaseJwt } from '../_lib/auth.js'
import { createAdminClient, createUserClient } from '../_lib/supabase-server.js'
import { badRequest, handlePreflight, methodNotAllowed, ok, serverError, unauthorized, type RequestLike, type ResponseLike } from '../_lib/http.js'

const CONFIRM = 'DELETE'

export default async function handler(req: RequestLike, res: ResponseLike) {
  if (handlePreflight(req, res)) return
  if (req.method !== 'POST') {
    methodNotAllowed(res, ['POST', 'OPTIONS'])
    return
  }

  const body = (req.body ?? {}) as { confirm?: string }
  if (body.confirm !== CONFIRM) {
    badRequest(res, 'Type DELETE to confirm account deletion')
    return
  }

  const auth = await verifySupabaseJwt(req)
  if (!auth.ok || !auth.user) {
    if (auth.error === 'Auth not configured on server') {
      ok(res, { deleted: true, authDeleted: false, logOnly: true })
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

  const client = createUserClient(token)
  const [entries, profile, push] = await Promise.all([
    client.from('signal_entries').delete().eq('user_id', auth.user.id),
    client.from('signal_profiles').delete().eq('user_id', auth.user.id),
    client.from('signal_push_subscriptions').delete().eq('user_id', auth.user.id),
  ])

  const rowError = entries.error || profile.error || push.error
  if (rowError) {
    serverError(res, rowError.message)
    return
  }

  let authDeleted = false
  const admin = createAdminClient()
  if (admin) {
    const { error } = await admin.auth.admin.deleteUser(auth.user.id)
    authDeleted = !error
  }

  ok(res, { deleted: true, authDeleted })
}
