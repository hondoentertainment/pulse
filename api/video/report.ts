/**
 * POST /api/video/report
 *
 * Creates a row in `video_reports` that the moderation queue consumes.
 * Rate-limited per reporter (3 reports/hour) so we don't accept an
 * abusive flood of reports.
 */

import {
  badRequest,
  created,
  getAuthUserId,
  handlePreflight,
  methodNotAllowed,
  setCors,
  tooManyRequests,
  unauthorized,
  type RequestLike,
  type ResponseLike,
} from '../_lib/http'
import { checkRateLimit } from '../_lib/rate-limit'
import { insertVideoReport, type VideoReportRow } from '../_lib/store'

const VALID_REASONS: VideoReportRow['reason'][] = [
  'copyrighted_audio',
  'nsfw',
  'minor_in_frame',
  'harassment',
  'spam',
  'misinformation',
  'other',
]

type ReportBody = {
  pulseId?: unknown
  reason?: unknown
  note?: unknown
}

export default function handler(req: RequestLike, res: ResponseLike) {
  if (handlePreflight(req, res)) return
  setCors(res)

  if (req.method !== 'POST') {
    methodNotAllowed(res)
    return
  }

  const userId = getAuthUserId(req)
  if (!userId) {
    unauthorized(res)
    return
  }

  const body = (req.body ?? {}) as ReportBody
  if (typeof body.pulseId !== 'string' || body.pulseId.length === 0) {
    badRequest(res, 'pulseId required')
    return
  }
  if (
    typeof body.reason !== 'string' ||
    !(VALID_REASONS as string[]).includes(body.reason)
  ) {
    badRequest(res, `reason must be one of: ${VALID_REASONS.join(', ')}`)
    return
  }

  const note =
    typeof body.note === 'string' && body.note.length > 0 ? body.note.slice(0, 500) : null

  const rl = checkRateLimit(`video-report:${userId}`, {
    maxTokens: 3,
    refillRatePerSec: 3 / 3600,
  })
  if (!rl.allowed) {
    tooManyRequests(res, rl.retryAfterSeconds)
    return
  }

  const row: VideoReportRow = {
    id: `vr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    pulseId: body.pulseId,
    reporterUserId: userId,
    reason: body.reason as VideoReportRow['reason'],
    note,
    createdAt: new Date().toISOString(),
    resolvedAt: null,
    actionTaken: null,
  }
  insertVideoReport(row)
  created(res, { report: row })
}
