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
 *   - payment_intent.succeeded         → flip ticket/reservation to paid/confirmed
 *   - payment_intent.payment_failed    → mark ticket cancelled, release capacity
 *   - payment_intent.canceled          → mark ticket cancelled, release capacity
 *   - charge.refunded                  → mirror refund state
 *   - charge.dispute.created           → insert `ticket_disputes` row, flip ticket to `disputed`
 *   - charge.dispute.closed            → update dispute row + ticket status from outcome
 *   - charge.dispute.funds_withdrawn   → note funds withdrawn on dispute row
 *   - charge.dispute.funds_reinstated  → note funds reinstated on dispute row
 *   - account.updated                  → sync venue_payout_accounts flags
 *
 * Unknown types are logged and persisted to the idempotency ledger.
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
import type { SupabaseClient } from '@supabase/supabase-js'

export const config = { api: { bodyParser: false } }

type SB = SupabaseClient

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

/** Dispatches event types to individual handlers. Exported for tests. */
export async function dispatchWebhookEvent(
  supabase: SB,
  event: StripeEvent,
  log: (msg: string, meta?: Record<string, unknown>) => void = (msg, meta) =>
    console.info(`[stripe/webhook] ${msg}`, meta ?? {}),
): Promise<{ handled: boolean; type: string }> {
  const obj = event.data.object
  switch (event.type) {
    case 'payment_intent.succeeded':
      await handleIntentSucceeded(supabase, obj)
      return { handled: true, type: event.type }
    case 'payment_intent.payment_failed':
      await handleIntentFailedOrCanceled(supabase, obj, 'payment_failed')
      return { handled: true, type: event.type }
    case 'payment_intent.canceled':
      await handleIntentFailedOrCanceled(supabase, obj, 'canceled')
      return { handled: true, type: event.type }
    case 'charge.refunded':
      await handleChargeRefunded(supabase, obj)
      return { handled: true, type: event.type }
    case 'charge.dispute.created':
      await handleDisputeCreated(supabase, obj)
      return { handled: true, type: event.type }
    case 'charge.dispute.closed':
      await handleDisputeClosed(supabase, obj)
      return { handled: true, type: event.type }
    case 'charge.dispute.funds_withdrawn':
      await handleDisputeFundsChange(supabase, obj, 'withdrawn')
      return { handled: true, type: event.type }
    case 'charge.dispute.funds_reinstated':
      await handleDisputeFundsChange(supabase, obj, 'reinstated')
      return { handled: true, type: event.type }
    case 'account.updated':
      await handleAccountUpdated(supabase, obj)
      return { handled: true, type: event.type }
    default:
      log('unknown-event-type', { type: event.type, id: event.id })
      return { handled: false, type: event.type }
  }
}

