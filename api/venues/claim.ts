/**
 * Venue claims API
 *
 * GET  /api/venues/claim — list claims for the authenticated user
 * POST /api/venues/claim — create or refresh a claim (pending until admin verifies)
 *
 * Body (POST): { venueId, businessName, businessEmail, verificationMethod? }
 */

import {
  fail,
  handlePreflight,
  methodNotAllowed,
  ok,
  type RequestLike,
  type ResponseLike,
} from '../_lib/http'
import { requireAuth } from '../_lib/auth'
import { asEnum, asString, isPlainObject } from '../_lib/validate'
import { checkRateLimit } from '../_lib/rate-limit'
import { createUserClient } from '../_lib/supabase-server'

const METHODS = ['email', 'phone', 'document'] as const

function mapClaim(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    venueId: String(row.venue_id),
    claimantUserId: String(row.claimant_user_id),
    businessName: String(row.business_name),
    businessEmail: String(row.business_email),
    verificationMethod: String(row.verification_method ?? 'email') as
      | 'email'
      | 'phone'
      | 'document',
    status: String(row.status) as 'pending' | 'verified' | 'rejected',
    createdAt: String(row.created_at),
    verifiedAt: row.verified_at ? String(row.verified_at) : undefined,
    rejectedReason: row.rejected_reason ? String(row.rejected_reason) : undefined,
  }
}

export default async function handler(req: RequestLike, res: ResponseLike): Promise<void> {
  if (handlePreflight(req, res)) return

  if (req.method === 'GET') {
    const auth = requireAuth(req)
    if (!auth.ok) {
      fail(res, auth.status, auth.code, auth.message)
      return
    }
    try {
      const client = createUserClient(auth.context.token)
      const { data, error } = await client
        .from('venue_claims')
        .select('*')
        .eq('claimant_user_id', auth.context.userId)
        .order('created_at', { ascending: false })
      if (error) {
        fail(res, 500, 'db_error', error.message)
        return
      }
      ok(res, { claims: (data ?? []).map((row) => mapClaim(row as Record<string, unknown>)) })
    } catch (err) {
      fail(res, 500, 'server_error', err instanceof Error ? err.message : 'Unknown error')
    }
    return
  }

  if (req.method !== 'POST') {
    methodNotAllowed(res, ['GET', 'POST'])
    return
  }

  const auth = requireAuth(req)
  if (!auth.ok) {
    fail(res, auth.status, auth.code, auth.message)
    return
  }

  const rl = checkRateLimit(`venue-claim:${auth.context.userId}`, {
    maxTokens: 10,
    refillRatePerSec: 10 / (60 * 60),
  })
  if (!rl.allowed) {
    fail(res, 429, 'rate_limited', 'Too many claim attempts. Try again later.')
    return
  }

  if (!isPlainObject(req.body)) {
    fail(res, 400, 'invalid_body', 'JSON body required')
    return
  }

  const venueId = asString(req.body.venueId, 1, 128)
  const businessName = asString(req.body.businessName, 1, 200)
  const businessEmail = asString(req.body.businessEmail, 3, 254)
  const verificationMethod =
    asEnum(req.body.verificationMethod, METHODS) ?? 'email'

  if (!venueId || !businessName || !businessEmail) {
    fail(res, 400, 'invalid_body', 'venueId, businessName, and businessEmail are required')
    return
  }

  if (!businessEmail.includes('@')) {
    fail(res, 400, 'invalid_email', 'businessEmail must be a valid email')
    return
  }

  try {
    const client = createUserClient(auth.context.token)

    const { data: venue, error: venueErr } = await client
      .from('venues')
      .select('id')
      .eq('id', venueId)
      .is('deleted_at', null)
      .maybeSingle()

    if (venueErr) {
      fail(res, 500, 'db_error', venueErr.message)
      return
    }
    if (!venue) {
      fail(res, 404, 'venue_not_found', 'Venue not found')
      return
    }

    const { data: existing } = await client
      .from('venue_claims')
      .select('*')
      .eq('venue_id', venueId)
      .eq('claimant_user_id', auth.context.userId)
      .maybeSingle()

    if (existing && String(existing.status) === 'verified') {
      ok(res, { claim: mapClaim(existing as Record<string, unknown>) })
      return
    }

    const payload = {
      venue_id: venueId,
      claimant_user_id: auth.context.userId,
      business_name: businessName,
      business_email: businessEmail,
      verification_method: verificationMethod,
      status: 'pending',
      updated_at: new Date().toISOString(),
    }

    const { data, error } = existing
      ? await client
          .from('venue_claims')
          .update(payload)
          .eq('id', existing.id)
          .select('*')
          .single()
      : await client.from('venue_claims').insert(payload).select('*').single()

    if (error) {
      fail(res, 500, 'db_error', error.message)
      return
    }

    ok(res, { claim: mapClaim(data as Record<string, unknown>) }, existing ? 200 : 201)
  } catch (err) {
    fail(res, 500, 'server_error', err instanceof Error ? err.message : 'Unknown error')
  }
}
