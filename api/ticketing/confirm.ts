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
import { generateQrSecret, retrievePaymentIntent } from '../_lib/stripe'
import { getServiceSupabase } from '../_lib/supabase-server'
import { isString, isUuid, requireFields } from '../_lib/validate'

export default async function handler(req: RequestLike, res: ResponseLike): Promise<void> {
  if (handlePreflight(req, res)) return
  if (req.method !== 'POST') return methodNotAllowed(res)

  const auth = await authenticate(req)
  if (!auth) return unauthorized(res)

  const errors = requireFields(req.body, {
    ticket_id: isUuid,
    payment_intent_id: isString,
  })
  if (errors.length) return badRequest(res, 'validation_failed', errors)

  const { ticket_id, payment_intent_id } = req.body as {
    ticket_id: string
    payment_intent_id: string
  }

  const supabase = getServiceSupabase()
  if (!supabase) return serverError(res, new Error('Supabase not configured'))

  try {
    const { data: ticket, error: ticketErr } = await supabase
      .from('tickets')
      .select('id, user_id, status, stripe_payment_intent')
      .eq('id', ticket_id)
      .maybeSingle()
    if (ticketErr) return serverError(res, ticketErr)
    if (!ticket) return notFound(res, 'ticket_not_found')
    if (ticket.user_id !== auth.userId) return forbidden(res)
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
    const qr = await generateQrSecret(ticket_id, auth.userId, serverSecret)

    const { error: updErr } = await supabase
      .from('tickets')
      .update({
        status: 'paid',
        qr_code_secret: qr,
        paid_at: new Date().toISOString(),
      })
      .eq('id', ticket_id)
    if (updErr) return serverError(res, updErr)

    res.status(200).json({ data: { ticket_id, status: 'paid', qr_code_secret: qr } })
  } catch (err) {
    serverError(res, err)
  }
}
