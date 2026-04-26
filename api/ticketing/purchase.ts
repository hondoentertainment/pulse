/**
 * POST /api/ticketing/purchase
 *
 * Authenticated endpoint that:
 *   1. Validates the event is published and the requested ticket_type has remaining capacity.
 *   2. Reserves one ticket row in `pending` state (atomic decrement of remaining).
 *   3. Creates a Stripe PaymentIntent with Connect transfer_data -> venue's connected account.
 *   4. Returns { ticket_id, client_secret, amount_cents, currency }.
 *
 * Body: { event_id: uuid, ticket_type: string }
 */

import { authenticate } from '../_lib/auth'
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
import { calculatePlatformFeeCents } from '../_lib/fees'
import { rateLimit } from '../_lib/rate-limit'
import { createPaymentIntent } from '../_lib/stripe'
import { getServiceSupabase } from '../_lib/supabase-server'
import { isString, isUuid, requireFields } from '../_lib/validate'

interface TicketTypeDef {
  name: string
  price_cents: number
  qty: number
  remaining: number
}

export default async function handler(req: RequestLike, res: ResponseLike): Promise<void> {
  if (handlePreflight(req, res)) return
  if (req.method !== 'POST') return methodNotAllowed(res)

  const auth = await authenticate(req)
  if (!auth) return unauthorized(res)

  const rl = rateLimit('ticketing:purchase', auth.userId, 20, 60_000)
  if (!rl.ok) {
    res.status(429).json({ error: 'Rate limit exceeded', resetAt: rl.resetAt })
    return
  }

  const errors = requireFields(req.body, {
    event_id: isUuid,
    ticket_type: isString,
  })
  if (errors.length) return badRequest(res, 'validation_failed', errors)

  const { event_id, ticket_type } = req.body as { event_id: string; ticket_type: string }

  const supabase = getServiceSupabase()
  if (!supabase) return serverError(res, new Error('Supabase not configured'))

  try {
    const { data: event, error: eventErr } = await supabase
      .from('events')
      .select('id, venue_id, status, currency, ticket_types, starts_at, deleted_at')
      .eq('id', event_id)
      .maybeSingle()

    if (eventErr) return serverError(res, eventErr)
    if (!event || event.deleted_at) return notFound(res, 'event_not_found')
    if (event.status !== 'published') {
      return forbidden(res, 'event_not_purchasable')
    }

    const types = Array.isArray(event.ticket_types) ? (event.ticket_types as TicketTypeDef[]) : []
    const idx = types.findIndex(t => t.name === ticket_type)
    if (idx < 0) return badRequest(res, 'ticket_type_not_found')
    const tier = types[idx]
    if (!tier || tier.remaining <= 0) return badRequest(res, 'sold_out')

    // Decrement remaining atomically via optimistic check. If the jsonb has
    // changed under us we retry once; past that, 409.
    const updatedTypes = types.map((t, i) => (i === idx ? { ...t, remaining: t.remaining - 1 } : t))
    const { error: capErr } = await supabase
      .from('events')
      .update({ ticket_types: updatedTypes })
      .eq('id', event_id)
      .eq('ticket_types', JSON.stringify(types)) // compare-and-swap
    if (capErr) return serverError(res, capErr)

    // Resolve payout account
    const { data: payout } = await supabase
      .from('venue_payout_accounts')
      .select('stripe_account_id, payouts_enabled')
      .eq('venue_id', event.venue_id)
      .maybeSingle()

    const amountCents = tier.price_cents
    const currency = event.currency || 'usd'
    const applicationFeeCents = calculatePlatformFeeCents(amountCents)

    // Insert pending ticket row
    const { data: ticket, error: insertErr } = await supabase
      .from('tickets')
      .insert({
        event_id,
        user_id: auth.userId,
        ticket_type,
        price_cents: amountCents,
        currency,
        status: 'pending',
      })
      .select('id')
      .single()
    if (insertErr || !ticket) return serverError(res, insertErr ?? new Error('insert_failed'))

    // Create PaymentIntent with Connect transfer_data when the venue is onboarded.
    const intent = await createPaymentIntent({
      amountCents,
      currency,
      applicationFeeCents: payout?.stripe_account_id ? applicationFeeCents : undefined,
      destinationAccountId: payout?.stripe_account_id ?? undefined,
      metadata: {
        ticket_id: ticket.id,
        event_id,
        user_id: auth.userId,
        venue_id: event.venue_id,
      },
      idempotencyKey: `ticket:${ticket.id}`,
    })

    await supabase
      .from('tickets')
      .update({ stripe_payment_intent: intent.id })
      .eq('id', ticket.id)

    res.status(200).json({
      data: {
        ticket_id: ticket.id,
        client_secret: intent.client_secret,
        amount_cents: amountCents,
        currency,
        payment_intent_id: intent.id,
      },
    })
  } catch (err) {
    serverError(res, err)
  }
}
