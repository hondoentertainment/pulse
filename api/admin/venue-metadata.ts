/**
 * POST /api/admin/venue-metadata  (admin-only)
 *
 * Body: {
 *   venue_id: string,
 *   dress_code?: VenueDressCode | null,
 *   cover_charge_cents?: number | null,
 *   cover_charge_note?: string | null,
 *   accessibility_features?: AccessibilityFeature[],
 *   indoor_outdoor?: VenueIndoorOutdoor | null,
 *   capacity_hint?: number | null,
 * }
 *
 * Updates the structured metadata columns added in
 * `supabase/migrations/20260417000006_venue_structured_metadata.sql`.
 *
 * Auth: requires an authed Supabase JWT whose `app_metadata.role === 'admin'`.
 * We decode + validate locally (`requireAuth`) to fail fast with a 401/403 and
 * then write via the user JWT so RLS (`Admins can update venue structured
 * metadata.`) provides defense-in-depth. Service-role fallback is supported
 * for restricted environments where RLS needs to be bypassed deliberately.
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
import { asEnum, asNumber, asString, isPlainObject } from '../_lib/validate'
import { createUserClient, getSupabaseConfig } from '../_lib/supabase-server'

const DRESS_CODES = [
  'casual',
  'smart_casual',
  'upscale',
  'formal',
  'costume_required',
  'no_code',
] as const

const INDOOR_OUTDOOR = ['indoor', 'outdoor', 'both'] as const

const ACCESSIBILITY = [
  'wheelchair_accessible',
  'step_free_entry',
  'accessible_restroom',
  'gender_neutral_restroom',
  'sensory_friendly',
  'quiet_hours',
  'service_animal_friendly',
  'signer_on_request',
  'braille_menu',
] as const

const COVER_CHARGE_NOTE_MAX = 120

type DressCode = (typeof DRESS_CODES)[number]
type IndoorOutdoor = (typeof INDOOR_OUTDOOR)[number]
type AccessibilityFeature = (typeof ACCESSIBILITY)[number]

interface VenueMetadataBody {
  venue_id: string
  dress_code?: DressCode | null
  cover_charge_cents?: number | null
  cover_charge_note?: string | null
  accessibility_features?: AccessibilityFeature[]
  indoor_outdoor?: IndoorOutdoor | null
  capacity_hint?: number | null
}

interface ValidationOk {
  ok: true
  value: VenueMetadataBody
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

  const value: VenueMetadataBody = { venue_id: venueId ?? '' }

  if ('dress_code' in body) {
    if (body.dress_code === null) {
      value.dress_code = null
    } else {
      const v = asEnum(body.dress_code, DRESS_CODES)
      if (!v) errors.push(`dress_code must be one of: ${DRESS_CODES.join(', ')}`)
      else value.dress_code = v
    }
  }

  if ('cover_charge_cents' in body) {
    if (body.cover_charge_cents === null) {
      value.cover_charge_cents = null
    } else {
      const n = asNumber(body.cover_charge_cents, { min: 0 })
      if (n === null || !Number.isInteger(n)) {
        errors.push('cover_charge_cents must be a non-negative integer')
      } else value.cover_charge_cents = n
    }
  }

  if ('cover_charge_note' in body) {
    if (body.cover_charge_note === null) {
      value.cover_charge_note = null
    } else if (typeof body.cover_charge_note !== 'string') {
      errors.push('cover_charge_note must be a string')
    } else if (body.cover_charge_note.length > COVER_CHARGE_NOTE_MAX) {
      errors.push(`cover_charge_note must be ${COVER_CHARGE_NOTE_MAX} chars or fewer`)
    } else {
      value.cover_charge_note = body.cover_charge_note.trim()
    }
  }

  if ('accessibility_features' in body) {
    if (!Array.isArray(body.accessibility_features)) {
      errors.push('accessibility_features must be an array')
    } else {
      const allowed = ACCESSIBILITY as readonly string[]
      const clean: AccessibilityFeature[] = []
      let invalid = false
      for (const item of body.accessibility_features) {
        if (typeof item !== 'string' || !allowed.includes(item)) {
          invalid = true
          break
        }
        if (!clean.includes(item as AccessibilityFeature)) clean.push(item as AccessibilityFeature)
      }
      if (invalid) errors.push('accessibility_features contains an unsupported value')
      else value.accessibility_features = clean
    }
  }

  if ('indoor_outdoor' in body) {
    if (body.indoor_outdoor === null) {
      value.indoor_outdoor = null
    } else {
      const v = asEnum(body.indoor_outdoor, INDOOR_OUTDOOR)
      if (!v) errors.push(`indoor_outdoor must be one of: ${INDOOR_OUTDOOR.join(', ')}`)
      else value.indoor_outdoor = v
    }
  }

  if ('capacity_hint' in body) {
    if (body.capacity_hint === null) {
      value.capacity_hint = null
    } else {
      const n = asNumber(body.capacity_hint, { min: 0 })
      if (n === null || !Number.isInteger(n)) {
        errors.push('capacity_hint must be a non-negative integer')
      } else value.capacity_hint = n
    }
  }

  if (errors.length > 0) return { ok: false, errors }
  return { ok: true, value }
}

export function buildUpdateRow(body: VenueMetadataBody): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  if ('dress_code' in body) row.dress_code = body.dress_code ?? null
  if ('cover_charge_cents' in body) row.cover_charge_cents = body.cover_charge_cents ?? null
  if ('cover_charge_note' in body) row.cover_charge_note = body.cover_charge_note ?? null
  if ('accessibility_features' in body) row.accessibility_features = body.accessibility_features ?? []
  if ('indoor_outdoor' in body) row.indoor_outdoor = body.indoor_outdoor ?? null
  if ('capacity_hint' in body) row.capacity_hint = body.capacity_hint ?? null
  return row
}

/**
 * Build the Supabase client to use for the write. Honors the service-role
 * key when it's configured (for ops / cron / restricted RLS environments);
 * otherwise forwards the user JWT so RLS remains the source of truth.
 *
 * Exported for test injection.
 */
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

  // Admin role gate — decode the JWT to check `app_metadata.role`.
  // RLS on `venues` also enforces this, but a local check gives a clean 403.
  const claims = decodeJwt(auth.context.token) as
    | (Record<string, unknown> & { app_metadata?: { role?: string }; role?: string })
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

  const updateRow = buildUpdateRow(validated.value)
  if (Object.keys(updateRow).length === 0) {
    fail(res, 400, 'invalid_input', 'No metadata fields provided to update')
    return
  }

  try {
    const client = buildSupabaseClient(auth.context.token)
    const { data, error } = await client
      .from('venues')
      .update(updateRow)
      .eq('id', validated.value.venue_id)
      .select(
        'id, dress_code, cover_charge_cents, cover_charge_note, accessibility_features, indoor_outdoor, capacity_hint',
      )
      .single()

    if (error) {
      fail(res, 500, 'persist_failed', 'Failed to update venue metadata', {
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
