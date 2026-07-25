/**
 * Venue vibe assessment from a photo (Anthropic vision).
 *
 * Maps a nightlife/venue scene image onto Pulse's EnergyRating taxonomy
 * (`dead` | `chill` | `buzzing` | `electric`) plus short descriptive tags.
 * Used by:
 *   - POST /api/vibe/assess
 *   - Concierge tool `assess_venue_photo`
 */

import {
  callClaude,
  estimateCostCents,
  AnthropicError,
  type AnthropicContentBlock,
  type AnthropicImageBlock,
  type AnthropicUsage,
} from './anthropic'
import type { EnergyRating } from '../../src/lib/types'

const DEFAULT_MODEL = 'claude-sonnet-4-6'
const MAX_BASE64_CHARS = 5_500_000 // ~4 MB binary after decode
const ENERGY_VALUES = ['dead', 'chill', 'buzzing', 'electric'] as const

/** Auto-apply energy rating only at or above this confidence. */
export const VIBE_CONFIDENCE_APPLY_THRESHOLD = 0.4

export type VibeImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

export type VibeImageSource =
  | { type: 'url'; url: string }
  | { type: 'base64'; mediaType: VibeImageMediaType; data: string }

export type CrowdDensity = 'empty' | 'sparse' | 'moderate' | 'packed'
export type SceneLighting = 'bright' | 'dim' | 'dark' | 'colorful'
export type VibeBlockReason = 'nsfw' | 'violence' | 'hate' | 'illegal' | 'not_a_photo'

export interface VibeAssessResult {
  energyRating: EnergyRating
  confidence: number
  summary: string
  tags: string[]
  crowdDensity?: CrowdDensity
  lighting?: SceneLighting
  suggestedCaption?: string
  /** False when the image should not be used for vibe / publishing. */
  safe: boolean
  blockedReason?: VibeBlockReason | null
}

export interface AssessVenueVibeParams {
  apiKey: string
  image: VibeImageSource
  venueName?: string
  venueCategory?: string
  model?: string
  fetchImpl?: typeof fetch
}

export interface AssessVenueVibeOutcome {
  result: VibeAssessResult
  usage: AnthropicUsage
  costCents: number
  model: string
}

const SYSTEM_PROMPT = `You assess nightlife venue vibes from a single photo for Pulse,
a live social app. Map the scene to exactly one energy rating:

- dead: empty / closing / no energy
- chill: relaxed, seated, conversation, soft music
- buzzing: lively crowd, lines forming, people standing/mingling
- electric: packed dance floor, peak energy, high intensity

Also screen for unsafe content. Set "safe" to false and set blockedReason when
the image shows pornography/sexual content, graphic violence, hate symbols,
or clear illegal activity. Ordinary bar/club crowds (including alcohol) are safe.

Respond with ONLY a JSON object (no markdown fences) matching:
{
  "energyRating": "dead" | "chill" | "buzzing" | "electric",
  "confidence": number between 0 and 1,
  "summary": "one short sentence describing the vibe",
  "tags": ["up to 5 short lowercase kebab-case tags"],
  "crowdDensity": "empty" | "sparse" | "moderate" | "packed",
  "lighting": "bright" | "dim" | "dark" | "colorful",
  "suggestedCaption": "optional tip under 100 chars for other guests",
  "safe": true | false,
  "blockedReason": null | "nsfw" | "violence" | "hate" | "illegal" | "not_a_photo"
}

Rules:
- Judge the room energy visible in the photo, not brand marketing.
- If the image is not a venue/nightlife scene, still pick the closest
  energyRating with low confidence and say so in summary.
- If unsafe, still return JSON with safe=false, a low confidence, and a
  short non-graphic summary (do not describe the prohibited content).
- Never invent specific venue names or claim you know the location
  unless venue context was provided.
- Keep tags concrete (e.g. "packed-dancefloor", "craft-cocktails",
  "outdoor-patio") — no hashtags.`

function isEnergyRating(v: unknown): v is EnergyRating {
  return typeof v === 'string' && (ENERGY_VALUES as readonly string[]).includes(v)
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0.5
  return Math.max(0, Math.min(1, n))
}

function asCrowd(v: unknown): CrowdDensity | undefined {
  if (v === 'empty' || v === 'sparse' || v === 'moderate' || v === 'packed') return v
  return undefined
}

function asLighting(v: unknown): SceneLighting | undefined {
  if (v === 'bright' || v === 'dim' || v === 'dark' || v === 'colorful') return v
  return undefined
}

function asBlockReason(v: unknown): VibeBlockReason | null {
  if (
    v === 'nsfw' ||
    v === 'violence' ||
    v === 'hate' ||
    v === 'illegal' ||
    v === 'not_a_photo'
  ) {
    return v
  }
  return null
}

