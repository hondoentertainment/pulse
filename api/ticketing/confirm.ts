/**
 * POST /api/ticketing/confirm
 *
 * Called after the browser completes PaymentIntent confirmation
 * (stripe.confirmCardPayment). Verifies the intent really succeeded,
 * flips the ticket to `paid`, and generates the QR secret.
 *
 * Webhook remains the source of truth (see api/stripe/webhook.ts) —
 * this endpoint is an optimistic fast-path for the user's success screen.
 *
 * Body: { ticket_id: uuid, payment_intent_id: string }
 */

import { createClient } from '@supabase/supabase-js'
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
import { generateQrSecret, retrievePaymentIntent } from '../_lib/stripe'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function handler(req: RequestLike, res: ResponseLike): Promise<void> {
  if (handlePreflight(req, res)) return
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST', 'OPTIONS'])

  const auth = await verifySupabaseJwt(req)
  if (!auth.ok || !auth.user) return unauthorized(res, auth.error ?? 'Unauthorized')
  const userId = auth.user.id

  const body = (req.body ?? {}) as { ticket_id?: unknown; payment_intent_id?: unknown }
  const errors: string[] = []
  if (typeof body.ticket_id !== 'string' || !UUID_RE.test(body.ticket_id)) {
    errors.push('ticket_id must be a uuid')
  }
  if (typeof body.payment_intent_id !== 'string' || !body.payment_intent_id.trim()) {
    errors.push('payment_intent_id must be a non-empty string')
  }
  if (errors.length) return badRequest(res, 'validation_failed', errors)

  const ticket_id = body.ticket_id as string
  const payment_intent_id = body.payment_intent_id as string

  const url = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return serverError(res, 'Supabase not configured')
  }
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } })

  try {
    const { data: ticket, error: ticketErr } = await supabase
      .from('tickets')
      .select('id, user_id, status, stripe_payment_intent')
      .eq('id', ticket_id)
      .maybeSingle()
    if (ticketErr) return serverError(res, ticketErr.message)
    if (!ticket) {
      res.status(404).json({ error: 'ticket_not_found' })
      return
    }
    if (ticket.user_id !== userId) return forbidden(res)
    if (ticket.stripe_payment_intent !== payment_intent_id) {
      return badRequest(res, 'payment_intent_mismatch')
    }
    if (ticket.status === 'paid') {
      res.status(200).json({ data: { ticket_id, status: 'paid', already_confirmed: true } })
      return
    }

    const intent = await retrievePaymentIntent(payment_intent_id)
    if (intent.status !== 'succeeded') {
      res.status(200).json({ data: { ticket_id, status: ticket.status, stripe_status: intent.status } })
      return
    }

    const serverSecret = process.env.QR_SECRET ?? process.env.STRIPE_SECRET_KEY ?? 'dev-qr-secret'
    const qr = await generateQrSecret(ticket_id, userId, serverSecret)

    const { error: updErr } = await supabase
      .from('tickets')
      .update({
        status: 'paid',
        qr_code_secret: qr,
        paid_at: new Date().toISOString(),
      })
      .eq('id', ticket_id)
    if (updErr) return serverError(res, updErr.message)

    res.status(200).json({ data: { ticket_id, status: 'paid', qr_code_secret: qr } })
  } catch (err) {
    serverError(res, err instanceof Error ? err.message : 'Internal error')
  }
}
