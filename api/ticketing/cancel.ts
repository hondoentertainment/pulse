/**
 * POST /api/ticketing/cancel
 *
 * Body: { ticketId: string }
 * Auth: Bearer <supabase jwt>. The caller must own the ticket.
 *
 * Cancels a pending PaymentIntent via Stripe REST and flips the
 * `tickets` row to `cancelled`. Reconciles capacity by incrementing
 * `events.ticket_types[*].remaining`.
 */

import { createClient } from '@supabase/supabase-js'
import { setCors, sendJson, bearerToken, type ApiRequest, type ApiResponse } from '../_lib/http'
import { checkRateLimit } from '../_lib/rate-limit'

interface TicketRow {
  id: string
  user_id: string
  event_id: string
  venue_id: string
  type: string
  status: string
  payment_intent_id: string | null
}

async function cancelPaymentIntentStripe(pi: string, key: string): Promise<boolean> {
  const body = new URLSearchParams({ cancellation_reason: 'requested_by_customer' })
  const res = await fetch(`https://api.stripe.com/v1/payment_intents/${pi}/cancel`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${key}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body,
  })
  return res.ok
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  setCors(res)
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' })
    return
  }

  const token = bearerToken(req)
  if (!token) {
    sendJson(res, 401, { error: 'Missing auth' })
    return
  }

  const body = (req.body ?? {}) as { ticketId?: unknown }
  if (typeof body.ticketId !== 'string' || !body.ticketId) {
    sendJson(res, 400, { error: 'ticketId required' })
    return
  }

  const rl = checkRateLimit(`cancel:${token.slice(0, 16)}`, {
    maxTokens: 10,
    refillPerSec: 0.2,
  })
  if (!rl.allowed) {
    res.setHeader('retry-after', String(Math.ceil(rl.retryAfterMs / 1000)))
    sendJson(res, 429, { error: 'Too many requests' })
    return
  }

  const url = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!url || !serviceKey) {
    sendJson(res, 500, { error: 'Server misconfigured: Supabase envs missing' })
    return
  }
  const svc = createClient(url, serviceKey, { auth: { persistSession: false } })

  const { data: authData, error: authErr } = await svc.auth.getUser(token)
  if (authErr || !authData?.user) {
    sendJson(res, 401, { error: 'Invalid token' })
    return
  }
  const caller = authData.user

  const { data: ticketData, error: ticketErr } = await svc
    .from('tickets')
    .select('id, user_id, event_id, venue_id, type, status, payment_intent_id')
    .eq('id', body.ticketId)
    .maybeSingle()
  if (ticketErr || !ticketData) {
    sendJson(res, 404, { error: 'Ticket not found' })
    return
  }
  const ticket = ticketData as TicketRow

  if (ticket.user_id !== caller.id) {
    sendJson(res, 403, { error: 'Forbidden' })
    return
  }

  if (ticket.status === 'cancelled') {
    sendJson(res, 200, { data: { status: 'already_cancelled', ticketId: ticket.id } })
    return
  }

  if (ticket.status !== 'pending') {
    sendJson(res, 409, { error: `Cannot cancel ticket in status ${ticket.status}` })
    return
  }

  if (ticket.payment_intent_id && stripeKey) {
    // Best-effort; if Stripe says the intent is already cancelled/succeeded,
    // we still want to reconcile our DB state below.
    await cancelPaymentIntentStripe(ticket.payment_intent_id, stripeKey).catch(() => false)
  }

  const { error: updateErr } = await svc
    .from('tickets')
    .update({ status: 'cancelled' })
    .eq('id', ticket.id)
    .eq('status', 'pending')
  if (updateErr) {
    sendJson(res, 500, { error: 'Could not cancel ticket' })
    return
  }

  // Reconcile capacity: increment events.ticket_types[type].remaining.
  // We read-modify-write; RLS + service role is fine here.
  const { data: eventRow } = await svc
    .from('events')
    .select('id, ticket_types')
    .eq('id', ticket.event_id)
    .maybeSingle()
  if (eventRow && Array.isArray((eventRow as { ticket_types?: unknown }).ticket_types)) {
    type TierRow = { type: string; remaining?: number }
    const tiers = ((eventRow as { ticket_types: TierRow[] }).ticket_types).map(t => {
      if (t.type !== ticket.type) return t
      return { ...t, remaining: (t.remaining ?? 0) + 1 }
    })
    await svc.from('events').update({ ticket_types: tiers }).eq('id', ticket.event_id)
  }

  sendJson(res, 200, { data: { status: 'cancelled', ticketId: ticket.id } })
}
