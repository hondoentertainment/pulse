/**
 * POST /api/admin/creator-verification  (admin-only)
 *
 * Body: { request_id: string, action: 'approve' | 'reject', note?: string,
 *         tier?: 'verified' | 'elite' }
 *
 * Approves or rejects a creator_verification_requests row.  On approve,
 * flips the applicant's creator_profiles.tier to `verified` (default) or
 * `elite` and sets verified_at.
 */
import {
  RequestLike,
  ResponseLike,
  setCors,
  requireAdmin,
  jsonError,
} from '../creators/_shared'
import { getStore } from '../creators/_store'

type AdminBody = {
  request_id?: string
  action?: 'approve' | 'reject'
  note?: string
  tier?: 'verified' | 'elite'
}

export default function handler(req: RequestLike, res: ResponseLike) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return jsonError(res, 405, 'Method not allowed')

  const admin = requireAdmin(req, res)
  if (!admin) return

  const body = (req.body ?? {}) as AdminBody
  if (!body.request_id || (body.action !== 'approve' && body.action !== 'reject')) {
    return jsonError(res, 400, 'request_id + action (approve|reject) required')
  }

  const store = getStore()
  const request = store.verifications.get(body.request_id)
  if (!request) return jsonError(res, 404, 'request not found')
  if (request.review_status !== 'pending') {
    return jsonError(res, 409, 'request already resolved')
  }

  const now = new Date().toISOString()
  request.review_status = body.action === 'approve' ? 'approved' : 'rejected'
  request.reviewed_by_user_id = admin.userId
  request.review_note = body.note ?? null
  request.updated_at = now
  store.verifications.set(request.id, request)

  if (body.action === 'approve') {
    const profile = store.profiles.get(request.user_id)
    if (profile) {
      profile.tier = body.tier ?? 'verified'
      profile.verified_at = now
      profile.updated_at = now
      store.profiles.set(profile.user_id, profile)
    }
  }

  res.status(200).json({ data: request })
}