export default async function handler(req: RequestLike, res: ResponseLike): Promise<void> {
  if (handlePreflight(req, res)) return
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])

  const signature = getHeader(req, 'stripe-signature')
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) return serverError(res, 'STRIPE_WEBHOOK_SECRET not configured')

  let rawBody = ''
  try {
    rawBody = await readRawBody(req)
  } catch (err) {
    return serverError(res, 'read_body_failed', err instanceof Error ? err.message : String(err))
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
  if (!supabase) return serverError(res, 'Supabase not configured')

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
    const result = await dispatchWebhookEvent(supabase, event)

    await supabase.from('stripe_webhook_events').insert({
      event_id: event.id,
      type: event.type,
      payload: event,
    })

    res.status(200).json({ received: true, handled: result.handled })
  } catch (err) {
    serverError(res, 'webhook_handler_error', err instanceof Error ? err.message : String(err))
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Payment intent handlers
// ────────────────────────────────────────────────────────────────────────────

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

/**
 * Handle both `payment_intent.payment_failed` and `payment_intent.canceled`.
 *
 * On failure/cancellation we flip the ticket row to cancelled and
 * re-increment the corresponding `events.ticket_types[*].remaining`
 * counter to release capacity. This is best-effort — the nightly
 * reconciler (`api/ticketing/expire-pending.ts`) will pick up any
 * tickets we miss.
 */
export async function handleIntentFailedOrCanceled(
  supabase: SB,
  intent: Record<string, unknown>,
  reason: 'payment_failed' | 'canceled',
): Promise<void> {
  const intentId = intent['id'] as string
  if (!intentId) return
  const metadata = (intent['metadata'] as Record<string, string> | undefined) ?? {}
  const ticketId = metadata['ticket_id']

  // Fetch the ticket first so we have event_id + type for capacity reconciliation.
  let ticketRow:
    | { id: string; event_id: string; ticket_type: string; status: string }
    | null = null
  if (ticketId) {
    const { data } = await supabase
      .from('tickets')
      .select('id, event_id, ticket_type, status')
      .eq('id', ticketId)
      .maybeSingle()
    ticketRow = (data as typeof ticketRow) ?? null
  }
  if (!ticketRow) {
    const { data } = await supabase
      .from('tickets')
      .select('id, event_id, ticket_type, status')
      .eq('stripe_payment_intent', intentId)
      .maybeSingle()
    ticketRow = (data as typeof ticketRow) ?? null
  }

  if (!ticketRow) {
    // No ticket match — maybe this intent was for a reservation deposit.
    await supabase
      .from('reservations')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('deposit_payment_intent', intentId)
    return
  }

  if (ticketRow.status === 'cancelled' || ticketRow.status === 'refunded') return

  await supabase
    .from('tickets')
    .update({
      status: 'cancelled',
      cancellation_reason: reason,
    })
    .eq('id', ticketRow.id)
    .in('status', ['pending', 'paid'])

  await releaseCapacity(supabase, ticketRow.event_id, ticketRow.ticket_type)
}

async function releaseCapacity(
  supabase: SB,
  eventId: string,
  ticketType: string,
): Promise<void> {
  const { data: eventRow } = await supabase
    .from('events')
    .select('id, ticket_types')
    .eq('id', eventId)
    .maybeSingle()
  if (!eventRow) return
  const types = (eventRow as { ticket_types?: unknown }).ticket_types
  if (!Array.isArray(types)) return
  type Tier = { type?: string; name?: string; remaining?: number }
  const next = (types as Tier[]).map(t => {
    const tType = t.type ?? t.name
    if (tType !== ticketType) return t
    return { ...t, remaining: (t.remaining ?? 0) + 1 }
  })
  await supabase.from('events').update({ ticket_types: next }).eq('id', eventId)
}

// ────────────────────────────────────────────────────────────────────────────
// Charge / dispute handlers
// ────────────────────────────────────────────────────────────────────────────

async function handleChargeRefunded(supabase: SB, charge: Record<string, unknown>): Promise<void> {
  const intentId = charge['payment_intent'] as string | undefined
  if (!intentId) return
  await supabase
    .from('tickets')
    .update({ status: 'refunded', refunded_at: new Date().toISOString() })
    .eq('stripe_payment_intent', intentId)
}

interface StripeDispute {
  id?: string
  charge?: string
  payment_intent?: string
  reason?: string
  amount?: number
  evidence_details?: { due_by?: number }
  status?: string
}

export async function handleDisputeCreated(
  supabase: SB,
  dispute: Record<string, unknown>,
): Promise<void> {
  const d = dispute as StripeDispute
  if (!d.charge) return
  const ticketId = await lookupTicketIdForDispute(supabase, d)

  const evidenceDueBy = d.evidence_details?.due_by
    ? new Date(d.evidence_details.due_by * 1000).toISOString()
    : null

  await supabase.from('ticket_disputes').upsert(
    {
      charge_id: d.charge,
      ticket_id: ticketId,
      reason: d.reason ?? 'unknown',
      amount_cents: d.amount ?? 0,
      evidence_due_by: evidenceDueBy,
      status: d.status ?? 'needs_response',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'charge_id' },
  )

  if (ticketId) {
    await supabase
      .from('tickets')
      .update({ status: 'disputed', disputed_at: new Date().toISOString() })
      .eq('id', ticketId)
  }
}

export async function handleDisputeClosed(
  supabase: SB,
  dispute: Record<string, unknown>,
): Promise<void> {
  const d = dispute as StripeDispute
  if (!d.charge) return
  const ticketId = await lookupTicketIdForDispute(supabase, d)

  await supabase
    .from('ticket_disputes')
    .update({
      status: d.status ?? 'closed',
      updated_at: new Date().toISOString(),
    })
    .eq('charge_id', d.charge)

  // Outcome-dependent ticket status: if merchant won (status == 'won') we
  // restore the paid state; if lost, we treat it as refunded (Stripe
  // withdrew funds); `warning_*` outcomes leave the ticket disputed.
  if (ticketId) {
    if (d.status === 'won') {
      await supabase
        .from('tickets')
        .update({ status: 'paid' })
        .eq('id', ticketId)
        .eq('status', 'disputed')
    } else if (d.status === 'lost') {
      await supabase
        .from('tickets')
        .update({ status: 'refunded', refunded_at: new Date().toISOString() })
        .eq('id', ticketId)
    }
  }
}

export async function handleDisputeFundsChange(
  supabase: SB,
  dispute: Record<string, unknown>,
  direction: 'withdrawn' | 'reinstated',
): Promise<void> {
  const d = dispute as StripeDispute
  if (!d.charge) return
  await supabase
    .from('ticket_disputes')
    .update({
      status:
        direction === 'withdrawn' ? 'funds_withdrawn' : 'funds_reinstated',
      updated_at: new Date().toISOString(),
    })
    .eq('charge_id', d.charge)
}

async function lookupTicketIdForDispute(
  supabase: SB,
  dispute: StripeDispute,
): Promise<string | null> {
  if (dispute.payment_intent) {
    const { data } = await supabase
      .from('tickets')
      .select('id')
      .eq('stripe_payment_intent', dispute.payment_intent)
      .maybeSingle()
    if (data?.id) return data.id as string
  }
  return null
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
