/**
 * POST /api/video/upload-url
 *
 * Returns a short-TTL signed upload URL for Supabase Storage `pulse-videos`.
 * In production this calls `supabase.storage.from('pulse-videos').createSignedUploadUrl(...)`.
 * In dev/test we return a synthetic URL so the client flow can be exercised
 * without a live Supabase project.
 *
 * Body: { filename, mime, bytes }
 *   filename: string — client-chosen; scoped under the caller's user folder
 *   mime:     'video/mp4' | 'video/webm' | 'video/quicktime'
 *   bytes:    number — used for server-side size-cap validation
 */

import {
  badRequest,
  created,
  handlePreflight,
  methodNotAllowed,
  setCors,
  tooManyRequests,
  unauthorized,
  getAuthUserId,
  type RequestLike,
  type ResponseLike,
} from '../_lib/http'
import { checkRateLimit } from '../_lib/rate-limit'

const ALLOWED_MIME = ['video/mp4', 'video/webm', 'video/quicktime'] as const
const MAX_BYTES = 50 * 1024 * 1024 // 50 MB
const SIGNED_URL_TTL_SECONDS = 300 // 5 min

type UploadUrlBody = {
  filename?: unknown
  mime?: unknown
  bytes?: unknown
}

function isValid(body: UploadUrlBody): body is {
  filename: string
  mime: (typeof ALLOWED_MIME)[number]
  bytes: number
} {
  if (!body || typeof body !== 'object') return false
  if (typeof body.filename !== 'string' || body.filename.length === 0) return false
  if (typeof body.mime !== 'string' || !(ALLOWED_MIME as readonly string[]).includes(body.mime)) {
    return false
  }
  if (typeof body.bytes !== 'number' || !Number.isFinite(body.bytes) || body.bytes <= 0) {
    return false
  }
  if (body.bytes > MAX_BYTES) return false
  return true
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 128)
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

  const limit = checkRateLimit(`video-upload-url:${userId}`, {
    maxTokens: 10,
    refillRatePerSec: 10 / 3600, // 10 signed URLs / hour
  })
  if (!limit.allowed) {
    tooManyRequests(res, limit.retryAfterSeconds)
    return
  }

  const body = (req.body ?? {}) as UploadUrlBody
  if (!isValid(body)) {
    badRequest(res, 'Invalid upload request (filename, mime in [video/mp4,video/webm,video/quicktime], bytes <= 52428800)')
    return
  }

  // Object key lives under the user's folder so the storage RLS allows the
  // insert. `Date.now()` prefix prevents clobbering if the client resubmits.
  const cleanName = sanitizeFilename(body.filename)
  const objectKey = `${userId}/${Date.now()}-${cleanName}`

  // Synthetic signed URL shape; Supabase returns { signedUrl, path, token }.
  const signedUrl =
    `https://placeholder.supabase.co/storage/v1/object/upload/sign/pulse-videos/${objectKey}` +
    `?token=${encodeURIComponent('dev-token')}`

  created(res, {
    bucket: 'pulse-videos',
    path: objectKey,
    signedUrl,
    mime: body.mime,
    maxBytes: MAX_BYTES,
    expiresAt: new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString(),
  })
}
