/**
 * POST /api/pulses/report — persist a hide/report (3/hour).
 * GET  /api/pulses/report — list the caller's reports.
 * GET  /api/pulses/report?scope=all — admin triage list.
 * GET  /api/pulses/report?venueId= — verified owner / staff / admin venue reports.
 * PATCH /api/pulses/report — admin or verified owner status update { reportId|pulseId, status }.
 */

import {
  handlePreflight,
  methodNotAllowed,
  ok,
  fail,
  type RequestLike,
  type ResponseLike,
} from '../_lib/http.js'
import { requireAuth, decodeJwt } from '../_lib/auth.js'
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
const REPORT_STATUSES = ['pending', 'reviewed', 'actioned', 'dismissed'] as const

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
  if (req.method !== 'POST' && req.method !== 'GET' && req.method !== 'PATCH') {
    methodNotAllowed(res, ['GET', 'POST', 'PATCH'])
    return
  }

  const auth = requireAuth(req)
  if (!auth.ok) {
    fail(res, auth.status, auth.code, auth.message)
    return
  }

  const client = createUserClient(auth.context.token)
  const admin = isAdminToken(auth.context.token)

  if (req.method === 'GET') {
    const venueId = typeof req.query?.venueId === 'string' ? req.query.venueId.trim() : ''
    if (venueId) {
      if (!admin) {
        const [{ data: claim }, { data: staff }] = await Promise.all([
          client
            .from('venue_claims')
            .select('id')
            .eq('venue_id', venueId)
            .eq('user_id', auth.context.userId)
            .eq('status', 'verified')
            .maybeSingle(),
          client
            .from('venue_staff')
            .select('user_id')
            .eq('venue_id', venueId)
            .eq('user_id', auth.context.userId)
            .maybeSingle(),
        ])
        if (!claim && !staff) {
          fail(res, 403, 'forbidden', 'Verified owner or admin required')
          return
        }
      }
      const { data: pulses, error: pulseError } = await client
        .from('pulses')
        .select('id')
        .eq('venue_id', venueId)
        .limit(100)
      if (pulseError) {
        fail(res, 500, 'report_list_failed', pulseError.message)
        return
      }
      const pulseIds = (pulses ?? [])
        .map((row) => (typeof row.id === 'string' ? row.id : null))
        .filter((id): id is string => Boolean(id))
      if (pulseIds.length === 0) {
        ok(res, { reports: [] })
        return
      }
      const { data, error } = await client
        .from('pulse_reports')
        .select('id, pulse_id, reporter_id, reason, details, created_at, status, reviewed_at')
        .in('pulse_id', pulseIds)
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) {
        fail(res, 500, 'report_list_failed', error.message)
        return
      }
      ok(res, { reports: data ?? [] })
      return
    }
    const scope = typeof req.query?.scope === 'string' ? req.query.scope : 'mine'
    let query = client
      .from('pulse_reports')
      .select('id, pulse_id, reporter_id, reason, details, created_at, status, reviewed_at')
      .order('created_at', { ascending: false })
      .limit(100)
    if (scope === 'all') {
      if (!admin) {
        fail(res, 403, 'forbidden', 'Admin role required to list all reports')
        return
      }
    } else {
      query = query.eq('reporter_id', auth.context.userId)
    }
    const { data, error } = await query
    if (error) {
      fail(res, 500, 'report_list_failed', error.message)
      return
    }
    ok(res, { reports: data ?? [] })
    return
  }

  if (req.method === 'PATCH') {
    if (!isPlainObject(req.body)) {
      fail(res, 400, 'invalid_body', 'Request body must be a JSON object')
      return
    }
    const status = asEnum(req.body.status, REPORT_STATUSES)
    const reportId = asString(req.body.reportId, 1, 128)
    const pulseId = asString(req.body.pulseId, 1, 128)
    if (!status || (!reportId && !pulseId)) {
      fail(res, 400, 'invalid_input', 'status and reportId or pulseId are required')
      return
    }

    if (!admin) {
      const targetPulseId = pulseId ?? await (async () => {
        if (!reportId) return null
        const { data } = await client
          .from('pulse_reports')
          .select('pulse_id')
          .eq('id', reportId)
          .maybeSingle()
        return typeof data?.pulse_id === 'string' ? data.pulse_id : null
      })()
      if (!targetPulseId) {
        fail(res, 403, 'forbidden', 'Verified owner or admin required')
        return
      }
      const { data: pulse } = await client
        .from('pulses')
        .select('venue_id')
        .eq('id', targetPulseId)
        .maybeSingle()
      const venueId = typeof pulse?.venue_id === 'string' ? pulse.venue_id : null
      if (!venueId) {
        fail(res, 403, 'forbidden', 'Verified owner or admin required')
        return
      }
      const [{ data: claim }, { data: staff }] = await Promise.all([
        client
          .from('venue_claims')
          .select('id')
          .eq('venue_id', venueId)
          .eq('user_id', auth.context.userId)
          .eq('status', 'verified')
          .maybeSingle(),
        client
          .from('venue_staff')
          .select('user_id')
          .eq('venue_id', venueId)
          .eq('user_id', auth.context.userId)
          .maybeSingle(),
      ])
      if (!claim && !staff) {
        fail(res, 403, 'forbidden', 'Verified claim required to dismiss reports')
        return
      }
    }

    const reviewedAt = new Date().toISOString()
    if (pulseId && !reportId) {
      const { data, error } = await client
        .from('pulse_reports')
        .update({ status, reviewed_at: reviewedAt })
        .eq('pulse_id', pulseId)
        .select('id, pulse_id, status, reviewed_at')
      if (error) {
        fail(res, 500, 'report_update_failed', error.message)
        return
      }
      ok(res, { reports: data ?? [] })
      return
    }

    const { data, error } = await client
      .from('pulse_reports')
      .update({
        status,
        reviewed_at: reviewedAt,
      })
      .eq('id', reportId)
      .select('id, pulse_id, status, reviewed_at')
      .single()
    if (error) {
      fail(res, 500, 'report_update_failed', error.message)
      return
    }
    ok(res, { report: data })
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
        status: 'pending',
      })
      .select('id, pulse_id, reason, status, created_at')
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
