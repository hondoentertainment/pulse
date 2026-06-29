/**
 * Shared pulse row → app-shape mapper for Edge Functions (Wave 4).
 * Mirrors `src/lib/pulse-media.ts` without importing client code.
 */

type EnergyRating = 'dead' | 'chill' | 'buzzing' | 'electric'

export interface PulseRow {
  id: string
  user_id: string
  venue_id: string
  crew_id: string | null
  photos: string[] | null
  video_url: string | null
  energy_rating: EnergyRating
  caption: string | null
  hashtags: string[] | null
  views: number | null
  is_pioneer: boolean | null
  credibility_weight: number | null
  reactions: Record<string, string[]> | null
  created_at: string
  expires_at: string
  deleted_at?: string | null
}

export interface AppPulse {
  id: string
  userId: string
  venueId: string
  crewId?: string
  photos: string[]
  video?: string
  energyRating: EnergyRating
  caption?: string
  hashtags: string[]
  views: number
  isPioneer: boolean
  credibilityWeight: number
  reactions: Record<string, string[]>
  createdAt: string
  expiresAt: string
  isPending: false
  uploadError: false
}

const ABSOLUTE_URL = /^https?:\/\//i
const STORAGE_OBJECT_PREFIX = '/storage/v1/object/public/'
const DEFAULT_VIDEO_BUCKET = 'pulse-videos'

function readSupabaseBase(): string | null {
  const base = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  if (!base) return null
  return base.replace(/\/$/, '')
}

export function resolvePulseMediaUrl(raw: string | null | undefined): string | undefined {
  if (raw == null || typeof raw !== 'string') return undefined
  const trimmed = raw.trim()
  if (!trimmed) return undefined

  if (
    ABSOLUTE_URL.test(trimmed) ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('/')
  ) {
    return trimmed
  }

  const base = readSupabaseBase()
  if (!base) return trimmed

  const path = trimmed.replace(/^\/+/, '')
  const bucket = path.startsWith(`${DEFAULT_VIDEO_BUCKET}/`)
    ? DEFAULT_VIDEO_BUCKET
    : DEFAULT_VIDEO_BUCKET
  const objectPath = path.startsWith(`${bucket}/`)
    ? path.slice(bucket.length + 1)
    : path
  return `${base}${STORAGE_OBJECT_PREFIX}${bucket}/${objectPath}`
}

export function normalizePulseTimestamp(value: string | null | undefined): string {
  if (typeof value !== 'string' || !value.trim()) return new Date(0).toISOString()
  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) return new Date(0).toISOString()
  return new Date(parsed).toISOString()
}

export function rowToAppPulse(row: PulseRow): AppPulse {
  return {
    id: row.id,
    userId: row.user_id,
    venueId: row.venue_id,
    crewId: row.crew_id ?? undefined,
    photos: (row.photos ?? [])
      .map((photo) => resolvePulseMediaUrl(photo) ?? photo)
      .filter((photo): photo is string => Boolean(photo)),
    video: resolvePulseMediaUrl(row.video_url),
    energyRating: row.energy_rating,
    caption: row.caption ?? undefined,
    hashtags: row.hashtags ?? [],
    views: row.views ?? 0,
    isPioneer: row.is_pioneer ?? false,
    credibilityWeight: row.credibility_weight ?? 1.0,
    reactions: row.reactions ?? { fire: [], eyes: [], skull: [], lightning: [] },
    createdAt: normalizePulseTimestamp(row.created_at),
    expiresAt: normalizePulseTimestamp(row.expires_at),
    isPending: false,
    uploadError: false,
  }
}

export const PULSE_SELECT_COLUMNS = `
  id, user_id, venue_id, crew_id, photos, video_url,
  energy_rating, caption, hashtags, views, is_pioneer,
  credibility_weight, reactions, created_at, expires_at, deleted_at
`.trim()
