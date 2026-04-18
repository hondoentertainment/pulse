/**
 * POST /api/ticketing/refund
 *
 * Owner- or venue-admin-initiated refund. Eligibility:
 *   - ticket is `paid`
 *   - event has not started
 *   - refund requested >= 24h before event start (policy window)
 *
 * Full refund only — partial refunds are a v2. Venue admins may override the
 * 24h window by passing `force: true` (audit-logged via Stripe metadata).
 *
 * Body: { ticket_id: uuid, force?: boolean }
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
import { createRefund } from '../_lib/stripe'
import { getServiceSupabase } from '../_lib/supabase-server'
import { isUuid, requireFields } from '../_lib/validate'

const REFUND_WINDOW_MS = 24 * 60 * 60 * 1000

export default async function handler(req: RequestLike, res: ResponseLike): Promise<void> {
  if (handlePreflight(req, res)) return
  if (req.method !== 'POST') return methodNotAllowed(res)

  const auth = await authenticate(req)
  if (!auth) return unauthorized(res)

  const errors = requireFields(req.body, { ticket_id: isUuid })
  if (errors.length) return badRequest(res, 'validation_failed', errors)

  const { ticket_id, force } = req.body as { ticket_id: string; force?: boolean }
  const supabase = getServiceSupabase()
  if (!supabase) return serverError(res, new Error('Supabase not configured'))

  try {
    const { data: ticket } = await supabase
      .from('tickets')
      .select('id, user_id, event_id, status, stripe_payment_intent, price_cents')
      .eq('id', ticket_id)
      .maybeSingle()
    if (!ticket) return notFound(res, 'ticket_not_found')
    if (ticket.status !== 'paid') return badRequest(res, 'ticket_not_refundable')
    if (!ticket.stripe_payment_intent) return badRequest(res, 'missing_payment_intent')

    const { data: event } = await supabase
      .from('events')
      .select('id, venue_id, starts_at')
      .eq('id', ticket.event_id)
      .maybeSingle()
    if (!event) return notFound(res, 'event_not_found')

    const isOwner = ticket.user_id === auth.userId
    const isStaff = await isVenueStaff(auth.userId, event.venue_id)
    if (!isOwner && !isStaff) return forbidden(res)

    const eventStart = event.starts_at ? new Date(event.starts_at).getTime() : 0
    const msUntilStart = eventStart - Date.now()
    if (msUntilStart < REFUND_WINDOW_MS) {
      if (!(isStaff && force)) {
        return badRequest(res, 'outside_refund_window')
      }
    }

    const refund = await createRefund(ticket.stripe_payment_intent, ticket.price_cents)

    const { error: updErr } = await supabase
      .from('tickets')
      .update({ status: 'refunded', refunded_at: new Date().toISOString() })
      .eq('id', ticket_id)
    if (updErr) return serverError(res, updErr)

    res.status(200).json({ data: { ticket_id, refund_id: refund.id, status: 'refunded' } })
  } catch (err) {
    serverError(res, err)
  }
}
