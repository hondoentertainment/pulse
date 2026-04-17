/**
 * POST /api/reservations/update
 *
 * Venue staff transitions a reservation's state. Permitted transitions:
 *   requested   -> confirmed | cancelled
 *   confirmed   -> seated    | cancelled | no_show
 *   seated      -> completed
 *
 * Body: { reservation_id: uuid, status: string, note?: string }
 */

import { authenticate, isVenueStaff } from '../_lib/auth'
import {
  badRequest,
  forbidden,
  handlePreflight,
  methodNotAllowed,
  notFound,
  serverError,
  unauthorized,
  type RequestLike,
  type ResponseLike,
} from '../_lib/http'
import { getServiceSupabase } from '../_lib/supabase-server'
import { isString, isUuid, requireFields } from '../_lib/validate'

const TRANSITIONS: Record<string, string[]> = {
  requested: ['confirmed', 'cancelled'],
  confirmed: ['seated', 'cancelled', 'no_show'],
  seated: ['completed'],
  cancelled: [],
  completed: [],
  no_show: [],
}

export default async function handler(req: RequestLike, res: ResponseLike): Promise<void> {
  if (handlePreflight(req, res)) return
  if (req.method !== 'POST') return methodNotAllowed(res)

  const auth = await authenticate(req)
  if (!auth) return unauthorized(res)

  const errors = requireFields(req.body, {
    reservation_id: isUuid,
    status: isString,
  })
  if (errors.length) return badRequest(res, 'validation_failed', errors)

  const { reservation_id, status, note } = req.body as {
    reservation_id: string
    status: string
    note?: string
  }

  const supabase = getServiceSupabase()
  if (!supabase) return serverError(res, new Error('Supabase not configured'))

  try {
    const { data: reservation } = await supabase
      .from('reservations')
      .select('id, venue_id, status')
      .eq('id', reservation_id)
      .maybeSingle()
    if (!reservation) return notFound(res, 'reservation_not_found')

    const staff = await isVenueStaff(auth.userId, reservation.venue_id)
    if (!staff) return forbidden(res)

    const allowed = TRANSITIONS[reservation.status] ?? []
    if (!allowed.includes(status)) {
      return badRequest(res, 'invalid_transition', {
        from: reservation.status,
        to: status,
        allowed,
      })
    }

    const patch: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    }
    if (note !== undefined && isString(note)) patch.notes = note

    const { error: updErr } = await supabase
      .from('reservations')
      .update(patch)
      .eq('id', reservation_id)
    if (updErr) return serverError(res, updErr)

    res.status(200).json({ data: { reservation_id, status } })
  } catch (err) {
    serverError(res, err)
  }
}
