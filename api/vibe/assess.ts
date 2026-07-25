/**
 * POST /api/vibe/assess
 *
 * Authenticated vision endpoint with rate limit + daily spend cap.
 * Body: exactly one of imageUrl | storageKey | imageBase64.
 *
 * Env:
 *   ANTHROPIC_API_KEY (required)
 *   VIBE_VISION_MODEL (optional)
 *   VIBE_VISION_DAILY_CENTS_CAP (optional, default 50)
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
  VIBE_CONFIDENCE_APPLY_THRESHOLD,
  type VibeImageMediaType,
  type VibeImageSource,
} from '../_lib/vibe-vision'
import {
  loadDailySpend,
  recordAssessEvent,
  recordDailySpend,
} from '../_lib/vibe-assess-cost'

const ALLOWED_MEDIA: readonly VibeImageMediaType[] = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]

function resolveImage(body: Record<string, unknown>):
  | { ok: true; image: VibeImageSource; storageKey?: string }
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
    return { ok: true, image: { type: 'url', url }, storageKey }
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

  const spend = await loadDailySpend(auth.context.userId, auth.context.token)
  if (spend.spentCents >= spend.capCents) {
    fail(res, 402, 'cap_reached', 'Daily vibe vision spend cap reached', {
      capCents: spend.capCents,
      spentCents: spend.spentCents,
      day: spend.day,
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
  const venueId =
    typeof req.body.venueId === 'string' ? req.body.venueId.trim().slice(0, 128) : undefined
  const source =
    typeof req.body.source === 'string' ? req.body.source.trim().slice(0, 32) : 'create_pulse'

  try {
    const outcome = await assessVenueVibe({
      apiKey,
      image: resolved.image,
      venueName: venueName || undefined,
      venueCategory: venueCategory || undefined,
    })

    const { result, costCents, usage, model } = outcome
    const lowConfidence = result.confidence < VIBE_CONFIDENCE_APPLY_THRESHOLD

    await recordDailySpend({
      userId: auth.context.userId,
      userJwt: auth.context.token,
      costCents,
      blocked: !result.safe,
      lowConfidence,
    })

    await recordAssessEvent({
      userId: auth.context.userId,
      userJwt: auth.context.token,
      venueId,
      energyRating: result.energyRating,
      confidence: result.confidence,
      safe: result.safe,
      blockedReason: result.blockedReason,
      costCents,
      source,
      storageKey: resolved.storageKey,
    })

    if (!result.safe) {
      fail(res, 422, 'content_blocked', 'Photo failed safety screening', {
        blockedReason: result.blockedReason,
        summary: result.summary,
        costCents,
      })
      return
    }

    res.setHeader('X-RateLimit-Limit', String(rl.limit))
    res.setHeader('X-RateLimit-Remaining', String(rl.remaining))
    ok(
      res,
      {
        ...result,
        applyEnergy: !lowConfidence,
        confidenceThreshold: VIBE_CONFIDENCE_APPLY_THRESHOLD,
        costCents,
        usage,
        model,
        spend: {
          day: spend.day,
          spentCents: spend.spentCents + costCents,
          capCents: spend.capCents,
        },
      },
      200,
    )
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
