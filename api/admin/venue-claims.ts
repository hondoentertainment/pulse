/**
 * GET   /api/admin/venue-claims?status=pending — list claims for ops triage.
 *       Venue name, neighborhood, status, and submitted time only.
 * PATCH /api/admin/venue-claims
 *
 * Admin-only verify / reject. Body: { claimId, status, notes? }.
 * Notes may be stored for the SQL editor. They are not returned.
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

const OPS_CLAIM_LIST_SELECT =
  'id, venue_id, status, created_at, venues(name, neighborhood)'
const OPS_CLAIM_DECISION_SELECT = 'id, venue_id, status, reviewed_at'
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

function venueLabel(value: unknown): { name: string | null; neighborhood: string | null } {
  const row = Array.isArray(value) ? value[0] : value
  if (!row || typeof row !== 'object') return { name: null, neighborhood: null }
  const record = row as { name?: unknown; neighborhood?: unknown }
  return {
    name: typeof record.name === 'string' ? record.name : null,
    neighborhood: typeof record.neighborhood === 'string' ? record.neighborhood : null,
  }
}

/** Ops queue row. Evidence, notes, user id, and work email stay in SQL. */
function publicClaim(row: {
  id?: unknown
  venue_id?: unknown
  status?: unknown
  created_at?: unknown
  venues?: unknown
}) {
  const venue = venueLabel(row.venues)
  return {
    id: row.id,
    venue_id: row.venue_id,
    status: row.status,
    created_at: row.created_at,
    venue_name: venue.name,
    neighborhood: venue.neighborhood,
  }
}

function publicDecision(row: {
  id?: unknown
  venue_id?: unknown
  status?: unknown
  reviewed_at?: unknown
} | null) {
  if (!row) return row
  return {
    id: row.id,
    venue_id: row.venue_id,
    status: row.status,
    reviewed_at: row.reviewed_at ?? null,
  }
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
      .select(OPS_CLAIM_LIST_SELECT)
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
    const claims = (data ?? []).map((row) => publicClaim(row))
    ok(res, { claims })
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
    .select(OPS_CLAIM_DECISION_SELECT)
    .single()

  if (error) {
    fail(res, 500, 'claim_update_failed', error.message)
    return
  }

  ok(res, { claim: publicDecision(data) })
}
