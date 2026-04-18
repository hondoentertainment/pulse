/**
 * POST /api/video/publish
 *
 * Creates a pulse row whose `video_url` points at a previously-uploaded
 * object in the `pulse-videos` bucket. Gated by:
 *   - auth (user must be signed in)
 *   - per-user rate limit (3 videos/hour — tighter than text pulses)
 *   - caption/hashtag moderation (checkContent from ../_lib/moderation.ts)
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
import { checkContent } from '../_lib/moderation'
import { checkRateLimit } from '../_lib/rate-limit'
import { countVideoPulsesForUserSince, insertVideoPulse, type VideoPulseRow } from '../_lib/store'

const MAX_BYTES = 50 * 1024 * 1024
const MAX_DURATION_MS = 3 * 60 * 1000 // 3 min hard cap
const PULSE_TTL_MINUTES = 90
const ALLOWED_MIME = ['video/mp4', 'video/webm', 'video/quicktime']

type PublishBody = {
  venueId?: unknown
  caption?: unknown
  hashtags?: unknown
  videoStorageKey?: unknown
  durationMs?: unknown
  width?: unknown
  height?: unknown
  thumbnailStorageKey?: unknown
  mime?: unknown
  bytes?: unknown
  venueLat?: unknown
  venueLng?: unknown
}

interface ValidPublishBody {
  venueId: string
  caption: string
  hashtags: string[]
  videoStorageKey: string
  durationMs: number
  width: number
  height: number
  thumbnailStorageKey: string | null
  mime: string
  bytes: number
  venueLat: number
  venueLng: number
}

function validate(body: PublishBody): ValidPublishBody | { error: string } {
  if (!body || typeof body !== 'object') return { error: 'Missing body' }

  if (typeof body.venueId !== 'string' || body.venueId.length === 0) return { error: 'venueId required' }
  if (typeof body.videoStorageKey !== 'string' || body.videoStorageKey.length === 0) {
    return { error: 'videoStorageKey required' }
  }

  const durationMs = Number(body.durationMs)
  if (!Number.isFinite(durationMs) || durationMs <= 0 || durationMs > MAX_DURATION_MS) {
    return { error: 'durationMs must be positive and <= 180000' }
  }

  const width = Number(body.width)
  const height = Number(body.height)
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    return { error: 'width and height required' }
  }

  const bytes = Number(body.bytes)
  if (!Number.isFinite(bytes) || bytes <= 0 || bytes > MAX_BYTES) {
    return { error: `bytes must be positive and <= ${MAX_BYTES}` }
  }

  if (typeof body.mime !== 'string' || !ALLOWED_MIME.includes(body.mime)) {
    return { error: 'mime must be one of video/mp4, video/webm, video/quicktime' }
  }

  const venueLat = Number(body.venueLat)
  const venueLng = Number(body.venueLng)
  if (!Number.isFinite(venueLat) || !Number.isFinite(venueLng)) {
    return { error: 'venueLat and venueLng required' }
  }

  const caption = typeof body.caption === 'string' ? body.caption.slice(0, 500) : ''

  let hashtags: string[] = []
  if (Array.isArray(body.hashtags)) {
    hashtags = body.hashtags
      .filter((t): t is string => typeof t === 'string' && t.length > 0)
      .slice(0, 10)
  }

  const thumbnailStorageKey =
    typeof body.thumbnailStorageKey === 'string' && body.thumbnailStorageKey.length > 0
      ? body.thumbnailStorageKey
      : null

  return {
    venueId: body.venueId,
    caption,
    hashtags,
    videoStorageKey: body.videoStorageKey,
    durationMs,
    width,
    height,
    thumbnailStorageKey,
    mime: body.mime,
    bytes,
    venueLat,
    venueLng,
  }
}

function publicUrlFor(bucket: string, key: string): string {
  return `https://placeholder.supabase.co/storage/v1/object/public/${bucket}/${key}`
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

  const validated = validate((req.body ?? {}) as PublishBody)
  if ('error' in validated) {
    badRequest(res, validated.error)
    return
  }

  // Moderation gate — caption + hashtags.
  const moderation = checkContent({ caption: validated.caption, hashtags: validated.hashtags })
  if (!moderation.ok) {
    res.status(422).json({
      error: 'Content violates policy',
      findings: moderation.findings,
    })
    return
  }

  // Rate limit: 3 video pulses/hour/user. We check both the token bucket (so
  // callers get an accurate Retry-After) AND a hard count (for defense in
  // depth — the bucket can be generous after long inactivity).
  const rl = checkRateLimit(`video-publish:${userId}`, {
    maxTokens: 3,
    refillRatePerSec: 3 / 3600,
  })
  if (!rl.allowed) {
    tooManyRequests(res, rl.retryAfterSeconds)
    return
  }
  const sinceIso = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  if (countVideoPulsesForUserSince(userId, sinceIso) >= 3) {
    tooManyRequests(res, 60 * 10)
    return
  }

  const nowIso = new Date().toISOString()
  const expiresAt = new Date(Date.now() + PULSE_TTL_MINUTES * 60 * 1000).toISOString()

  const row: VideoPulseRow = {
    id: `vp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId,
    venueId: validated.venueId,
    createdAt: nowIso,
    expiresAt,
    caption: validated.caption || null,
    hashtags: validated.hashtags,
    videoUrl: publicUrlFor('pulse-videos', validated.videoStorageKey),
    videoDurationMs: validated.durationMs,
    videoWidth: validated.width,
    videoHeight: validated.height,
    videoThumbnailUrl: validated.thumbnailStorageKey
      ? publicUrlFor('pulse-videos', validated.thumbnailStorageKey)
      : null,
    videoMimeType: validated.mime,
    videoBytes: validated.bytes,
    venueLat: validated.venueLat,
    venueLng: validated.venueLng,
    pulseScore: 50, // seeded; batch job recomputes based on engagement
    reactionCount: 0,
  }

  insertVideoPulse(row)
  created(res, {
    pulse: row,
    moderation: { severity: moderation.severity, findings: moderation.findings },
  })
}
