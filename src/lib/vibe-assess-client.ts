/**
 * Client wrapper for POST /api/vibe/assess — photo → venue energy rating.
 */

import { supabase } from './supabase'
import type { EnergyRating } from './types'

export type CrowdDensity = 'empty' | 'sparse' | 'moderate' | 'packed'
export type SceneLighting = 'bright' | 'dim' | 'dark' | 'colorful'
export type VibeBlockReason = 'nsfw' | 'violence' | 'hate' | 'illegal' | 'not_a_photo'

export interface VibeAssessment {
  energyRating: EnergyRating
  confidence: number
  summary: string
  tags: string[]
  crowdDensity?: CrowdDensity
  lighting?: SceneLighting
  suggestedCaption?: string
  safe?: boolean
  blockedReason?: VibeBlockReason | null
  /** Server hint: apply energyRating to the slider when true. */
  applyEnergy?: boolean
  confidenceThreshold?: number
  costCents?: number
}

export type VibeAssessError = {
  ok: false
  message: string
  status: number
  code?: string
  blockedReason?: string
}

export type VibeAssessSuccess = {
  ok: true
  assessment: VibeAssessment
}

export type VibeAssessClientResult = VibeAssessSuccess | VibeAssessError

export type AssessVibeRequest = {
  venueName?: string
  venueCategory?: string
  venueId?: string
  source?: string
} & (
  | { imageUrl: string; imageBase64?: never; storageKey?: never; mediaType?: never }
  | { storageKey: string; imageUrl?: never; imageBase64?: never; mediaType?: never }
  | {
      imageBase64: string
      imageUrl?: never
      storageKey?: never
      mediaType?: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
    }
)

const ENDPOINT = '/api/vibe/assess'

const getAccessToken = async (): Promise<string | null> => {
  try {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
  } catch {
    return null
  }
}

function err(
  message: string,
  status: number,
  code?: string,
  blockedReason?: string,
): VibeAssessError {
  return { ok: false, message, status, code, blockedReason }
}

/**
 * Assess venue vibe from a photo. Never throws — failures return `{ ok: false }`.
 */
export async function assessVibeFromPhoto(
  req: AssessVibeRequest,
  opts: { signal?: AbortSignal; fetchImpl?: typeof fetch } = {},
): Promise<VibeAssessClientResult> {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch
  if (typeof fetchImpl !== 'function') {
    return err('fetch is not available in this runtime', 0, 'no_fetch')
  }

  const token = await getAccessToken()

  let res: Response
  try {
    res = await fetchImpl(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(req),
      signal: opts.signal,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'network error'
    return err(message, 0, 'network')
  }

  let payload: unknown = null
  try {
    payload = await res.json()
  } catch {
    return err(`Vibe assess returned non-JSON (status ${res.status})`, res.status, 'bad_response')
  }

  if (!res.ok) {
    const envelope = payload as {
      error?: { message?: string; code?: string; blockedReason?: string }
    }
    return err(
      envelope.error?.message ?? `Vibe assess failed (status ${res.status})`,
      res.status,
      envelope.error?.code,
      envelope.error?.blockedReason,
    )
  }

  const data = (payload as { data?: VibeAssessment })?.data
  if (!data || typeof data.energyRating !== 'string') {
    return err('Malformed vibe assessment response', res.status, 'bad_response')
  }

  return { ok: true, assessment: data }
}

/** Turn vision tags into selectable hashtag names (PascalCase, no #). */
export function vibeTagsToHashtagNames(tags: string[]): string[] {
  return tags
    .map((tag) =>
      tag
        .replace(/^#/, '')
        .split(/[-_\s]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(''),
    )
    .filter((name) => name.length >= 2 && name.length <= 32)
    .slice(0, 5)
}

/** Mirror of server `VIBE_CONFIDENCE_APPLY_THRESHOLD` — auto-apply energy at/above this. */
export const VIBE_CONFIDENCE_APPLY_THRESHOLD = 0.4
