/**
 * POST /api/photos/upload-url
 *
 * Returns a short-TTL signed upload URL for venue/pulse photos in the
 * `pulse-videos` bucket (same public bucket as video; keys live under
 * `{userId}/photos/...`).
 *
 * When Supabase is configured, attempts a real `createSignedUploadUrl`.
 * Falls back to a synthetic URL so local/dev flows still exercise the client.
 *
 * Body: { filename, mime, bytes }
 */

import {
  badRequest,
  created,
  fail,
  handlePreflight,
  methodNotAllowed,
  setCors,
  type RequestLike,
  type ResponseLike,
} from '../_lib/http'
import { requireAuth } from '../_lib/auth'
import { consume } from '../_lib/rate-limit'
import { createUserClient, getSupabaseConfig } from '../_lib/supabase-server'

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const
const MAX_BYTES = 8 * 1024 * 1024 // 8 MB
const SIGNED_URL_TTL_SECONDS = 300
const BUCKET = 'pulse-videos'

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

function extForMime(mime: (typeof ALLOWED_MIME)[number]): string {
  switch (mime) {
    case 'image/png':
      return 'png'
    case 'image/webp':
      return 'webp'
    case 'image/gif':
      return 'gif'
    default:
      return 'jpg'
  }
}

export default async function handler(req: RequestLike, res: ResponseLike): Promise<void> {
  if (handlePreflight(req, res)) return
  setCors(res)

  if (req.method !== 'POST') {
    methodNotAllowed(res, ['POST', 'OPTIONS'])
    return
  }

  const auth = requireAuth(req)
  if (!auth.ok) {
    fail(res, auth.status, auth.code, auth.message)
    return
  }

  const rl = consume(auth.context.userId, 'photo_upload_url')
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(Math.ceil(rl.retryAfterMs / 1000)))
    fail(res, 429, 'rate_limited', 'Too many photo upload URLs — try again later', {
      retryAfterMs: rl.retryAfterMs,
      limit: rl.limit,
    })
    return
  }

  const body = (req.body ?? {}) as UploadUrlBody
  if (!isValid(body)) {
    badRequest(
      res,
      'Invalid upload request (filename, mime in [image/jpeg,image/png,image/webp,image/gif], bytes <= 8388608)',
    )
    return
  }

  const cleanName = sanitizeFilename(body.filename)
  const hasExt = /\.[a-z0-9]+$/i.test(cleanName)
  const filename = hasExt ? cleanName : `${cleanName}.${extForMime(body.mime)}`
  const objectKey = `${auth.context.userId}/photos/${Date.now()}-${filename}`

  let signedUrl: string | null = null
  try {
    const client = createUserClient(auth.context.token)
    const { data, error } = await client.storage
      .from(BUCKET)
      .createSignedUploadUrl(objectKey)
    if (!error && data?.signedUrl) {
      signedUrl = data.signedUrl
    }
  } catch {
    // Fall through to synthetic URL.
  }

  if (!signedUrl) {
    const { url } = getSupabaseConfig()
    signedUrl =
      `${url}/storage/v1/object/upload/sign/${BUCKET}/${objectKey}` +
      `?token=${encodeURIComponent('dev-token')}`
  }

  res.setHeader('X-RateLimit-Limit', String(rl.limit))
  res.setHeader('X-RateLimit-Remaining', String(rl.remaining))
  created(res, {
    bucket: BUCKET,
    path: objectKey,
    signedUrl,
    publicUrl: `${getSupabaseConfig().url.replace(/\/$/, '')}/storage/v1/object/public/${BUCKET}/${objectKey}`,
    mime: body.mime,
    maxBytes: MAX_BYTES,
    expiresAt: new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString(),
  })
}