/** Strip `data:image/...;base64,` prefix if present. */
export function normalizeBase64Payload(raw: string): {
  mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
  data: string
} | null {
  const trimmed = raw.trim()
  const dataUrlMatch = /^data:(image\/(?:jpeg|png|gif|webp));base64,(.+)$/i.exec(trimmed)
  if (dataUrlMatch) {
    const mediaType = dataUrlMatch[1].toLowerCase() as
      | 'image/jpeg'
      | 'image/png'
      | 'image/gif'
      | 'image/webp'
    return { mediaType, data: dataUrlMatch[2].replace(/\s+/g, '') }
  }
  if (/^[A-Za-z0-9+/=\s]+$/.test(trimmed) && trimmed.replace(/\s+/g, '').length > 32) {
    return { mediaType: 'image/jpeg', data: trimmed.replace(/\s+/g, '') }
  }
  return null
}

export function parseVibeAssessJson(text: string): VibeAssessResult | null {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start === -1 || end <= start) return null
    try {
      parsed = JSON.parse(cleaned.slice(start, end + 1))
    } catch {
      return null
    }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  const obj = parsed as Record<string, unknown>
  if (!isEnergyRating(obj.energyRating)) return null

  const tags = Array.isArray(obj.tags)
    ? obj.tags
        .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
        .map((t) => t.trim().toLowerCase().replace(/^#/, '').slice(0, 32))
        .slice(0, 5)
    : []

  const summary =
    typeof obj.summary === 'string' && obj.summary.trim().length > 0
      ? obj.summary.trim().slice(0, 240)
      : `${obj.energyRating} vibes from the photo`

  const suggestedCaption =
    typeof obj.suggestedCaption === 'string' && obj.suggestedCaption.trim().length > 0
      ? obj.suggestedCaption.trim().slice(0, 100)
      : undefined

  const safe = obj.safe === false ? false : true
  const blockedReason = safe ? null : asBlockReason(obj.blockedReason) ?? 'nsfw'

  return {
    energyRating: obj.energyRating,
    confidence: clamp01(typeof obj.confidence === 'number' ? obj.confidence : 0.5),
    summary,
    tags,
    crowdDensity: asCrowd(obj.crowdDensity),
    lighting: asLighting(obj.lighting),
    suggestedCaption,
    safe,
    blockedReason,
  }
}

function buildImageBlock(image: VibeImageSource): AnthropicImageBlock {
  if (image.type === 'url') {
    return { type: 'image', source: { type: 'url', url: image.url } }
  }
  return {
    type: 'image',
    source: {
      type: 'base64',
      media_type: image.mediaType,
      data: image.data,
    },
  }
}

function validateImage(image: VibeImageSource): string | null {
  if (image.type === 'url') {
    let parsed: URL
    try {
      parsed = new URL(image.url)
    } catch {
      return 'imageUrl must be a valid URL'
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return 'imageUrl must use http or https'
    }
    if (image.url.length > 2048) return 'imageUrl is too long'
    return null
  }
  if (!image.data || image.data.length < 32) return 'imageBase64 is too short'
  if (image.data.length > MAX_BASE64_CHARS) {
    return `imageBase64 exceeds ${MAX_BASE64_CHARS} characters`
  }
  return null
}

/**
 * Call Claude vision and return a structured vibe assessment plus usage/cost.
 */
export async function assessVenueVibe(
  params: AssessVenueVibeParams,
): Promise<AssessVenueVibeOutcome> {
  const invalid = validateImage(params.image)
  if (invalid) {
    throw new AnthropicError(invalid, 400)
  }

  const model = params.model || process.env.VIBE_VISION_MODEL || DEFAULT_MODEL
  const contextBits: string[] = []
  if (params.venueName) contextBits.push(`Venue name: ${params.venueName}`)
  if (params.venueCategory) contextBits.push(`Category: ${params.venueCategory}`)

  const userBlocks: AnthropicContentBlock[] = [
    buildImageBlock(params.image),
    {
      type: 'text',
      text:
        (contextBits.length > 0 ? `${contextBits.join('\n')}\n\n` : '') +
        'Assess the vibe of this location from the photo. Return JSON only.',
    },
  ]

  const result = await callClaude({
    apiKey: params.apiKey,
    model,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userBlocks }],
    maxTokens: 512,
    maxIterations: 1,
    fetchImpl: params.fetchImpl,
  })

  const parsed = parseVibeAssessJson(result.text)
  if (!parsed) {
    throw new AnthropicError('Model returned unparseable vibe assessment', 502)
  }

  return {
    result: parsed,
    usage: result.totalUsage,
    costCents: estimateCostCents(result.totalUsage, model),
    model,
  }
}
