/**
 * POST /api/stripe/webhook
 *
 * Signature-verified Stripe webhook handler. Idempotent via the
 * `stripe_webhook_events` table. The raw body is required for signature
 * verification; Vercel's default JSON parsing is bypassed via the
 * `config.api.bodyParser = false` export — handlers must read the raw
 * request stream themselves.
 *
 * Events handled:
 *   - payment_intent.succeeded   → flip ticket/reservation to paid/confirmed
 *   - payment_intent.payment_failed → mark ticket cancelled, release capacity
 *   - charge.refunded            → mirror refund state
 *   - account.updated            → sync venue_payout_accounts flags
 */

import {
  badRequest,
  handlePreflight,
  methodNotAllowed,
  serverError,
  type RequestLike,
  type ResponseLike,
  getHeader,
} from '../_lib/http'
import { verifyWebhookSignature } from '../_lib/stripe'
import { getServiceSupabase } from '../_lib/supabase-server'

export const config = { api: { bodyParser: false } }

async function readRawBody(req: RequestLike): Promise<string> {
  const anyReq = req as unknown as {
    text?: () => Promise<string>
    on?: (evt: string, cb: (chunk: unknown) => void) => void
    body?: unknown
  }
  if (typeof anyReq.text === 'function') return await anyReq.text()
  if (typeof anyReq.body === 'string') return anyReq.body
  if (anyReq.body && typeof anyReq.body === 'object') {
    // Vercel node runtime may have already parsed — re-serialise. Signature
    // verification will fail in this case unless bodyParser is disabled.
    return JSON.stringify(anyReq.body)
  }
  return await new Promise<string>((resolve, reject) => {
    if (!anyReq.on) return resolve('')
    const chunks: Buffer[] = []
    anyReq.on('data', c => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(String(c))))
    anyReq.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    anyReq.on('error', (err: unknown) => reject(err as Error))
  })
}

interface StripeEvent {
  id: string
  type: string
  data: { object: Record<string, unknown> }
}

export default async function handler(req: RequestLike, res: ResponseLike): Promise<void> {
  if (handlePreflight(req, res)) return
  if (req.method !== 'POST') return methodNotAllowed(res)

  const signature = getHeader(req, 'stripe-signature')
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) return serverError(res, new Error('STRIPE_WEBHOOK_SECRET not configured'))

  let rawBody = ''
  try {
    rawBody = await readRawBody(req)
  } catch (err) {
    return serverError(res, err)
  }

  const ok = await verifyWebhookSignature(rawBody, signature, secret)
  if (!ok) return badRequest(res, 'invalid_signature')

  let event: StripeEvent
  try {
    event = JSON.parse(rawBody) as StripeEvent
  } catch (err) {
    return badRequest(res, 'invalid_json', err instanceof Error ? err.message : undefined)
  }

  const supabase = getServiceSupabase()
  if (!supabase) return serverError(res, new Error('Supabase not configured'))

  // Idempotency: short-circuit duplicates.
  const { data: existing } = await supabase
    .from('stripe_webhook_events')
    .select('event_id')
    .eq('event_id', event.id)
    .maybeSingle()
  if (existing) {
    res.status(200).json({ received: true, deduped: true })
    return
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handleIntentSucceeded(supabase, event.data.object)
        break
      case 'payment_intent.payment_failed':
        await handleIntentFailed(supabase, event.data.object)
        break
      case 'charge.refunded':
        await handleChargeRefunded(supabase, event.data.object)
        break
      case 'account.updated':
        await handleAccountUpdated(supabase, event.data.object)
        break
      default:
        // Unhandled — still record for idempotency.
        break
    }

    await supabase.from('stripe_webhook_events').insert({
      event_id: event.id,
      type: event.type,
      payload: event,
    })

    res.status(200).json({ received: true })
  } catch (err) {
    serverError(res, err)
  }
}

type SB = NonNullable<ReturnType<typeof getServiceSupabase>>

async function handleIntentSucceeded(supabase: SB, intent: Record<string, unknown>): Promise<void> {
  const intentId = intent['id'] as string
  const metadata = (intent['metadata'] as Record<string, string> | undefined) ?? {}

  // Ticket flow
  const ticketId = metadata['ticket_id']
  if (ticketId) {
    await supabase
      .from('tickets')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', ticketId)
      .eq('stripe_payment_intent', intentId)
    return
  }
  // Reservation deposit flow
  const reservationId = metadata['reservation_id']
  if (reservationId) {
    await supabase
      .from('reservations')
      .update({ status: 'confirmed', updated_at: new Date().toISOString() })
      .eq('id', reservationId)
      .eq('deposit_payment_intent', intentId)
  }
}

async function handleIntentFailed(supabase: SB, intent: Record<string, unknown>): Promise<void> {
  const intentId = intent['id'] as string
  // Release ticket capacity by cancelling the pending row. Capacity
  // reconciliation is handled in a separate reconciler — out of scope here.
  await supabase
    .from('tickets')
    .update({ status: 'cancelled' })
    .eq('stripe_payment_intent', intentId)
}

async function handleChargeRefunded(supabase: SB, charge: Record<string, unknown>): Promise<void> {
  const intentId = charge['payment_intent'] as string | undefined
  if (!intentId) return
  await supabase
    .from('tickets')
    .update({ status: 'refunded', refunded_at: new Date().toISOString() })
    .eq('stripe_payment_intent', intentId)
}

async function handleAccountUpdated(supabase: SB, account: Record<string, unknown>): Promise<void> {
  const accountId = account['id'] as string
  const detailsSubmitted = !!account['details_submitted']
  const chargesEnabled = !!account['charges_enabled']
  const payoutsEnabled = !!account['payouts_enabled']
  const requirements = (account['requirements'] as { disabled_reason?: string | null } | undefined) ?? {}

  let status: 'pending' | 'active' | 'restricted' = 'pending'
  if (chargesEnabled && payoutsEnabled) status = 'active'
  else if (requirements.disabled_reason) status = 'restricted'

  await supabase
    .from('venue_payout_accounts')
    .update({
      status,
      charges_enabled: chargesEnabled,
      payouts_enabled: payoutsEnabled,
      details_submitted: detailsSubmitted,
      disabled_reason: requirements.disabled_reason ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_account_id', accountId)
}
