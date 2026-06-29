/**
 * POST /api/account/delete
 *
 * Permanently deletes the authenticated user's account.
 * Body: { "confirm": "DELETE" }
 *
 * Soft-deletes the profile, then removes auth.users via service role (cascades).
 */

import {
  handlePreflight,
  methodNotAllowed,
  ok,
  fail,
  type RequestLike,
  type ResponseLike,
} from '../_lib/http'
import { verifySupabaseJwt, extractBearer } from '../_lib/auth'
import { consume } from '../_lib/rate-limit'
import { createAdminClient, createUserClient } from '../_lib/supabase-server'
import {
  deleteAuthUser,
  softDeleteProfile,
  validateDeleteConfirmation,
} from '../_lib/account-lifecycle'

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

  const limit = consume(`delete:${auth.user.id}`, 'account_delete')
  if (!limit.allowed) {
    fail(res, 429, 'rate_limited', 'Account deletion is rate-limited. Try again later.')
    return
  }

  if (!validateDeleteConfirmation(req.body)) {
    fail(res, 400, 'invalid_confirmation', 'Send { "confirm": "DELETE" } to proceed.')
    return
  }

  const token = extractBearer(req)
  if (!token) {
    fail(res, 401, 'unauthenticated', 'Missing bearer token')
    return
  }

  const userClient = createUserClient(token)
  const soft = await softDeleteProfile(userClient, auth.user.id)
  if (!soft.ok) {
    fail(res, 500, 'profile_delete_failed', soft.error)
    return
  }

  const admin = createAdminClient()
  if (!admin) {
    fail(
      res,
      503,
      'deletion_unavailable',
      'Account deletion requires server configuration (SUPABASE_SERVICE_ROLE_KEY).',
    )
    return
  }

  const removed = await deleteAuthUser(admin, auth.user.id)
  if (!removed.ok) {
    fail(res, 500, 'auth_delete_failed', removed.error)
    return
  }

  ok(res, { deleted: true, userId: auth.user.id })
}
