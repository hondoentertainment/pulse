/**
 * POST /api/pulses/create
 *
 * Authenticated pulse-creation endpoint. Runs the caption through server-side
 * moderation, rate-limits to 10/hour/user, and inserts via Supabase using the
 * caller's JWT so RLS policies are the source of truth for authorization.
 *
 * Distinct from the legacy `api/pulses.ts` (offline replay storage). New
 * clients should POST to this endpoint for the hardened path.
 */

import {
  handlePreflight,
  methodNotAllowed,
  ok,
  fail,
  type RequestLike,
  type ResponseLike,
} from '../_lib/http'
import { requireAuth } from '../_lib/auth'
import { consume } from '../_lib/rate-limit'
import { asString, asEnum, isPlainObject } from '../_lib/validate'
import { checkContent } from '../_lib/moderation'
import { createUserClient } from '../_lib/supabase-server'

type EnergyRating = 'dead' | 'chill' | 'buzzing' | 'electric'
const ENERGY_RATINGS = ['dead', 'chill', 'buzzing', 'electric'] as const

type PulseCreateBody = {
  venueId: string
  energyRating: EnergyRating
  caption?: string
  photos?: string[]
  video?: string | null
  hashtags?: string[]
  crewId?: string | null
}

const PULSE_TTL_MS = 90 * 60 * 1000

const sanitizeStringArray = (
  value: unknown,
  max: number,
  maxItemLength: number,
): string[] => {
  if (!Array.isArray(value)) return []
  const out: string[] = []
  for (const item of value) {
    if (typeof item !== 'string') continue
    if (item.length === 0 || item.length > maxItemLength) continue
    out.push(item)
    if (out.length >= max) break
  }
  return out
}

const validateBody = (
  body: Record<string, unknown>,
): { ok: true; value: PulseCreateBody } | { ok: false; error: string } => {
  const venueId = asString(body.venueId, 1, 128)
  if (!venueId) return { ok: false, error: 'venueId must be a non-empty string (max 128)' }

  const energyRating = asEnum(body.energyRating, ENERGY_RATINGS) as EnergyRating | null
  if (!energyRating) {
    return { ok: false, error: `energyRating must be one of: ${ENERGY_RATINGS.join(', ')}` }
  }

  let caption: string | undefined
  if (body.caption !== undefined && body.caption !== null) {
    if (typeof body.caption !== 'string' || body.caption.length > 500) {
      return { ok: false, error: 'caption must be a string up to 500 characters' }
    }
    caption = body.caption.trim()
  }

  let crewId: string | null | undefined
  if (body.crewId !== undefined && body.crewId !== null) {
    const r = asString(body.crewId, 1, 128)
    if (!r) return { ok: false, error: 'crewId must be a non-empty string (max 128)' }
    crewId = r
  }

  let video: string | null | undefined
  if (body.video !== undefined && body.video !== null) {
    const r = asString(body.video, 1, 2048)
    if (!r) return { ok: false, error: 'video must be a non-empty string (max 2048)' }
    video = r
  }

  return {
    ok: true,
    value: {
      venueId,
      energyRating,
      caption,
      photos: sanitizeStringArray(body.photos, 6, 2048),
      video: video ?? null,
      hashtags: sanitizeStringArray(body.hashtags, 10, 64),
      crewId: crewId ?? null,
    },
  }
}

export default async function handler(
  req: RequestLike,
  res: ResponseLike,
): Promise<void> {
  if (handlePreflight(req, res)) return

  if (req.method !== 'POST') {
    methodNotAllowed(res, ['POST'])
    return
  }

  const auth = requireAuth(req)
  if (!auth.ok) {
    fail(res, auth.status, auth.code, auth.message)
    return
  }

  const rl = consume(auth.context.userId, 'pulse_create')
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(Math.ceil(rl.retryAfterMs / 1000)))
    fail(res, 429, 'rate_limited', 'Too many pulse creations', {
      retryAfterMs: rl.retryAfterMs,
      limit: rl.limit,
    })
    return
  }

  if (!isPlainObject(req.body)) {
    fail(res, 400, 'invalid_body', 'Request body must be a JSON object')
    return
  }

  const validated = validateBody(req.body)
  if (!validated.ok) {
    fail(res, 400, 'invalid_input', validated.error)
    return
  }

  const caption = validated.value.caption ?? ''
  const moderation = checkContent({ content: caption, kind: 'pulse' })
  if (!moderation.allowed) {
    fail(res, 400, 'content_rejected', 'Caption failed moderation', {
      reasons: moderation.reasons,
      severity: moderation.severity,
    })
    return
  }

  const now = new Date()
  const id = `pulse-${now.getTime()}-${Math.random().toString(36).slice(2, 10)}`
  const createdAt = now.toISOString()
  const expiresAt = new Date(now.getTime() + PULSE_TTL_MS).toISOString()

  const pulseRow = {
    id,
    user_id: auth.context.userId,
    venue_id: validated.value.venueId,
    crew_id: validated.value.crewId,
    photos: validated.value.photos ?? [],
    video_url: validated.value.video,
    energy_rating: validated.value.energyRating,
    caption: moderation.sanitized ?? caption,
    hashtags: validated.value.hashtags ?? [],
    views: 0,
    reactions: { fire: [], eyes: [], skull: [], lightning: [] },
    created_at: createdAt,
    expires_at: expiresAt,
  }

  try {
    const client = createUserClient(auth.context.token)
    const { data, error } = await client
      .from('pulses')
      .insert(pulseRow)
      .select()
      .single()

    if (error) {
      fail(res, 500, 'persist_failed', 'Failed to persist pulse', {
        details: error.message,
      })
      return
    }

    res.setHeader('X-RateLimit-Limit', String(rl.limit))
    res.setHeader('X-RateLimit-Remaining', String(rl.remaining))
    ok(
      res,
      {
        pulse: data ?? pulseRow,
        moderation: {
          severity: moderation.severity,
          reasons: moderation.reasons,
        },
      },
      201,
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error'
    fail(res, 500, 'persist_exception', 'Supabase insert threw', {
      details: message,
    })
  }
}
