/**
 * /api/creators/referral-codes
 *
 *   POST   — create a new code for the authenticated creator.
 *   GET    — list the authenticated creator's codes.
 *   DELETE — deactivate a code by ?code=XXXX (soft delete, sets is_active=false).
 *
 * Create is rate-limited to 5 codes/creator/day.  Collision-safe via
 * generateUniqueCode() in _lib.
 */
import {
  RequestLike,
  ResponseLike,
  setCors,
  requireAuth,
  rateLimit,
  jsonError,
} from './_shared'
import { getStore, ReferralCodeRow } from './_store'
import { generateUniqueCode } from '../_lib/referral-code-gen'

type CreateBody = {
  venue_id?: string | null
  discount_cents?: number | null
  valid_to?: string | null
  max_uses?: number | null
}

export default async function handler(req: RequestLike, res: ResponseLike) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()

  const authed = requireAuth(req, res)
  if (!authed) return

  const store = getStore()

  if (req.method === 'GET') {
    const codes = Array.from(store.codes.values())
      .filter((c) => c.creator_user_id === authed.userId)
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    return res.status(200).json({ data: codes })
  }

  if (req.method === 'POST') {
    const rl = rateLimit(`codes:${authed.userId}`, 5, 24 * 60 * 60 * 1000)
    if (!rl.allowed) return jsonError(res, 429, 'Daily code-creation limit reached')

    const body = (req.body ?? {}) as CreateBody
    const code = await generateUniqueCode(async (c) => store.codes.has(c))
    const row: ReferralCodeRow = {
      code,
      creator_user_id: authed.userId,
      venue_id: body.venue_id ?? null,
      discount_cents:
        typeof body.discount_cents === 'number' ? body.discount_cents : null,
      valid_from: new Date().toISOString(),
      valid_to: body.valid_to ?? null,
      max_uses: typeof body.max_uses === 'number' ? body.max_uses : null,
      uses_count: 0,
      is_active: true,
      created_at: new Date().toISOString(),
    }
    store.codes.set(code, row)
    return res.status(201).json({ data: row })
  }

  if (req.method === 'DELETE') {
    const code =
      typeof req.query?.code === 'string' ? req.query.code : undefined
    if (!code) return jsonError(res, 400, 'code query param required')
    const existing = store.codes.get(code)
    if (!existing) return jsonError(res, 404, 'code not found')
    if (existing.creator_user_id !== authed.userId) {
      return jsonError(res, 403, 'Not your code')
    }
    existing.is_active = false
    store.codes.set(code, existing)
    return res.status(200).json({ data: existing })
  }

  return jsonError(res, 405, 'Method not allowed')
}
