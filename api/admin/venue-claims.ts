/**
 * GET   /api/admin/venue-claims?status=pending — list claims for ops triage
 * PATCH /api/admin/venue-claims
 *
 * Admin-only verify / reject. Body: { claimId, status, notes? }
 */

import {
  fail,
  handlePreflight,
  methodNotAllowed,
  ok,
  type RequestLike,
  type ResponseLike,
} from '../_lib/http.js'
import { requireAuth, decodeJwt } from '../_lib/auth.js'
import { asEnum, asString, isPlainObject } from '../_lib/validate.js'
import { createUserClient } from '../_lib/supabase-server.js'

const DECISIONS = ['verified', 'rejected'] as const

function isAdminToken(token: string): boolean {
  const claims = decodeJwt(token) as
    | (Record<string, unknown> & { app_metadata?: { role?: string }; role?: string })
    | null
  const role =
    (claims?.app_metadata && typeof claims.app_metadata.role === 'string'
      ? claims.app_metadata.role
      : undefined) ?? (typeof claims?.role === 'string' ? claims.role : undefined)
  return role === 'admin'
}

export default async function handler(
  req: RequestLike,
  res: ResponseLike,
): Promise<void> {
  if (handlePreflight(req, res)) return
  if (req.method !== 'PATCH' && req.method !== 'GET') {
    methodNotAllowed(res, ['GET', 'PATCH'])
    return
  }

  const auth = requireAuth(req)
  if (!auth.ok) {
    fail(res, auth.status, auth.code, auth.message)
    return
  }
  if (!isAdminToken(auth.context.token)) {
    fail(res, 403, 'forbidden', 'Admin role required')
    return
  }

  const client = createUserClient(auth.context.token)

  if (req.method === 'GET') {
    const raw = req.query?.status
    const status = Array.isArray(raw) ? raw[0] : raw
    let query = client
      .from('venue_claims')
      .select('id, venue_id, user_id, status, evidence, notes, created_at, reviewed_at')
      .order('created_at', { ascending: false })
      .limit(100)
    if (status && status !== 'all') {
      query = query.eq('status', status)
    }
    const { data, error } = await query
    if (error) {
      fail(res, 500, 'claim_list_failed', error.message)
      return
    }
    ok(res, { claims: data ?? [] })
    return
  }

  if (!isPlainObject(req.body)) {
    fail(res, 400, 'invalid_body', 'Request body must be a JSON object')
    return
  }

  const claimId = asString(req.body.claimId, 1, 128)
  const status = asEnum(req.body.status, DECISIONS)
  if (!claimId || !status) {
    fail(res, 400, 'invalid_input', 'claimId and status (verified|rejected) are required')
    return
  }

  let notes: string | undefined
  if (req.body.notes !== undefined && req.body.notes !== null) {
    if (typeof req.body.notes !== 'string' || req.body.notes.length > 500) {
      fail(res, 400, 'invalid_input', 'notes must be a string up to 500 characters')
      return
    }
    notes = req.body.notes.trim()
  }

  const update: Record<string, unknown> = {
    status,
    reviewed_at: new Date().toISOString(),
  }
  if (notes !== undefined) update.notes = notes || null

  const { data, error } = await client
    .from('venue_claims')
    .update(update)
    .eq('id', claimId)
    .select('id, venue_id, user_id, status, evidence, notes, reviewed_at')
    .single()

  if (error) {
    fail(res, 500, 'claim_update_failed', error.message)
    return
  }

  ok(res, { claim: data })
}
