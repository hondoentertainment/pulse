/**
 * POST /api/vibe/assess
 *
 * Authenticated vision endpoint: accepts a venue photo (URL, storage key,
 * or base64) and returns a structured energy/vibe assessment via Claude.
 *
 * Body (exactly one of imageUrl | storageKey | imageBase64):
 *   {
 *     imageUrl?: string,
 *     storageKey?: string,   // pulse-videos object key
 *     imageBase64?: string,  // raw or data-URL
 *     mediaType?: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
 *     venueName?: string,
 *     venueCategory?: string
 *   }
 *
 * Env:
 *   ANTHROPIC_API_KEY (required)
 *   VIBE_VISION_MODEL (optional, default claude-sonnet-4-6)
 */

import {
  fail,
  handlePreflight,
  methodNotAllowed,
  ok,
  type RequestLike,
  type ResponseLike,
} from '../_lib/http'
import { requireAuth } from '../_lib/auth'
import { consume } from '../_lib/rate-limit'
import { isPlainObject } from '../_lib/validate'
import { AnthropicError } from '../_lib/anthropic'
import { storageKeyToPublicUrl } from '../_lib/storage-public-url'
import {
  assessVenueVibe,
  normalizeBase64Payload,
  type VibeImageMediaType,
  type VibeImageSource,
} from '../_lib/vibe-vision'

const ALLOWED_MEDIA: readonly VibeImageMediaType[] = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]

function resolveImage(body: Record<string, unknown>):
  | { ok: true; image: VibeImageSource }
  | { ok: false; error: string } {
  const imageUrl = typeof body.imageUrl === 'string' ? body.imageUrl.trim() : ''
  const storageKey = typeof body.storageKey === 'string' ? body.storageKey.trim() : ''
  const imageBase64 = typeof body.imageBase64 === 'string' ? body.imageBase64 : ''

  const provided = [imageUrl, storageKey, imageBase64].filter(Boolean).length
  if (provided === 0) {
    return { ok: false, error: 'imageUrl, storageKey, or imageBase64 is required' }
  }
  if (provided > 1) {
    return { ok: false, error: 'Provide only one of imageUrl, storageKey, or imageBase64' }
  }

  if (storageKey) {
    const url = storageKeyToPublicUrl(storageKey)
    if (!url) return { ok: false, error: 'storageKey is invalid' }
    return { ok: true, image: { type: 'url', url } }
  }

  if (imageUrl) {
    return { ok: true, image: { type: 'url', url: imageUrl } }
  }

  const normalized = normalizeBase64Payload(imageBase64)
  if (!normalized) {
    return { ok: false, error: 'imageBase64 must be a data URL or raw base64 image payload' }
  }

  let mediaType = normalized.mediaType
  if (typeof body.mediaType === 'string') {
    const requested = body.mediaType.toLowerCase() as VibeImageMediaType
    if (!(ALLOWED_MEDIA as readonly string[]).includes(requested)) {
      return { ok: false, error: `mediaType must be one of: ${ALLOWED_MEDIA.join(', ')}` }
    }
    if (!imageBase64.trim().startsWith('data:')) {
      mediaType = requested
    }
  }

  return {
    ok: true,
    image: { type: 'base64', mediaType, data: normalized.data },
  }
}

export default async function handler(req: RequestLike, res: ResponseLike): Promise<void> {
  if (handlePreflight(req, res)) return

  if (req.method !== 'POST') {
    methodNotAllowed(res, ['POST', 'OPTIONS'])
    return
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    fail(res, 500, 'not_configured', 'ANTHROPIC_API_KEY is not configured')
    return
  }

  const auth = requireAuth(req)
  if (!auth.ok) {
    fail(res, auth.status, auth.code, auth.message)
    return
  }

  const rl = consume(auth.context.userId, 'vibe_assess')
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(Math.ceil(rl.retryAfterMs / 1000)))
    fail(res, 429, 'rate_limited', 'Too many vibe assessments — try again later', {
      retryAfterMs: rl.retryAfterMs,
      limit: rl.limit,
    })
    return
  }

  if (!isPlainObject(req.body)) {
    fail(res, 400, 'invalid_body', 'Request body must be a JSON object')
    return
  }

  const resolved = resolveImage(req.body)
  if (!resolved.ok) {
    fail(res, 400, 'invalid_input', resolved.error)
    return
  }

  const venueName =
    typeof req.body.venueName === 'string' ? req.body.venueName.trim().slice(0, 120) : undefined
  const venueCategory =
    typeof req.body.venueCategory === 'string'
      ? req.body.venueCategory.trim().slice(0, 64)
      : undefined

  try {
    const assessment = await assessVenueVibe({
      apiKey,
      image: resolved.image,
      venueName: venueName || undefined,
      venueCategory: venueCategory || undefined,
    })

    res.setHeader('X-RateLimit-Limit', String(rl.limit))
    res.setHeader('X-RateLimit-Remaining', String(rl.remaining))
    ok(res, assessment, 200)
  } catch (err) {
    if (err instanceof AnthropicError) {
      const status = err.status >= 400 && err.status < 600 ? err.status : 502
      fail(res, status === 400 ? 400 : 502, status === 400 ? 'invalid_input' : 'upstream_error', err.message)
      return
    }
    const message = err instanceof Error ? err.message : 'Vibe assessment failed'
    fail(res, 502, 'upstream_error', message)
  }
}
