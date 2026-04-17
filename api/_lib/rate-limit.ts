/**
 * Simple in-memory sliding-window rate limiter.
 *
 * Good enough for per-instance protection. For true multi-region limits
 * swap in @upstash/ratelimit (not currently installed). The public API
 * here is intentionally similar so the swap is mechanical.
 */

type Bucket = {
  timestamps: number[]
}

const buckets = new Map<string, Bucket>()

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  limit: number
  resetMs: number
  retryAfterSeconds?: number
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now()
  const cutoff = now - windowMs
  const bucket = buckets.get(key) ?? { timestamps: [] }
  bucket.timestamps = bucket.timestamps.filter(ts => ts > cutoff)

  if (bucket.timestamps.length >= limit) {
    buckets.set(key, bucket)
    const oldest = bucket.timestamps[0] ?? now
    const retryAfterMs = Math.max(0, oldest + windowMs - now)
    return {
      allowed: false,
      remaining: 0,
      limit,
      resetMs: retryAfterMs,
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
    }
  }

  bucket.timestamps.push(now)
  buckets.set(key, bucket)
  return {
    allowed: true,
    remaining: limit - bucket.timestamps.length,
    limit,
    resetMs: windowMs,
  }
}

export function clientKey(
  req: { headers?: Record<string, string | string[] | undefined> },
  scope: string
): string {
  const headers = req.headers ?? {}
  const forwarded =
    (headers['x-forwarded-for'] as string | undefined) ??
    (headers['X-Forwarded-For'] as string | undefined) ??
    ''
  const ip = forwarded.split(',')[0]?.trim() || 'unknown'
  return `${scope}:${ip}`
}
