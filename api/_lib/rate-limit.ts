/**
 * In-memory fixed-window rate limiter keyed by `<bucket>:<identifier>`.
 *
 * Vercel Edge Functions are stateless per-invocation in production, so this
 * is best-effort: it mitigates burst abuse from a single warm instance but
 * is NOT a durable rate limit. Swap for Upstash/Redis once traffic warrants.
 */

type Bucket = {
  count: number
  resetAt: number
}

const buckets: Map<string, Bucket> = (() => {
  const g = globalThis as unknown as { __rateLimitBuckets?: Map<string, Bucket> }
  if (!g.__rateLimitBuckets) g.__rateLimitBuckets = new Map()
  return g.__rateLimitBuckets
})()

export interface RateLimitResult {
  ok: boolean
  remaining: number
  resetAt: number
}

export function rateLimit(
  bucket: string,
  identifier: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const key = `${bucket}:${identifier}`
  const now = Date.now()
  const existing = buckets.get(key)

  if (!existing || existing.resetAt <= now) {
    const fresh: Bucket = { count: 1, resetAt: now + windowMs }
    buckets.set(key, fresh)
    return { ok: true, remaining: limit - 1, resetAt: fresh.resetAt }
  }

  if (existing.count >= limit) {
    return { ok: false, remaining: 0, resetAt: existing.resetAt }
  }

  existing.count += 1
  return { ok: true, remaining: limit - existing.count, resetAt: existing.resetAt }
}
