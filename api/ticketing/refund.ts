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

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { verifySupabaseJwt } from '../_lib/auth'
import {
  badRequest,
  forbidden,
  handlePreflight,
  methodNotAllowed,
  serverError,
  unauthorized,
  type RequestLike,
  type ResponseLike,
} from '../_lib/http'
import { createRefund } from '../_lib/stripe'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const REFUND_WINDOW_MS = 24 * 60 * 60 * 1000

async function isVenueStaff(
  supabase: SupabaseClient,
  userId: string,
  venueId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('venue_staff')
    .select('user_id')
    .eq('user_id', userId)
    .eq('venue_id', venueId)
    .maybeSingle()
  return !!data
}

export default async function handler(req: RequestLike, res: ResponseLike): Promise<void> {
  if (handlePreflight(req, res)) return
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST', 'OPTIONS'])

  const auth = await verifySupabaseJwt(req)
  if (!auth.ok || !auth.user) return unauthorized(res, auth.error ?? 'Unauthorized')
  const userId = auth.user.id

  const body = (req.body ?? {}) as { ticket_id?: unknown; force?: unknown }
  if (typeof body.ticket_id !== 'string' || !UUID_RE.test(body.ticket_id)) {
    return badRequest(res, 'validation_failed', ['ticket_id must be a uuid'])
  }
  const ticket_id = body.ticket_id
  const force = body.force === true

  const url = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return serverError(res, 'Supabase not configured')
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } })

  try {
    const { data: ticket } = await supabase
      .from('tickets')
      .select('id, user_id, event_id, status, stripe_payment_intent, price_cents')
      .eq('id', ticket_id)
      .maybeSingle()
    if (!ticket) {
      res.status(404).json({ error: 'ticket_not_found' })
      return
    }
    if (ticket.status !== 'paid') return badRequest(res, 'ticket_not_refundable')
    if (!ticket.stripe_payment_intent) return badRequest(res, 'missing_payment_intent')

    const { data: event } = await supabase
      .from('events')
      .select('id, venue_id, starts_at')
      .eq('id', ticket.event_id)
      .maybeSingle()
    if (!event) {
      res.status(404).json({ error: 'event_not_found' })
      return
    }

    const isOwner = ticket.user_id === userId
    const isStaff = await isVenueStaff(supabase, userId, event.venue_id)
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
    if (updErr) return serverError(res, updErr.message)

    res.status(200).json({ data: { ticket_id, refund_id: refund.id, status: 'refunded' } })
  } catch (err) {
    serverError(res, err instanceof Error ? err.message : 'Internal error')
  }
}
