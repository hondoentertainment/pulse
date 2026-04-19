/**
 * POST /api/webhooks/stripe
 *
 * Receives Stripe events, verifies the `Stripe-Signature` header, and
 * transitions ticket lifecycle:
 *   - `checkout.session.completed` → flip all pending tickets keyed by
 *     `stripe_payment_intent = session.id` to `paid` and replace the stored
 *     reference with the real PaymentIntent id.
 *
 * Idempotency: every event id is logged to `stripe_webhook_events`.
 * Duplicate deliveries from Stripe short-circuit to 200.
 *
 * Env:
 *   STRIPE_WEBHOOK_SECRET  — required
 *   STRIPE_SECRET_KEY      — required (for signature helpers that reuse creds)
 *   SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY — required (admin writes)
 *
 * Raw body is required for signature verification. Vercel exposes the body
 * as a string when `Content-Type: application/json` — if it arrives parsed
 * we re-serialize which invalidates the signature, so callers must POST the
 * unmodified Stripe payload.
 */

import {
  badRequest,
  handlePreflight,
  methodNotAllowed,
  ok,
  readHeader,
  serverError,
  setCors,
  unauthorized,
  type RequestLike,
  type ResponseLike,
} from '../_lib/http'
import {
  parseWebhookEvent,
  verifyWebhookSignature,
  type StripeCheckoutSession,
  type StripeWebhookEvent,
} from '../_lib/stripe'
import { createAdminClient } from '../_lib/supabase-server'

function rawBodyOf(req: RequestLike): string | null {
  const body = req.body
  if (typeof body === 'string') return body
  // Vercel's default body-parser hands us an object for JSON. Signature
  // verification needs the exact bytes Stripe signed, so we surface an
  // explicit null and error out. Deployments must set `api` config on the
  // Edge Function to disable body parsing (see `vercel.json`).
  if (body === undefined || body === null) return null
  try {
    return JSON.stringify(body)
  } catch {
    return null
  }
}

export default async function handler(
  req: RequestLike,
  res: ResponseLike,
): Promise<void> {
  setCors(res)
  if (handlePreflight(req, res)) return
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])

  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) return serverError(res, 'Webhook secret not configured')

  const raw = rawBodyOf(req)
  if (!raw) return badRequest(res, 'Missing raw body')

  const sigHeader = readHeader(req, 'stripe-signature')
  const valid = await verifyWebhookSignature(raw, sigHeader, secret)
  if (!valid) return unauthorized(res, 'Invalid signature')

  const event = parseWebhookEvent(raw)
  if (!event) return badRequest(res, 'Unparseable payload')

  const supabase = createAdminClient()
  if (!supabase) return serverError(res, 'Supabase admin client not configured')

  // Idempotency ledger — unique insert short-circuits replays.
  const { error: ledgerErr } = await supabase
    .from('stripe_webhook_events')
    .insert({
      event_id: event.id,
      type: event.type,
      payload: event,
    })
  if (ledgerErr) {
    // Unique-violation (23505) means already processed — return 200 so Stripe
    // stops retrying. Any other error is surfaced as a 500.
    const code = (ledgerErr as { code?: string }).code
    if (code === '23505') {
      ok(res, { duplicate: true, event_id: event.id })
      return
    }
    return serverError(res, ledgerErr.message ?? 'ledger_insert_failed')
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        await handleCheckoutCompleted(
          event as StripeWebhookEvent<StripeCheckoutSession>,
          supabase,
        )
        break
      }
      default:
        // Unhandled events are ACKed so Stripe stops retrying.
        break
    }
  } catch (err) {
    return serverError(res, err instanceof Error ? err.message : 'webhook_processing_failed')
  }

  ok(res, { received: true, event_id: event.id, type: event.type })
}

async function handleCheckoutCompleted(
  event: StripeWebhookEvent<StripeCheckoutSession>,
  supabase: ReturnType<typeof createAdminClient>,
): Promise<void> {
  if (!supabase) throw new Error('Supabase admin client unavailable')
  const session = event.data.object
  if (session.payment_status && session.payment_status !== 'paid') {
    // Ignore unpaid/no-payment-required completions; only flip to paid when
    // Stripe confirmed payment collection.
    return
  }
  const paymentIntentId = session.payment_intent ?? null
  const sessionId = session.id

  const update: Record<string, unknown> = {
    status: 'paid',
    paid_at: new Date().toISOString(),
  }
  if (paymentIntentId) update.stripe_payment_intent = paymentIntentId

  // Flip every ticket whose reference matches either the checkout session id
  // (our initial insert) or the payment intent id (if a prior partial update
  // already replaced it). Scoped to `pending` so repeated deliveries remain
  // idempotent on the ticket rows too.
  const { error } = await supabase
    .from('tickets')
    .update(update)
    .in('stripe_payment_intent', paymentIntentId ? [sessionId, paymentIntentId] : [sessionId])
    .eq('status', 'pending')

  if (error) throw new Error(error.message ?? 'ticket_status_update_failed')
}
