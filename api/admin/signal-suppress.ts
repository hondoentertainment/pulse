/**
 * POST /api/admin/signal-suppress  (admin-only)
 *
 * Body: { venue_id: string, suppressed: boolean, reason?: string | null }
 *
 * Toggles admin signal suppression on a venue. Suppressed venues are hidden
 * from Tonight, map intel badges, and organic recommendations.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@supabase/supabase-js'

import {
  fail,
  handlePreflight,
  methodNotAllowed,
  ok,
  type RequestLike,
  type ResponseLike,
} from '../_lib/http'
import { requireAuth, decodeJwt } from '../_lib/auth'
import { asString, isPlainObject } from '../_lib/validate'
import { createUserClient, getSupabaseConfig } from '../_lib/supabase-server'

const REASON_MAX = 240

interface SignalSuppressBody {
  venue_id: string
  suppressed: boolean
  reason?: string | null
}

interface ValidationOk {
  ok: true
  value: SignalSuppressBody
}
interface ValidationErr {
  ok: false
  errors: string[]
}

export function validateBody(body: unknown): ValidationOk | ValidationErr {
  if (!isPlainObject(body)) return { ok: false, errors: ['body must be a JSON object'] }

  const errors: string[] = []
  const venueId = asString(body.venue_id, 1, 128)
  if (!venueId) errors.push('venue_id is required')

  if (typeof body.suppressed !== 'boolean') {
    errors.push('suppressed must be a boolean')
  }

  const value: SignalSuppressBody = {
    venue_id: venueId ?? '',
    suppressed: body.suppressed === true,
  }

  if (body.reason !== undefined) {
    if (body.reason === null) {
      value.reason = null
    } else {
      const reason = asString(body.reason, 0, REASON_MAX)
      if (reason === null) errors.push(`reason must be a string up to ${REASON_MAX} characters`)
      else value.reason = reason.trim() === '' ? null : reason.trim()
    }
  }

  if (errors.length > 0) return { ok: false, errors }
  return { ok: true, value }
}

export function buildUpdateRow(
  body: SignalSuppressBody,
  reviewerId: string,
): Record<string, unknown> {
  if (body.suppressed) {
    return {
      signal_suppressed: true,
      signal_suppressed_reason: body.reason ?? null,
      signal_suppressed_at: new Date().toISOString(),
      signal_suppressed_by: reviewerId,
    }
  }
  return {
    signal_suppressed: false,
    signal_suppressed_reason: null,
    signal_suppressed_at: null,
    signal_suppressed_by: null,
  }
}

export function buildSupabaseClient(userJwt: string): SupabaseClient {
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

export default async function handler(req: RequestLike, res: ResponseLike): Promise<void> {
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

  const claims = decodeJwt(auth.context.token) as
    | (Record<string, unknown> & { app_metadata?: { role?: string }; role?: string; sub?: string })
    | null
  const role =
    (claims?.app_metadata && typeof claims.app_metadata.role === 'string'
      ? claims.app_metadata.role
      : undefined) ?? (typeof claims?.role === 'string' ? claims.role : undefined)
  if (role !== 'admin') {
    fail(res, 403, 'forbidden', 'Admin role required')
    return
  }

  const validated = validateBody(req.body)
  if (!validated.ok) {
    fail(res, 400, 'invalid_input', validated.errors.join('; '))
    return
  }

  const reviewerId = typeof claims?.sub === 'string' ? claims.sub : auth.context.userId

  try {
    const client = buildSupabaseClient(auth.context.token)
    const { data, error } = await client
      .from('venues')
      .update(buildUpdateRow(validated.value, reviewerId))
      .eq('id', validated.value.venue_id)
      .select(
        'id, name, signal_suppressed, signal_suppressed_reason, signal_suppressed_at, signal_suppressed_by',
      )
      .single()

    if (error) {
      fail(res, 500, 'persist_failed', 'Failed to update signal suppression', {
        details: error.message,
      })
      return
    }
    ok(res, data, 200)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error'
    fail(res, 500, 'persist_exception', 'Supabase update threw', { details: message })
  }
}
