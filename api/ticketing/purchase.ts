/**
 * POST /api/ticketing/purchase
 *
 * Authenticated endpoint that creates a Stripe Checkout Session for an event
 * ticket purchase and records a pending `tickets` row keyed by the session id.
 *
 * Flow:
 *   1. Require a Supabase bearer token (`verifySupabaseJwt`).
 *   2. Rate-limit per user (sliding-window).
 *   3. Validate body: { eventId: uuid, quantity: int [1..10], successUrl?, cancelUrl? }.
 *   4. Load the event via service-role Supabase (need to read regardless of RLS
 *      ownership). Require `status === 'published'` and non-deleted.
 *   5. Pick the first ticket tier with remaining capacity (events use
 *      `cover_price_cents` fallback if no tiers are configured).
 *   6. Insert a `tickets` row with status `pending`.
 *   7. Create a Stripe Checkout Session with line_items from the price tier;
 *      store the session id on the ticket (via `stripe_payment_intent` field,
 *      which we repurpose as the external Stripe reference until we add a
 *      dedicated column).
 *   8. Return { checkoutUrl, sessionId, ticketId }.
 *
 * The webhook at `/api/webhooks/stripe` transitions the ticket to `paid` and
 * attaches the real PaymentIntent id on `checkout.session.completed`.
 */

import {
  badRequest,
  forbidden,
  handlePreflight,
  methodNotAllowed,
  notFound,
  serverError,
  tooManyRequests,
  unauthorized,
  type RequestLike,
  type ResponseLike,
} from '../_lib/http'
import { calculatePlatformFeeCents } from '../_lib/fees'
import { rateLimit } from '../_lib/rate-limit'
import { createCheckoutSession } from '../_lib/stripe'
import { createAdminClient } from '../_lib/supabase-server'
import { verifySupabaseJwt } from '../_lib/auth'
import { asHttpsUrl, asInteger, asUuid, isPlainObject } from '../_lib/validate'

interface TicketTypeDef {
  name: string
  price_cents: number
  qty?: number
  remaining?: number
}

interface EventRow {
  id: string
  venue_id: string
  title?: string | null
  status: string
  currency?: string | null
  cover_price_cents?: number | null
  ticket_types?: unknown
  deleted_at?: string | null
  starts_at?: string | null
}

interface PurchaseBody {
  eventId: string
  quantity: number
  successUrl?: string
  cancelUrl?: string
  ticketType?: string
}

function parseBody(raw: unknown): { body: PurchaseBody | null; errors: string[] } {
  if (!isPlainObject(raw)) return { body: null, errors: ['body must be an object'] }
  const errors: string[] = []
  const eventId = asUuid(raw.eventId)
  if (!eventId) errors.push('eventId must be a uuid')
  const quantity = asInteger(raw.quantity, { min: 1, max: 10 })
  if (quantity === null) errors.push('quantity must be an integer between 1 and 10')

  let successUrl: string | undefined
  if (raw.successUrl !== undefined) {
    const parsed = asHttpsUrl(raw.successUrl)
    if (!parsed) errors.push('successUrl must be an http(s) url')
    else successUrl = parsed
  }

  let cancelUrl: string | undefined
  if (raw.cancelUrl !== undefined) {
    const parsed = asHttpsUrl(raw.cancelUrl)
    if (!parsed) errors.push('cancelUrl must be an http(s) url')
    else cancelUrl = parsed
  }

  let ticketType: string | undefined
  if (raw.ticketType !== undefined) {
    if (typeof raw.ticketType !== 'string' || !raw.ticketType) {
      errors.push('ticketType must be a non-empty string')
    } else {
      ticketType = raw.ticketType
    }
  }

  if (errors.length || !eventId || quantity === null) {
    return { body: null, errors }
  }
  return {
    body: { eventId, quantity, successUrl, cancelUrl, ticketType },
    errors,
  }
}

function pickTier(event: EventRow, requested?: string): {
  name: string
  priceCents: number
  capacityRemaining?: number
} | null {
  const tiers = Array.isArray(event.ticket_types) ? (event.ticket_types as TicketTypeDef[]) : []
  if (tiers.length > 0) {
    if (requested) {
      const match = tiers.find(t => t.name === requested)
      if (!match) return null
      return {
        name: match.name,
        priceCents: match.price_cents,
        capacityRemaining: match.remaining,
      }
    }
    const first = tiers.find(t => (t.remaining ?? 1) > 0) ?? tiers[0]
    return {
      name: first.name,
      priceCents: first.price_cents,
      capacityRemaining: first.remaining,
    }
  }
  // Fall back to event-level cover price.
  const cover = event.cover_price_cents ?? 0
  return { name: requested ?? 'general_admission', priceCents: cover }
}

