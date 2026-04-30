/**
 * POST /api/creators/apply-referral
 *
 * Authenticated user enters a referral code (at onboarding or at checkout).
 * Creates a referral_attributions row with status='pending' and no ticket
 * linked yet.  The later `attribute-purchase.ts` step links the ticket.
 *
 * Rejects:
 *  - unknown / inactive / expired / maxed-out codes
 *  - self-referral (code owner == applying user)
 *  - duplicate pending rows for the same user+code (idempotent)
 */
import {
  RequestLike,
  ResponseLike,
  setCors,
  requireAuth,
  rateLimit,
  jsonError,
} from './_shared'
import { getStore, ReferralAttributionRow } from './_store'
import { isSelfReferral } from '../_lib/referral-attribution'

type ApplyBody = { code?: string }

export default function handler(req: RequestLike, res: ResponseLike) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return jsonError(res, 405, 'Method not allowed')

  const authed = requireAuth(req, res)
  if (!authed) return

  const rl = rateLimit(`apply-ref:${authed.userId}`, 10, 24 * 60 * 60 * 1000)
  if (!rl.allowed) return jsonError(res, 429, 'Rate limit exceeded')

  const body = (req.body ?? {}) as ApplyBody
  const code =
    typeof body.code === 'string' ? body.code.trim().toUpperCase() : ''
  if (!/^[A-Z0-9]{6,8}$/.test(code)) {
    return jsonError(res, 400, 'invalid code format')
  }

  const store = getStore()
  const codeRow = store.codes.get(code)
  if (!codeRow || !codeRow.is_active) {
    return jsonError(res, 404, 'code not found or inactive')
  }

  const now = new Date()
  if (codeRow.valid_to && new Date(codeRow.valid_to) < now) {
    return jsonError(res, 410, 'code expired')
  }
  if (codeRow.max_uses && codeRow.uses_count >= codeRow.max_uses) {
    return jsonError(res, 410, 'code fully redeemed')
  }

  if (isSelfReferral(codeRow.creator_user_id, authed.userId)) {
    return jsonError(res, 400, 'cannot apply your own code')
  }

  // Idempotency: if the user already has a pending row for this code, return it.
  const existing = Array.from(store.attributions.values()).find(
    (a) =>
      a.referred_user_id === authed.userId &&
      a.code === code &&
      a.status === 'pending'
  )
  if (existing) return res.status(200).json({ data: existing })

  const id = `attr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const row: ReferralAttributionRow = {
    id,
    code,
    referred_user_id: authed.userId,
    attributed_ticket_id: null,
    attributed_reservation_id: null,
    commission_cents: 0,
    status: 'pending',
    created_at: now.toISOString(),
    resolved_at: null,
  }
  store.attributions.set(id, row)
  codeRow.uses_count += 1
  store.codes.set(code, codeRow)

  res.status(201).json({ data: row })
}
