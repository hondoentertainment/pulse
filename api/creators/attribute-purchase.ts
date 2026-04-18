/**
 * POST /api/creators/attribute-purchase (SERVICE-ROLE ONLY)
 *
 * Called by `api/ticketing/confirm.ts` or the Stripe webhook when a ticket
 * is paid.  Body:
 *   {
 *     buyer_user_id: string,
 *     ticket_id: string,
 *     price_cents: number,
 *     venue_id?: string,
 *     commission_rate?: number   // optional override
 *   }
 *
 * Behavior:
 *  - Picks the most-recent pending referral_attributions row for the buyer,
 *    within the 30-day window (see referral-attribution.ts).
 *  - Rejects if the code is venue-scoped and the venue doesn't match.
 *  - Rejects self-referral as defense-in-depth.
 *  - Computes commission_cents = price_cents * rate (default 10%) and flips
 *    status='held'.
 *
 * Commission formula:  commission_cents = round(price_cents * rate)
 * Default rate:        0.10 (10%)
 *
 * This endpoint is NEVER called directly from the client; it is intentionally
 * gated behind the service-role key so attributions cannot be forged.  The
 * caller passes the platform service-role bearer.
 */
import {
  RequestLike,
  ResponseLike,
  setCors,
  jsonError,
} from './_shared'
import { getStore } from './_store'
import {
  DEFAULT_COMMISSION_RATE,
  computeCommissionCents,
  isSelfReferral,
  isWithinAttributionWindow,
} from '../_lib/referral-attribution'

type AttributeBody = {
  buyer_user_id?: string
  ticket_id?: string
  price_cents?: number
  venue_id?: string
  commission_rate?: number
}

function hasServiceRoleKey(req: RequestLike): boolean {
  const header = req.headers?.['x-service-role-key'] ?? req.headers?.['X-Service-Role-Key']
  const expected = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!expected || typeof header !== 'string') return false
  return header === expected
}

export default function handler(req: RequestLike, res: ResponseLike) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return jsonError(res, 405, 'Method not allowed')

  if (!hasServiceRoleKey(req)) return jsonError(res, 403, 'Forbidden')

  const body = (req.body ?? {}) as AttributeBody
  if (!body.buyer_user_id || !body.ticket_id || typeof body.price_cents !== 'number') {
    return jsonError(res, 400, 'buyer_user_id, ticket_id, price_cents required')
  }

  const store = getStore()
  const rate =
    typeof body.commission_rate === 'number' && body.commission_rate > 0
      ? body.commission_rate
      : DEFAULT_COMMISSION_RATE

  // Find eligible pending attributions, most-recent wins.
  const pendings = Array.from(store.attributions.values())
    .filter(
      (a) =>
        a.referred_user_id === body.buyer_user_id &&
        a.status === 'pending' &&
        isWithinAttributionWindow(a.created_at)
    )
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )

  for (const attribution of pendings) {
    const codeRow = store.codes.get(attribution.code)
    if (!codeRow) continue

    // venue-scope guard
    if (codeRow.venue_id && body.venue_id && codeRow.venue_id !== body.venue_id) {
      continue
    }
    // defense-in-depth self-referral
    if (isSelfReferral(codeRow.creator_user_id, body.buyer_user_id!)) {
      attribution.status = 'voided'
      attribution.resolved_at = new Date().toISOString()
      store.attributions.set(attribution.id, attribution)
      continue
    }

    attribution.attributed_ticket_id = body.ticket_id!
    attribution.commission_cents = computeCommissionCents(body.price_cents!, rate)
    attribution.status = 'held'
    attribution.resolved_at = new Date().toISOString()
    store.attributions.set(attribution.id, attribution)

    // best-effort earnings cache bump
    const profile = store.profiles.get(codeRow.creator_user_id)
    if (profile) {
      profile.total_earnings_cents += attribution.commission_cents
      profile.updated_at = new Date().toISOString()
      store.profiles.set(profile.user_id, profile)
    }

    return res.status(200).json({ data: attribution })
  }

  return res.status(200).json({ data: null, reason: 'no-pending-attribution' })
}
