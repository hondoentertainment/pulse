/**
 * GET /api/account/export
 *
 * Returns a JSON bundle of the caller's personal data (GDPR/CCPA export).
 * Authorization: Bearer JWT — RLS scopes every table read.
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
import { createUserClient } from '../_lib/supabase-server'
import { exportUserData } from '../_lib/account-lifecycle'

export default async function handler(req: RequestLike, res: ResponseLike): Promise<void> {
  if (handlePreflight(req, res)) return
  if (req.method !== 'GET') {
    methodNotAllowed(res, ['GET', 'OPTIONS'])
    return
  }

  const auth = await verifySupabaseJwt(req)
  if (!auth.ok || !auth.user) {
    fail(res, 401, 'unauthenticated', auth.error ?? 'Authentication required')
    return
  }

  const limit = consume(`export:${auth.user.id}`, 'account_export')
  if (!limit.allowed) {
    fail(res, 429, 'rate_limited', 'Too many export requests. Try again later.')
    return
  }

  const token = extractBearer(req)
  if (!token) {
    fail(res, 401, 'unauthenticated', 'Missing bearer token')
    return
  }

  const client = createUserClient(token)
  const payload = await exportUserData(client, auth.user.id)
  ok(res, payload)
}
