/**
 * POST /api/pulses/create
 *
 * Authenticated pulse-creation endpoint. Runs the caption through server-side
 * moderation, rate-limits to 5/10min/user (SQL trigger is source of truth), and inserts via Supabase using the
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
} from '../_lib/http.js'
import { requireAuth } from '../_lib/auth.js'
import { consume } from '../_lib/rate-limit.js'
import { asString, asEnum, isPlainObject } from '../_lib/validate.js'
import { checkContent } from '../_lib/moderation.js'
import { createUserClient } from '../_lib/supabase-server.js'
import { resolvePostedLocationVerified } from '../_lib/location-proof.js'
import { notifyLivePulse } from '../_lib/web-push-live.js'

type EnergyRating = 'dead' | 'chill' | 'buzzing' | 'electric'
const ENERGY_RATINGS = ['dead', 'chill', 'buzzing', 'electric'] as const
const PULSE_KINDS = ['pulse', 'review'] as const
type PulseKind = (typeof PULSE_KINDS)[number]

const LIVE_REVIEW_CAPTION_MIN = 1
const LIVE_REVIEW_CAPTION_MAX = 280
  const VENUE_COOLDOWN_MS = 2 * 60 * 1000

type PulseCreateBody = {
  venueId: string
  energyRating: EnergyRating
  caption?: string
  photos?: string[]
  video?: string | null
  hashtags?: string[]
  crewId?: string | null
  kind?: PulseKind
  locationVerified?: boolean
  lat?: number
  lng?: number
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

  const kind = (asEnum(body.kind, PULSE_KINDS) as PulseKind | null) ?? 'review'

  let caption: string | undefined
  if (body.caption !== undefined && body.caption !== null) {
    if (typeof body.caption !== 'string' || body.caption.length > 500) {
      return { ok: false, error: 'caption must be a string up to 500 characters' }
    }
    caption = body.caption.trim()
  }

  if (kind === 'review') {
    if (!caption || caption.length < LIVE_REVIEW_CAPTION_MIN) {
      return { ok: false, error: 'caption is required for a live review' }
    }
    if (caption.length > LIVE_REVIEW_CAPTION_MAX) {
      return { ok: false, error: `caption must be ${LIVE_REVIEW_CAPTION_MAX} characters or fewer for a live review` }
    }
  }

  const locationVerified = body.locationVerified === true
  const lat = typeof body.lat === 'number' && Number.isFinite(body.lat) ? body.lat : undefined
  const lng = typeof body.lng === 'number' && Number.isFinite(body.lng) ? body.lng : undefined

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
      kind,
      locationVerified,
      lat,
      lng,
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
    kind: validated.value.kind ?? 'review',
    location_verified: validated.value.locationVerified ?? false,
  }

  try {
    const client = createUserClient(auth.context.token)

    const gate = await client.rpc('assert_pulse_rate_limit', {
      p_user_id: auth.context.userId,
      p_venue_id: validated.value.venueId,
    })
    if (gate.error) {
      const message = gate.error.message || 'Too many pulses'
      fail(res, 429, 'rate_limited', message)
      return
    }

    const cooldownCutoff = new Date(now.getTime() - VENUE_COOLDOWN_MS).toISOString()
    const { data: recentAtVenue, error: cooldownError } = await client
      .from('pulses')
      .select('id')
      .eq('user_id', auth.context.userId)
      .eq('venue_id', validated.value.venueId)
      .is('deleted_at', null)
      .gte('created_at', cooldownCutoff)
      .limit(1)

    if (cooldownError) {
      fail(res, 500, 'persist_failed', 'Failed to check review cooldown', {
        details: cooldownError.message,
      })
      return
    }
    if (Array.isArray(recentAtVenue) && recentAtVenue.length > 0) {
      fail(res, 429, 'venue_cooldown', 'Wait 2 minutes before another pulse at this venue')
      return
    }

    let locationVerified = validated.value.locationVerified === true
    const userLocation =
      validated.value.lat !== undefined && validated.value.lng !== undefined
        ? { lat: validated.value.lat, lng: validated.value.lng }
        : null
    const { data: venueRow } = await client
      .from('venues')
      .select('name, location_lat, location_lng')
      .eq('id', validated.value.venueId)
      .maybeSingle()
    const venueLocation =
      venueRow &&
      typeof venueRow.location_lat === 'number' &&
      typeof venueRow.location_lng === 'number'
        ? { lat: venueRow.location_lat, lng: venueRow.location_lng }
        : null
    const proof = resolvePostedLocationVerified({
      clientVerified: validated.value.locationVerified,
      userLocation,
      venueLocation,
    })
    locationVerified = proof.locationVerified
    pulseRow.location_verified = locationVerified

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

    void notifyLivePulse({
      venueId: validated.value.venueId,
      venueName: typeof venueRow?.name === 'string' ? venueRow.name : 'Pulse',
      caption: pulseRow.caption,
      pulseId: typeof data?.id === 'string' ? data.id : id,
      authorUserId: auth.context.userId,
      venueLocation,
    }).catch((err) => {
      console.warn('[push] notify-live failed', err)
    })

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
