/**
 * POST /api/pulses/report
 *
 * Persists a hide/report against a pulse (live review). Auth required.
 * Rate-limited to 3 reports/hour/user. The reporter can SELECT their own
 * rows via RLS; this is the MVP stub that actually persists.
 */

import {
  handlePreflight,
  methodNotAllowed,
  ok,
  fail,
  type RequestLike,
  type ResponseLike,
} from '../_lib/http.js'
import { requireAuth } from '../_lib/auth.js'
import { consume } from '../_lib/rate-limit.js'
import { asString, asEnum, isPlainObject } from '../_lib/validate.js'
import { createUserClient } from '../_lib/supabase-server.js'

const REPORT_REASONS = [
  'spam',
  'inappropriate',
  'harassment',
  'misinformation',
  'fake_location',
  'other',
] as const

type ReportReason = (typeof REPORT_REASONS)[number]

export default async function handler(
  req: RequestLike,
  res: ResponseLike,
): Promise<void> {
  if (handlePreflight(req, res)) return
  if (req.method !== 'POST') {
    methodNotAllowed(res, ['POST'])
    return
  }

  const auth = requireAuth(req)
  if (!auth.ok) {
    fail(res, auth.status, auth.code, auth.message)
    return
  }

  const rl = consume(auth.context.userId, 'pulse_report')
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(Math.ceil(rl.retryAfterMs / 1000)))
    fail(res, 429, 'rate_limited', 'Too many reports', {
      retryAfterMs: rl.retryAfterMs,
      limit: rl.limit,
    })
    return
  }

  if (!isPlainObject(req.body)) {
    fail(res, 400, 'invalid_body', 'Request body must be a JSON object')
    return
  }

  const pulseId = asString(req.body.pulseId, 1, 128)
  if (!pulseId) {
    fail(res, 400, 'invalid_input', 'pulseId must be a non-empty string')
    return
  }

  const reason = asEnum(req.body.reason, REPORT_REASONS) as ReportReason | null
  if (!reason) {
    fail(res, 400, 'invalid_input', `reason must be one of: ${REPORT_REASONS.join(', ')}`)
    return
  }

  let details: string | null = null
  if (req.body.details !== undefined && req.body.details !== null) {
    if (typeof req.body.details !== 'string' || req.body.details.length > 500) {
      fail(res, 400, 'invalid_input', 'details must be a string up to 500 characters')
      return
    }
    details = req.body.details.trim() || null
  }

  try {
    const client = createUserClient(auth.context.token)
    const { data, error } = await client
      .from('pulse_reports')
      .insert({
        reporter_id: auth.context.userId,
        pulse_id: pulseId,
        reason,
        details,
      })
      .select('id, pulse_id, reason, created_at')
      .single()

    if (error) {
      if (error.code === '23505') {
        fail(res, 409, 'already_reported', 'You already reported this review')
        return
      }
      fail(res, 500, 'persist_failed', 'Failed to persist report', {
        details: error.message,
      })
      return
    }

    res.setHeader('X-RateLimit-Limit', String(rl.limit))
    res.setHeader('X-RateLimit-Remaining', String(rl.remaining))
    ok(res, { report: data }, 201)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error'
    fail(res, 500, 'persist_exception', 'Report insert threw', { details: message })
  }
}
