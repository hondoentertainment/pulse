/**
 * POST /api/venues/data-report  (authenticated)
 *
 * Body: {
 *   venueId: string,
 *   reason: VenueDataReportReason,
 *   note?: string,
 *   menuUrl?: string,
 *   priceRange?: 1 | 2 | 3 | 4,
 *   proposedFields?: { hours?, address?, phone?, website?, name? },
 * }
 *
 * Inserts a row into `venue_data_reports` (see
 * `supabase/migrations/20260712000000_venue_data_quality.sql` and
 * `20260716000000_venue_correction_proposals.sql`). Mirrors the catalog
 * quality signals defined in `src/lib/venue-data-reports.ts`.
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

export const VENUE_PROPOSED_FIELD_KEYS = [
  'hours',
  'address',
  'phone',
  'website',
  'name',
] as const

type VenueProposedFieldKey = (typeof VENUE_PROPOSED_FIELD_KEYS)[number]
type VenueProposedFields = Partial<Record<VenueProposedFieldKey, string>>

const PRICE_RANGES = [1, 2, 3, 4] as const
const NOTE_MAX = 500

const PROPOSED_FIELD_MAX: Record<VenueProposedFieldKey, number> = {
  hours: 500,
  address: 300,
  phone: 40,
  website: 2048,
  name: 120,
}

interface DataReportBody {
  venueId: string
  reason: VenueDataReportReason
  note?: string
  menuUrl?: string
  priceRange?: 1 | 2 | 3 | 4
  proposedFields?: VenueProposedFields
}

interface ValidationOk {
  ok: true
  value: DataReportBody
}
interface ValidationErr {
  ok: false
  errors: string[]
}

export function validateProposedFields(
  input: unknown,
): { ok: true; value?: VenueProposedFields } | { ok: false; errors: string[] } {
  if (input === undefined || input === null) return { ok: true, value: undefined }
  if (!isPlainObject(input)) return { ok: false, errors: ['proposedFields must be an object'] }

  const errors: string[] = []
  const value: VenueProposedFields = {}

  for (const key of Object.keys(input)) {
    if (!(VENUE_PROPOSED_FIELD_KEYS as readonly string[]).includes(key)) {
      errors.push(`proposedFields.${key} is not a supported field`)
    }
  }

  for (const key of VENUE_PROPOSED_FIELD_KEYS) {
    const entry = input[key]
    if (entry === undefined || entry === null) continue
    if (typeof entry === 'string' && entry.trim() === '') continue
    const max = PROPOSED_FIELD_MAX[key]
    const parsed = asString(entry, 1, max)
    if (!parsed) {
      errors.push(`proposedFields.${key} must be a string up to ${max} characters`)
      continue
    }
    value[key] = parsed
  }

  if (errors.length > 0) return { ok: false, errors }
  return { ok: true, value: Object.keys(value).length > 0 ? value : undefined }
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

  const proposed = validateProposedFields(body.proposedFields)
  if (!proposed.ok) errors.push(...proposed.errors)
  else if (proposed.value) value.proposedFields = proposed.value

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

  const { venueId, reason, note, menuUrl, priceRange, proposedFields } = validated.value

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
        proposed_fields: proposedFields ?? null,
      })
      .select(
        'id, venue_id, user_id, reason, note, menu_url, price_range, proposed_fields, status, created_at',
      )
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
