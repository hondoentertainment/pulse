/**
 * POST /api/creators/apply
 *
 * Authenticated user submits a verification request with social links and
 * content samples.  Creates a creator_verification_requests row in the
 * 'pending' state.  If the user does not yet have a creator_profiles row
 * we also create one at tier='creator'.
 */
import {
  RequestLike,
  ResponseLike,
  setCors,
  requireAuth,
  rateLimit,
  jsonError,
} from './_shared'
import { getStore, VerificationRequestRow } from './_store'

type ApplyBody = {
  handle?: string
  bio?: string
  niche?: string
  social_links?: unknown
  content_samples?: unknown
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string')
}

export default function handler(req: RequestLike, res: ResponseLike) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return jsonError(res, 405, 'Method not allowed')

  const authed = requireAuth(req, res)
  if (!authed) return

  const rl = rateLimit(`apply:${authed.userId}`, 3, 24 * 60 * 60 * 1000)
  if (!rl.allowed) return jsonError(res, 429, 'Too many apply attempts')

  const body = (req.body ?? {}) as ApplyBody
  if (!body.handle || typeof body.handle !== 'string' || body.handle.length < 3) {
    return jsonError(res, 400, 'handle is required (min 3 chars)')
  }
  if (!isStringArray(body.social_links) || body.social_links.length === 0) {
    return jsonError(res, 400, 'social_links must be a non-empty string array')
  }
  if (!isStringArray(body.content_samples)) {
    return jsonError(res, 400, 'content_samples must be a string array')
  }

  const store = getStore()
  const now = new Date().toISOString()

  // Create or refresh the creator profile at base tier
  if (!store.profiles.has(authed.userId)) {
    store.profiles.set(authed.userId, {
      user_id: authed.userId,
      handle: body.handle,
      tier: 'creator',
      verified_at: null,
      bio: body.bio ?? null,
      niche: body.niche ?? null,
      follower_count_cache: 0,
      total_earnings_cents: 0,
      payout_account_id: null,
      created_at: now,
      updated_at: now,
    })
  }

  const id = `ver_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const row: VerificationRequestRow = {
    id,
    user_id: authed.userId,
    submitted_social_links: body.social_links,
    submitted_content_samples: body.content_samples,
    review_status: 'pending',
    reviewed_by_user_id: null,
    review_note: null,
    created_at: now,
    updated_at: now,
  }
  store.verifications.set(id, row)

  res.status(201).json({ data: row })
}
