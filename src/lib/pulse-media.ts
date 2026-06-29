/**
 * Normalize pulse media URLs and timestamps for consistent client rendering.
 * Wave 4 — server-backed pulses share the same rules via `api/_lib/pulse-mapper.ts`.
 */

import type { Pulse } from '@/lib/types'

export type MediaQuality = 'auto' | 'low' | 'high'

const ABSOLUTE_URL = /^https?:\/\//i
const STORAGE_OBJECT_PREFIX = '/storage/v1/object/public/'
const DEFAULT_VIDEO_BUCKET = 'pulse-videos'

function readSupabaseBase(explicit?: string): string | null {
  const base = explicit ?? import.meta.env.VITE_SUPABASE_URL
  if (typeof base !== 'string' || base.length === 0) return null
  return base.replace(/\/$/, '')
}

/**
 * Resolve a stored object key or relative path to a public CDN URL.
 * Absolute http(s), data:, and same-origin paths are returned unchanged.
 */
export function resolvePulseMediaUrl(
  raw: string | null | undefined,
  opts?: { supabaseUrl?: string; quality?: MediaQuality },
): string | undefined {
  if (raw == null || typeof raw !== 'string') return undefined
  const trimmed = raw.trim()
  if (!trimmed) return undefined

  let url = trimmed
  if (
    !ABSOLUTE_URL.test(trimmed) &&
    !trimmed.startsWith('data:') &&
    !trimmed.startsWith('/')
  ) {
    const base = readSupabaseBase(opts?.supabaseUrl)
    if (base) {
      const path = trimmed.replace(/^\/+/, '')
      const bucket = path.startsWith(`${DEFAULT_VIDEO_BUCKET}/`)
        ? DEFAULT_VIDEO_BUCKET
        : DEFAULT_VIDEO_BUCKET
      const objectPath = path.startsWith(`${bucket}/`)
        ? path.slice(bucket.length + 1)
        : path
      url = `${base}${STORAGE_OBJECT_PREFIX}${bucket}/${objectPath}`
    }
  }

  if (opts?.quality === 'low' && url.includes(STORAGE_OBJECT_PREFIX) && !url.includes('q=low')) {
    url = `${url}${url.includes('?') ? '&' : '?'}q=low`
  }

  return url
}

/** Ensure ISO-8601 timestamps from API/DB rows. */
export function normalizePulseTimestamp(value: string | null | undefined): string {
  if (typeof value !== 'string' || !value.trim()) return new Date(0).toISOString()
  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) return new Date(0).toISOString()
  return new Date(parsed).toISOString()
}

export function normalizePulseMedia<T extends Pick<Pulse, 'photos' | 'video'>>(
  pulse: T,
  opts?: { supabaseUrl?: string; quality?: MediaQuality },
): T {
  return {
    ...pulse,
    photos: (pulse.photos ?? [])
      .map((photo) => resolvePulseMediaUrl(photo, opts) ?? photo)
      .filter((photo): photo is string => Boolean(photo)),
    video: resolvePulseMediaUrl(pulse.video, opts),
  }
}

export function normalizePulse<T extends Pulse>(pulse: T, opts?: { supabaseUrl?: string }): T {
  return {
    ...normalizePulseMedia(pulse, opts),
    createdAt: normalizePulseTimestamp(pulse.createdAt),
    expiresAt: normalizePulseTimestamp(pulse.expiresAt),
  }
}