export default async function handler(
  req: RequestLike,
  res: ResponseLike,
): Promise<void> {
  if (handlePreflight(req, res)) return
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST', 'OPTIONS'])

  const auth = await verifySupabaseJwt(req)
  if (!auth.ok || !auth.user) return unauthorized(res, auth.error ?? 'Unauthorized')
  const userId = auth.user.id

  const rl = rateLimit(`ticketing:purchase:${userId}`, 20, 60_000)
  if (!rl.allowed) {
    return tooManyRequests(res, 'Too many purchase attempts', rl.retryAfterSeconds)
  }

  const { body, errors } = parseBody(req.body)
  if (!body) return badRequest(res, 'validation_failed', errors)

  const supabase = createAdminClient()
  if (!supabase) return serverError(res, 'Supabase admin client not configured')

  try {
    const { data: eventData, error: eventErr } = await supabase
      .from('events')
      .select('id, venue_id, title, status, currency, cover_price_cents, ticket_types, deleted_at, starts_at')
      .eq('id', body.eventId)
      .maybeSingle()

    if (eventErr) return serverError(res, eventErr.message ?? 'event_lookup_failed')
    const event = eventData as EventRow | null
    if (!event || event.deleted_at) return notFound(res, 'event_not_found')
    if (event.status !== 'published') return forbidden(res, 'event_not_purchasable')

    const tier = pickTier(event, body.ticketType)
    if (!tier) return badRequest(res, 'ticket_type_not_found')
    if (tier.priceCents <= 0) return badRequest(res, 'event_is_free_no_checkout_needed')
    if (tier.capacityRemaining !== undefined && tier.capacityRemaining < body.quantity) {
      return badRequest(res, 'sold_out')
    }

    const currency = (event.currency ?? 'usd').toLowerCase()
    const unitPriceCents = tier.priceCents
    const totalCents = unitPriceCents * body.quantity
    const applicationFeeCents = calculatePlatformFeeCents(totalCents)

    // Look up payout account for destination charge (optional — if the venue
    // hasn't onboarded we take the charge on the platform and settle later).
    const { data: payoutData } = await supabase
      .from('venue_payout_accounts')
      .select('stripe_account_id, payouts_enabled')
      .eq('venue_id', event.venue_id)
      .maybeSingle()
    const destinationAccountId =
      (payoutData as { stripe_account_id?: string | null } | null)?.stripe_account_id ?? undefined

    // Insert one pending ticket row per quantity. We return the *first* id to
    // the client; the webhook marks all of them paid atomically.
    const inserts = Array.from({ length: body.quantity }, () => ({
      event_id: event.id,
      user_id: userId,
      ticket_type: tier.name,
      price_cents: unitPriceCents,
      currency,
      status: 'pending' as const,
    }))

    const { data: insertedTickets, error: insertErr } = await supabase
      .from('tickets')
      .insert(inserts)
      .select('id')

    if (insertErr || !insertedTickets || insertedTickets.length === 0) {
      return serverError(res, insertErr?.message ?? 'ticket_insert_failed')
    }

    const ticketIds = (insertedTickets as Array<{ id: string }>).map(t => t.id)
    const primaryTicketId = ticketIds[0]

    const origin = pickOrigin(req)
    const successUrl =
      body.successUrl ?? `${origin}/my-tickets?session_id={CHECKOUT_SESSION_ID}`
    const cancelUrl = body.cancelUrl ?? `${origin}/venues/${event.venue_id}?ticket_cancelled=1`

    let session
    try {
      session = await createCheckoutSession({
        lineItems: [
          {
            name: event.title ?? 'Event ticket',
            description: tier.name,
            amountCents: unitPriceCents,
            currency,
            quantity: body.quantity,
          },
        ],
        successUrl,
        cancelUrl,
        clientReferenceId: primaryTicketId,
        customerEmail: auth.user.email,
        metadata: {
          ticket_id: primaryTicketId,
          ticket_ids: ticketIds.join(','),
          event_id: event.id,
          user_id: userId,
          venue_id: event.venue_id,
          quantity: String(body.quantity),
        },
        applicationFeeCents: destinationAccountId ? applicationFeeCents : undefined,
        destinationAccountId,
      })
    } catch (err) {
      // Roll back pending tickets — Stripe failure must not leave orphans.
      await supabase.from('tickets').delete().in('id', ticketIds)
      return serverError(res, err instanceof Error ? err.message : 'stripe_session_failed')
    }

    // Persist the session id on every ticket row so the webhook can find them.
    const { error: updErr } = await supabase
      .from('tickets')
      .update({ stripe_payment_intent: session.id })
      .in('id', ticketIds)

    if (updErr) {
      return serverError(res, updErr.message ?? 'ticket_update_failed')
    }

    res.status(200).json({
      data: {
        checkoutUrl: session.url,
        sessionId: session.id,
        ticketId: primaryTicketId,
        ticketIds,
      },
    })
  } catch (err) {
    serverError(res, err instanceof Error ? err.message : 'internal_error')
  }
}

function pickOrigin(req: RequestLike): string {
  const headers = req.headers ?? {}
  const origin = (headers['origin'] ?? headers['Origin']) as string | undefined
  if (typeof origin === 'string' && origin) return origin
  const host = (headers['host'] ?? headers['Host']) as string | undefined
  const proto = (headers['x-forwarded-proto'] ?? headers['X-Forwarded-Proto']) as string | undefined
  if (typeof host === 'string' && host) return `${proto ?? 'https'}://${host}`
  return 'https://app.pulse.local'
}
