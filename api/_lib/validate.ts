/**
 * Lightweight manual validators.
 *
 * zod *is* installed in the app (package.json dep) but we want these
 * functions to run in the thin Vercel runtime without dragging extra
 * runtime deps, so we hand-roll the checks.
 */

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: string[] }

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function asString(value: unknown, min = 1, max = 2000): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (trimmed.length < min || trimmed.length > max) return null
  return trimmed
}

export function asNumber(
  value: unknown,
  opts: { min?: number; max?: number } = {}
): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  if (opts.min !== undefined && value < opts.min) return null
  if (opts.max !== undefined && value > opts.max) return null
  return value
}

export function asLatLng(value: unknown): { lat: number; lng: number } | null {
  if (!isPlainObject(value)) return null
  const lat = asNumber(value.lat, { min: -90, max: 90 })
  const lng = asNumber(value.lng, { min: -180, max: 180 })
  if (lat === null || lng === null) return null
  return { lat, lng }
}

export function asEnum<T extends string>(
  value: unknown,
  allowed: readonly T[]
): T | null {
  if (typeof value !== 'string') return null
  return (allowed as readonly string[]).includes(value) ? (value as T) : null
}

export function asStringArray(
  value: unknown,
  opts: { maxItems?: number; maxLength?: number } = {}
): string[] | null {
  if (!Array.isArray(value)) return null
  if (opts.maxItems !== undefined && value.length > opts.maxItems) return null
  const out: string[] = []
  for (const item of value) {
    const s = asString(item, 1, opts.maxLength ?? 200)
    if (s === null) return null
    out.push(s)
  }
  return out
}

export function asHttpsUrl(value: unknown): string | null {
  const s = asString(value, 1, 2048)
  if (s === null) return null
  try {
    const parsed = new URL(s)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null
    return s
  } catch {
    return null
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function asUuid(value: unknown): string | null {
  if (typeof value !== 'string') return null
  return UUID_RE.test(value) ? value : null
}

export function asInteger(
  value: unknown,
  opts: { min?: number; max?: number } = {},
): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value)) return null
  if (opts.min !== undefined && value < opts.min) return null
  if (opts.max !== undefined && value > opts.max) return null
  return value
}
