/**
 * GET /api/creators/me
 *
 * Returns the authenticated user's creator_profile plus lifetime stats
 * aggregated from referral_attributions.
 */
import {
  RequestLike,
  ResponseLike,
  setCors,
  requireAuth,
  jsonError,
} from './_shared'
import { getStore } from './_store'

export default function handler(req: RequestLike, res: ResponseLike) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return jsonError(res, 405, 'Method not allowed')

  const authed = requireAuth(req, res)
  if (!authed) return

  const store = getStore()
  const profile = store.profiles.get(authed.userId) ?? null

  // Codes owned by the creator
  const codes = Array.from(store.codes.values()).filter(
    (c) => c.creator_user_id === authed.userId
  )
  const codeSet = new Set(codes.map((c) => c.code))

  const attributions = Array.from(store.attributions.values()).filter((a) =>
    codeSet.has(a.code)
  )

  const heldCents = attributions
    .filter((a) => a.status === 'held')
    .reduce((s, a) => s + a.commission_cents, 0)
  const paidCents = attributions
    .filter((a) => a.status === 'paid')
    .reduce((s, a) => s + a.commission_cents, 0)
  const pendingCount = attributions.filter((a) => a.status === 'pending').length
  const totalAttributions = attributions.length

  res.status(200).json({
    data: {
      profile,
      stats: {
        lifetime_earnings_cents: heldCents + paidCents,
        held_cents: heldCents,
        paid_cents: paidCents,
        pending_attributions: pendingCount,
        total_attributions: totalAttributions,
        active_codes: codes.filter((c) => c.is_active).length,
      },
    },
  })
}
