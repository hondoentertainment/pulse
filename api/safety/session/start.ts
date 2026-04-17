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
 *
 * Returns the created session row or a 4xx/5xx error.
 */

import {
  authenticate,
  badRequest,
  getServiceClient,
  methodNotAllowed,
  readJsonBody,
  serverError,
  setCors,
  unauthorized,
  type RequestLike,
  type ResponseLike,
} from '../../_lib/safety-server'

type StartBody = {
  kind?: 'safe_walk' | 'share_night' | 'panic'
  expectedDurationMinutes?: number
  destination?: {
    venueId?: string
    lat?: number
    lng?: number
    label?: string
  }
  contacts?: Array<{ id: string; phone_e164: string; name: string; method: 'sms' | 'push' }>
  notes?: string
}

const MAX_DURATION_MINUTES = 8 * 60 // 8 hours absolute ceiling
const DEFAULT_DURATION_MINUTES = 20

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

  const body = readJsonBody<StartBody>(req)
  if (!body || !body.kind || !['safe_walk', 'share_night', 'panic'].includes(body.kind)) {
    badRequest(res, 'invalid-kind')
    return
  }

  const duration = Math.min(
    Math.max(body.expectedDurationMinutes ?? DEFAULT_DURATION_MINUTES, 1),
    MAX_DURATION_MINUTES,
  )
  const startsAt = new Date()
  const expectedEndAt = new Date(startsAt.getTime() + duration * 60_000)

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
        contacts_snapshot: body.contacts ?? [],
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
      contacts_snapshot: body.contacts ?? [],
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
