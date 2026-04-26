/**
 * Typed fetch wrapper around the admin-only venue metadata editor endpoint.
 *
 * The server enforces admin role via `app_metadata.role === 'admin'`; this
 * module additionally pre-validates the payload client-side so we fail fast
 * with a clear error before hitting the network. The shapes here mirror the
 * fields added in `supabase/migrations/20260417000006_venue_structured_metadata.sql`.
 */
import { supabase } from '@/lib/supabase'
import {
  ACCESSIBILITY_FEATURES,
  type AccessibilityFeature,
  type VenueDressCode,
  type VenueIndoorOutdoor,
} from '@/lib/types'

export const VENUE_DRESS_CODES: readonly VenueDressCode[] = [
  'casual',
  'smart_casual',
  'upscale',
  'formal',
  'costume_required',
  'no_code',
] as const

export const VENUE_INDOOR_OUTDOOR: readonly VenueIndoorOutdoor[] = [
  'indoor',
  'outdoor',
  'both',
] as const

export const COVER_CHARGE_NOTE_MAX = 120

export interface VenueMetadataPayload {
  dress_code?: VenueDressCode | null
  cover_charge_cents?: number | null
  cover_charge_note?: string | null
  accessibility_features?: AccessibilityFeature[]
  indoor_outdoor?: VenueIndoorOutdoor | null
  capacity_hint?: number | null
}

export interface VenueMetadataResponse {
  id: string
  dress_code: VenueDressCode | null
  cover_charge_cents: number | null
  cover_charge_note: string | null
  accessibility_features: AccessibilityFeature[]
  indoor_outdoor: VenueIndoorOutdoor | null
  capacity_hint: number | null
}

/**
 * Mirror of the server-side zod schema. Kept hand-rolled to avoid inflating
 * the client bundle with redundant validators — the client UI validates
 * individually per-field while this gate protects the network boundary.
 */
export function validateVenueMetadataPayload(
  input: unknown,
): { ok: true; value: VenueMetadataPayload } | { ok: false; errors: string[] } {
  const errors: string[] = []
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, errors: ['payload must be an object'] }
  }
  const raw = input as Record<string, unknown>
  const value: VenueMetadataPayload = {}

  if (raw.dress_code !== undefined && raw.dress_code !== null) {
    if (
      typeof raw.dress_code !== 'string' ||
      !(VENUE_DRESS_CODES as readonly string[]).includes(raw.dress_code)
    ) {
      errors.push(`dress_code must be one of: ${VENUE_DRESS_CODES.join(', ')}`)
    } else {
      value.dress_code = raw.dress_code as VenueDressCode
    }
  } else if (raw.dress_code === null) {
    value.dress_code = null
  }

  if (raw.cover_charge_cents !== undefined && raw.cover_charge_cents !== null) {
    if (
      typeof raw.cover_charge_cents !== 'number' ||
      !Number.isFinite(raw.cover_charge_cents) ||
      !Number.isInteger(raw.cover_charge_cents) ||
      raw.cover_charge_cents < 0
    ) {
      errors.push('cover_charge_cents must be a non-negative integer')
    } else {
      value.cover_charge_cents = raw.cover_charge_cents
    }
  } else if (raw.cover_charge_cents === null) {
    value.cover_charge_cents = null
  }

  if (raw.cover_charge_note !== undefined && raw.cover_charge_note !== null) {
    if (
      typeof raw.cover_charge_note !== 'string' ||
      raw.cover_charge_note.length > COVER_CHARGE_NOTE_MAX
    ) {
      errors.push(`cover_charge_note must be a string up to ${COVER_CHARGE_NOTE_MAX} characters`)
    } else {
      value.cover_charge_note = raw.cover_charge_note.trim()
    }
  } else if (raw.cover_charge_note === null) {
    value.cover_charge_note = null
  }

  if (raw.accessibility_features !== undefined) {
    if (!Array.isArray(raw.accessibility_features)) {
      errors.push('accessibility_features must be an array')
    } else {
      const allowed = ACCESSIBILITY_FEATURES as readonly string[]
      const bad = raw.accessibility_features.find(
        (f) => typeof f !== 'string' || !allowed.includes(f),
      )
      if (bad !== undefined) {
        errors.push('accessibility_features contains an unsupported value')
      } else {
        // Dedupe while preserving declaration order from ACCESSIBILITY_FEATURES.
        const set = new Set(raw.accessibility_features as string[])
        value.accessibility_features = (ACCESSIBILITY_FEATURES as readonly AccessibilityFeature[])
          .filter((f) => set.has(f))
      }
    }
  }

  if (raw.indoor_outdoor !== undefined && raw.indoor_outdoor !== null) {
    if (
      typeof raw.indoor_outdoor !== 'string' ||
      !(VENUE_INDOOR_OUTDOOR as readonly string[]).includes(raw.indoor_outdoor)
    ) {
      errors.push(`indoor_outdoor must be one of: ${VENUE_INDOOR_OUTDOOR.join(', ')}`)
    } else {
      value.indoor_outdoor = raw.indoor_outdoor as VenueIndoorOutdoor
    }
  } else if (raw.indoor_outdoor === null) {
    value.indoor_outdoor = null
  }

  if (raw.capacity_hint !== undefined && raw.capacity_hint !== null) {
    if (
      typeof raw.capacity_hint !== 'number' ||
      !Number.isFinite(raw.capacity_hint) ||
      !Number.isInteger(raw.capacity_hint) ||
      raw.capacity_hint < 0
    ) {
      errors.push('capacity_hint must be a non-negative integer')
    } else {
      value.capacity_hint = raw.capacity_hint
    }
  } else if (raw.capacity_hint === null) {
    value.capacity_hint = null
  }

  if (errors.length > 0) return { ok: false, errors }
  return { ok: true, value }
}

export async function updateVenueMetadata(
  venueId: string,
  payload: VenueMetadataPayload,
): Promise<VenueMetadataResponse> {
  if (!venueId || typeof venueId !== 'string') {
    throw new Error('venueId is required')
  }
  const validated = validateVenueMetadataPayload(payload)
  if (!validated.ok) {
    throw new Error(validated.errors.join('; '))
  }

  const { data: sess } = await supabase.auth.getSession()
  const token = sess.session?.access_token
  if (!token) throw new Error('Not authenticated')

  const res = await fetch('/api/admin/venue-metadata', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ venue_id: venueId, ...validated.value }),
  })

  if (!res.ok) {
    let message = `Request failed: ${res.status}`
    try {
      const body = (await res.json()) as { error?: { message?: string } | string }
      if (body?.error) {
        message =
          typeof body.error === 'string'
            ? body.error
            : body.error.message ?? message
      }
    } catch {
      // swallow parse error, keep generic message
    }
    throw new Error(message)
  }

  const json = (await res.json()) as { data: VenueMetadataResponse }
  return json.data
}
