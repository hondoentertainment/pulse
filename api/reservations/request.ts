/**
 * POST /api/reservations/request
 *
 * Creates a reservation row in `requested` state. If `deposit_cents > 0`
 * and the venue is onboarded to Stripe Connect, a PaymentIntent is created
 * to hold the deposit. The staff-side `update` endpoint confirms or cancels.
 *
 * Body: {
 *   venue_id: uuid,
 *   party_size: int,
 *   starts_at: iso,
 *   ends_at?: iso,
 *   notes?: string,
 *   deposit_cents?: int
 * }
 */

import { authenticate } from '../_lib/auth'
import {
  badRequest,
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
import { isIsoDate, isNonNegativeInt, isPositiveInt, isUuid, requireFields } from '../_lib/validate'

export default async function handler(req: RequestLike, res: ResponseLike): Promise<void> {
  if (handlePreflight(req, res)) return
  if (req.method !== 'POST') return methodNotAllowed(res)

  const auth = await authenticate(req)
  if (!auth) return unauthorized(res)

  const rl = rateLimit('reservations:request', auth.userId, 30, 60_000)
  if (!rl.ok) {
    res.status(429).json({ error: 'Rate limit exceeded', resetAt: rl.resetAt })
    return
  }

  const errors = requireFields(req.body, {
    venue_id: isUuid,
    party_size: isPositiveInt,
    starts_at: isIsoDate,
  })
  if (errors.length) return badRequest(res, 'validation_failed', errors)

  const body = req.body as {
    venue_id: string
    party_size: number
    starts_at: string
    ends_at?: string
    notes?: string
    deposit_cents?: number
  }

  const deposit = body.deposit_cents ?? 0
  if (!isNonNegativeInt(deposit)) return badRequest(res, 'invalid_deposit')

  const supabase = getServiceSupabase()
  if (!supabase) return serverError(res, new Error('Supabase not configured'))

  try {
    const { data: venue } = await supabase
      .from('venues')
      .select('id')
      .eq('id', body.venue_id)
      .maybeSingle()
    if (!venue) return notFound(res, 'venue_not_found')

    const { data: reservation, error: insertErr } = await supabase
      .from('reservations')
      .insert({
        venue_id: body.venue_id,
        user_id: auth.userId,
        party_size: body.party_size,
        starts_at: body.starts_at,
        ends_at: body.ends_at ?? null,
        notes: body.notes ?? null,
        deposit_cents: deposit,
        status: 'requested',
      })
      .select('id')
      .single()
    if (insertErr || !reservation) return serverError(res, insertErr ?? new Error('insert_failed'))

    let clientSecret: string | undefined
    let paymentIntentId: string | undefined

    if (deposit > 0) {
      const { data: payout } = await supabase
        .from('venue_payout_accounts')
        .select('stripe_account_id')
        .eq('venue_id', body.venue_id)
        .maybeSingle()

      const intent = await createPaymentIntent({
        amountCents: deposit,
        currency: 'usd',
        applicationFeeCents: payout?.stripe_account_id ? calculatePlatformFeeCents(deposit) : undefined,
        destinationAccountId: payout?.stripe_account_id ?? undefined,
        metadata: {
          reservation_id: reservation.id,
          venue_id: body.venue_id,
          user_id: auth.userId,
          kind: 'reservation_deposit',
        },
        idempotencyKey: `reservation:${reservation.id}`,
      })

      clientSecret = intent.client_secret
      paymentIntentId = intent.id

      await supabase
        .from('reservations')
        .update({ deposit_payment_intent: intent.id })
        .eq('id', reservation.id)
    }

    res.status(200).json({
      data: {
        reservation_id: reservation.id,
        status: 'requested',
        client_secret: clientSecret,
        payment_intent_id: paymentIntentId,
        deposit_cents: deposit,
      },
    })
  } catch (err) {
    serverError(res, err)
  }
}
