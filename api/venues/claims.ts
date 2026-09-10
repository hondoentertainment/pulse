/**
 * GET  /api/venues/claims          — list the caller's claims (optional venueId)
 * POST /api/venues/claims          — submit or refresh a pending claim
 *
 * Server source of truth for venue inbox access. Status stays pending until
 * an admin verifies via /api/admin/venue-claims.
 */

import {
  handlePreflight,
  methodNotAllowed,
  ok,
  fail,
  type RequestLike,
  type ResponseLike,
} from '../_lib/http.js'
import { asString, isPlainObject } from '../_lib/validate.js'
import { requireAuth } from '../_lib/auth.js'
import { consume } from '../_lib/rate-limit.js'
import { createUserClient } from '../_lib/supabase-server.js'

const CLAIM_COLUMNS =
  'id, venue_id, user_id, status, evidence, notes, created_at, updated_at, reviewed_at'

export default async function handler(
  req: RequestLike,
  res: ResponseLike,
): Promise<void> {
  if (handlePreflight(req, res)) return

  const auth = requireAuth(req)
  if (!auth.ok) {
    fail(res, auth.status, auth.code, auth.message)
    return
  }

  const client = createUserClient(auth.context.token)

  if (req.method === 'GET') {
    const venueId = typeof req.query?.venueId === 'string' ? req.query.venueId : undefined
    let query = client
      .from('venue_claims')
      .select(CLAIM_COLUMNS)
      .eq('user_id', auth.context.userId)
      .order('created_at', { ascending: false })
    if (venueId) query = query.eq('venue_id', venueId)
    const { data, error } = await query
    if (error) {
      fail(res, 500, 'claim_list_failed', error.message)
      return
    }
    ok(res, { claims: data ?? [] })
    return
  }

  if (req.method !== 'POST') {
    methodNotAllowed(res, ['GET', 'POST'])
    return
  }

  const rl = consume(auth.context.userId, 'venue_claim')
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(Math.ceil(rl.retryAfterMs / 1000)))
    fail(res, 429, 'rate_limited', 'Too many claim submissions', {
      retryAfterMs: rl.retryAfterMs,
    })
    return
  }

  if (!isPlainObject(req.body)) {
    fail(res, 400, 'invalid_body', 'Request body must be a JSON object')
    return
  }

  const venueId = asString(req.body.venueId, 1, 128)
  if (!venueId) {
    fail(res, 400, 'invalid_input', 'venueId must be a non-empty string')
    return
  }

  const evidence = asString(req.body.evidence, 8, 1000)
  if (!evidence) {
    fail(res, 400, 'invalid_input', 'evidence must be 8–1000 characters')
    return
  }

  let notes: string | null = null
  if (req.body.notes !== undefined && req.body.notes !== null) {
    if (typeof req.body.notes !== 'string' || req.body.notes.length > 500) {
      fail(res, 400, 'invalid_input', 'notes must be a string up to 500 characters')
      return
    }
    notes = req.body.notes.trim() || null
  }

  const { data, error } = await client
    .from('venue_claims')
    .upsert(
      {
        venue_id: venueId,
        user_id: auth.context.userId,
        status: 'pending',
        evidence,
        notes,
        reviewed_at: null,
      },
      { onConflict: 'venue_id,user_id' },
    )
    .select(CLAIM_COLUMNS)
    .single()

  if (error) {
    fail(res, 500, 'claim_persist_failed', 'Failed to persist venue claim', {
      details: error.message,
    })
    return
  }

  ok(res, { claim: data }, 201)
}
