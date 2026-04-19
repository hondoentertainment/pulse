/**
 * POST /api/safety/session/start
 *
 * Body:
 *   kind: 'safe_walk' | 'share_night' | 'panic'
 *   expectedDurationMinutes?: number      (default 20 for safe_walk)
 *   destination?: {
 *     venueId?: string
 *     lat?: number
 *     lng?: number
 *     label?: string
 *   }
 *   contacts?: Array<{ id: string; phone_e164: string; name: string; method: 'sms'|'push' }>
 *   notes?: string
 */

import {
  authenticate,
  badRequest,
  consumeRateLimitToken,
  getServiceClient,
  methodNotAllowed,
  readJsonBody,
  serverError,
  setCors,
  unauthorized,
  type RequestLike,
  type ResponseLike,
} from '../../_lib/safety-server'
import {
  asEnum,
  asInteger,
  asNumber,
  asString,
  isPlainObject,
} from '../../_lib/validate'

const KINDS = ['safe_walk', 'share_night', 'panic'] as const
type Kind = (typeof KINDS)[number]

const METHODS = ['sms', 'push'] as const
type Method = (typeof METHODS)[number]

const MAX_DURATION_MINUTES = 8 * 60 // 8 hours absolute ceiling
const DEFAULT_DURATION_MINUTES = 20
const MAX_CONTACTS = 20
const MAX_NOTES_LEN = 500
const MAX_LABEL_LEN = 200

// E.164: plus sign, 7-15 digits, leading digit non-zero.
const E164_RE = /^\+[1-9][0-9]{6,14}$/

interface StartBody {
  kind: Kind
  expectedDurationMinutes: number
  destination?: {
    venueId?: string
    lat?: number
    lng?: number
    label?: string
  }
  contacts: Array<{ id: string; phone_e164: string; name: string; method: Method }>
  notes?: string
}

function validate(
  body: unknown,
): { ok: true; value: StartBody } | { ok: false; error: string } {
  if (!isPlainObject(body)) return { ok: false, error: 'body-not-object' }

  const kind = asEnum<Kind>(body.kind, KINDS)
  if (!kind) return { ok: false, error: 'invalid-kind' }

  let expectedDurationMinutes = DEFAULT_DURATION_MINUTES
  if (body.expectedDurationMinutes !== undefined) {
    const parsed = asInteger(body.expectedDurationMinutes, {
      min: 1,
      max: MAX_DURATION_MINUTES,
    })
    if (parsed === null) return { ok: false, error: 'invalid-duration' }
    expectedDurationMinutes = parsed
  }

  let destination: StartBody['destination']
  if (body.destination !== undefined && body.destination !== null) {
    if (!isPlainObject(body.destination)) return { ok: false, error: 'invalid-destination' }
    const dest: StartBody['destination'] = {}
    if (body.destination.venueId !== undefined) {
      const v = asString(body.destination.venueId, 1, 128)
      if (!v) return { ok: false, error: 'invalid-destination-venueId' }
      dest.venueId = v
    }
    if (body.destination.lat !== undefined) {
      const lat = asNumber(body.destination.lat, { min: -90, max: 90 })
      if (lat === null) return { ok: false, error: 'invalid-destination-lat' }
      dest.lat = lat
    }
    if (body.destination.lng !== undefined) {
      const lng = asNumber(body.destination.lng, { min: -180, max: 180 })
      if (lng === null) return { ok: false, error: 'invalid-destination-lng' }
      dest.lng = lng
    }
    if (body.destination.label !== undefined) {
      const l = asString(body.destination.label, 1, MAX_LABEL_LEN)
      if (!l) return { ok: false, error: 'invalid-destination-label' }
      dest.label = l
    }
    destination = dest
  }

  const contacts: StartBody['contacts'] = []
  if (body.contacts !== undefined) {
    if (!Array.isArray(body.contacts)) return { ok: false, error: 'invalid-contacts' }
    if (body.contacts.length > MAX_CONTACTS) return { ok: false, error: 'too-many-contacts' }
    for (const raw of body.contacts) {
      if (!isPlainObject(raw)) return { ok: false, error: 'invalid-contact-entry' }
      const id = asString(raw.id, 1, 128)
      const phone_e164 = typeof raw.phone_e164 === 'string' ? raw.phone_e164 : null
      const name = asString(raw.name, 1, 200)
      const method = asEnum<Method>(raw.method, METHODS)
      if (!id || !phone_e164 || !E164_RE.test(phone_e164) || !name || !method) {
        return { ok: false, error: 'invalid-contact-entry' }
      }
      contacts.push({ id, phone_e164, name, method })
    }
  }

  let notes: string | undefined
  if (body.notes !== undefined && body.notes !== null) {
    const n = asString(body.notes, 1, MAX_NOTES_LEN)
    if (!n) return { ok: false, error: 'invalid-notes' }
    notes = n
  }

  return {
    ok: true,
    value: { kind, expectedDurationMinutes, destination, contacts, notes },
  }
}

export default async function handler(req: RequestLike, res: ResponseLike): Promise<void> {
  setCors(res)
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }
  if (req.method !== 'POST') {
    methodNotAllowed(res)
    return
  }

  const userId = await authenticate(req)
  if (!userId) {
    unauthorized(res)
    return
  }

  // 10 session creates per hour per user (burst 3). Protects against a stuck
  // client spamming new sessions and against stolen-token session flooding.
  const limit = consumeRateLimitToken(`safety:session-start:${userId}`, {
    maxTokens: 3,
    refillPerSecond: 10 / 3600,
  })
  if (!limit.allowed) {
    res.status(429).json({ error: 'rate-limited', retryAfterMs: limit.retryAfterMs })
    return
  }

  const parsed = validate(readJsonBody(req))
  if (!parsed.ok) {
    badRequest(res, parsed.error)
    return
  }
  const body = parsed.value

  const startsAt = new Date()
  const expectedEndAt = new Date(
    startsAt.getTime() + body.expectedDurationMinutes * 60_000,
  )
  const initialState = body.kind === 'panic' ? 'alerted' : 'active'

  const client = getServiceClient()
  if (!client) {
    // Dev / missing-env fallback: echo back a synthetic row so the client UX
    // works end-to-end without Supabase configured.
    res.status(201).json({
      data: {
        id: `dev-${Date.now()}`,
        user_id: userId,
        kind: body.kind,
        state: initialState,
        starts_at: startsAt.toISOString(),
        expected_end_at: expectedEndAt.toISOString(),
        destination_venue_id: body.destination?.venueId ?? null,
        destination_lat: body.destination?.lat ?? null,
        destination_lng: body.destination?.lng ?? null,
        destination_label: body.destination?.label ?? null,
        contacts_snapshot: body.contacts,
      },
      devFallback: true,
    })
    return
  }

  const { data, error } = await client
    .from('safety_sessions')
    .insert({
      user_id: userId,
      kind: body.kind,
      state: initialState,
      starts_at: startsAt.toISOString(),
      expected_end_at: expectedEndAt.toISOString(),
      destination_venue_id: body.destination?.venueId ?? null,
      destination_lat: body.destination?.lat ?? null,
      destination_lng: body.destination?.lng ?? null,
      destination_label: body.destination?.label ?? null,
      contacts_snapshot: body.contacts,
      notes: body.notes ?? null,
    })
    .select()
    .single()

  if (error) {
    serverError(res, error.message)
    return
  }

  res.status(201).json({ data })
}
