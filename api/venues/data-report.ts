/**
 * POST /api/venues/data-report  (authenticated)
 *
 * Body: {
 *   venueId: string,
 *   reason: VenueDataReportReason,
 *   note?: string,
 *   menuUrl?: string,
 *   priceRange?: 1 | 2 | 3 | 4,
 * }
 *
 * Inserts a row into `venue_data_reports` (see
 * `supabase/migrations/20260712000000_venue_data_quality.sql`). Mirrors the
 * catalog quality signals defined in `src/lib/venue-data-reports.ts`.
 *
 * Auth: requires a Bearer Supabase JWT (`requireAuth`). We write via the
 * user's JWT so RLS ("Users can insert venue data reports.") enforces
 * `auth.uid() = user_id` — the client-supplied `venueId` is the only
 * attacker-controlled input reaching the DB write.
 *
 * Rate limit: 10 reports/hour per user, to prevent report-spam abuse.
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
import { asEnum, asNumber, asString, isPlainObject } from '../_lib/validate'
import { checkRateLimit } from '../_lib/rate-limit'
import { createUserClient } from '../_lib/supabase-server'

export const VENUE_DATA_REPORT_REASONS = [
  'wrong_hours',
  'wrong_address',
  'wrong_phone',
  'venue_closed',
  'missing_info',
  'menu_missing',
  'menu_outdated',
  'pricing_outdated',
  'other',
] as const

type VenueDataReportReason = (typeof VENUE_DATA_REPORT_REASONS)[number]

const PRICE_RANGES = [1, 2, 3, 4] as const
const NOTE_MAX = 500

interface DataReportBody {
  venueId: string
  reason: VenueDataReportReason
  note?: string
  menuUrl?: string
  priceRange?: 1 | 2 | 3 | 4
}

interface ValidationOk {
  ok: true
  value: DataReportBody
}
interface ValidationErr {
  ok: false
  errors: string[]
}

export function validateBody(body: unknown): ValidationOk | ValidationErr {
  if (!isPlainObject(body)) return { ok: false, errors: ['body must be a JSON object'] }

  const errors: string[] = []

  const venueId = asString(body.venueId, 1, 128)
  if (!venueId) errors.push('venueId is required')

  const reason = asEnum(body.reason, VENUE_DATA_REPORT_REASONS)
  if (!reason) errors.push(`reason must be one of: ${VENUE_DATA_REPORT_REASONS.join(', ')}`)

  const value: DataReportBody = {
    venueId: venueId ?? '',
    reason: reason ?? 'other',
  }

  if (body.note !== undefined && body.note !== null) {
    const note = asString(body.note, 1, NOTE_MAX)
    if (!note) errors.push(`note must be a string up to ${NOTE_MAX} characters`)
    else value.note = note
  }

  if (body.menuUrl !== undefined && body.menuUrl !== null) {
    const menuUrl = asString(body.menuUrl, 1, 2048)
    if (!menuUrl) errors.push('menuUrl must be a non-empty string')
    else value.menuUrl = menuUrl
  }

  if (body.priceRange !== undefined && body.priceRange !== null) {
    const n = asNumber(body.priceRange, { min: 1, max: 4 })
    if (n === null || !(PRICE_RANGES as readonly number[]).includes(n)) {
      errors.push('priceRange must be one of: 1, 2, 3, 4')
    } else {
      value.priceRange = n as 1 | 2 | 3 | 4
    }
  }

  if (errors.length > 0) return { ok: false, errors }
  return { ok: true, value }
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

  const validated = validateBody(req.body)
  if (!validated.ok) {
    fail(res, 400, 'invalid_input', validated.errors.join('; '))
    return
  }

  const rl = checkRateLimit(`venue-data-report:${auth.context.userId}`, {
    maxTokens: 10,
    refillRatePerSec: 10 / 3600,
  })
  if (!rl.allowed) {
    fail(res, 429, 'rate_limited', 'Too many data reports — try again later', {
      retryAfterSeconds: rl.retryAfterSeconds,
    })
    return
  }

  const { venueId, reason, note, menuUrl, priceRange } = validated.value

  try {
    const client = createUserClient(auth.context.token)
    const { data, error } = await client
      .from('venue_data_reports')
      .insert({
        venue_id: venueId,
        user_id: auth.context.userId,
        reason,
        note: note ?? null,
        menu_url: menuUrl ?? null,
        price_range: priceRange ?? null,
      })
      .select('id, venue_id, user_id, reason, note, menu_url, price_range, status, created_at')
      .single()

    if (error) {
      fail(res, 500, 'persist_failed', 'Failed to save venue data report', {
        details: error.message,
      })
      return
    }

    ok(res, data, 201)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error'
    fail(res, 500, 'persist_exception', 'Supabase insert threw', { details: message })
  }
}
