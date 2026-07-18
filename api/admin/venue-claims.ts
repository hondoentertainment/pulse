/**
 * GET  /api/admin/venue-claims — list pending/all claims
 * PATCH /api/admin/venue-claims — verify or reject { claimId, status, rejectedReason? }
 */

import {
  fail,
  handlePreflight,
  methodNotAllowed,
  ok,
  type RequestLike,
  type ResponseLike,
} from '../_lib/http'
import { requireAuth, decodeJwt } from '../_lib/auth'
import { asEnum, asString, isPlainObject } from '../_lib/validate'
import { createUserClient, getSupabaseConfig } from '../_lib/supabase-server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

function buildClient(userJwt: string): SupabaseClient {
  const serviceKey =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((globalThis as any).process?.env?.SUPABASE_SERVICE_ROLE_KEY as string | undefined) ??
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((globalThis as any).process?.env?.SUPABASE_SERVICE_KEY as string | undefined)
  if (serviceKey) {
    const { url } = getSupabaseConfig()
    return createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
  }
  return createUserClient(userJwt)
}

function requireAdmin(req: RequestLike, res: ResponseLike): string | null {
  const auth = requireAuth(req)
  if (!auth.ok) {
    fail(res, auth.status, auth.code, auth.message)
    return null
  }
  const claims = decodeJwt(auth.context.token) as
    | (Record<string, unknown> & { app_metadata?: { role?: string }; role?: string })
    | null
  const role =
    (claims?.app_metadata && typeof claims.app_metadata.role === 'string'
      ? claims.app_metadata.role
      : undefined) ?? (typeof claims?.role === 'string' ? claims.role : undefined)
  if (role !== 'admin') {
    fail(res, 403, 'forbidden', 'Admin role required')
    return null
  }
  return auth.context.token
}

function mapClaim(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    venueId: String(row.venue_id),
    claimantUserId: String(row.claimant_user_id),
    businessName: String(row.business_name),
    businessEmail: String(row.business_email),
    status: String(row.status),
    createdAt: String(row.created_at),
    verifiedAt: row.verified_at ? String(row.verified_at) : undefined,
    rejectedReason: row.rejected_reason ? String(row.rejected_reason) : undefined,
  }
}

export default async function handler(req: RequestLike, res: ResponseLike): Promise<void> {
  if (handlePreflight(req, res)) return

  const token = requireAdmin(req, res)
  if (!token) return

  const client = buildClient(token)

  if (req.method === 'GET') {
    const status = typeof req.query?.status === 'string' ? req.query.status : undefined
    let query = client.from('venue_claims').select('*').order('created_at', { ascending: false }).limit(200)
    if (status) query = query.eq('status', status)
    const { data, error } = await query
    if (error) {
      fail(res, 500, 'db_error', error.message)
      return
    }
    ok(res, { claims: (data ?? []).map((row) => mapClaim(row as Record<string, unknown>)) })
    return
  }

  if (req.method !== 'PATCH') {
    methodNotAllowed(res, ['GET', 'PATCH'])
    return
  }

  if (!isPlainObject(req.body)) {
    fail(res, 400, 'invalid_body', 'JSON body required')
    return
  }

  const claimId = asString(req.body.claimId, 1, 64)
  const status = asEnum(req.body.status, ['verified', 'rejected', 'pending'] as const)
  const rejectedReason = asString(req.body.rejectedReason, 0, 500)

  if (!claimId || !status) {
    fail(res, 400, 'invalid_body', 'claimId and status are required')
    return
  }

  const patch: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
    verified_at: status === 'verified' ? new Date().toISOString() : null,
    rejected_reason: status === 'rejected' ? rejectedReason || 'Rejected by admin' : null,
  }

  const { data, error } = await client
    .from('venue_claims')
    .update(patch)
    .eq('id', claimId)
    .select('*')
    .single()

  if (error) {
    fail(res, 500, 'db_error', error.message)
    return
  }

  ok(res, { claim: mapClaim(data as Record<string, unknown>) })
}
