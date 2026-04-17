/**
 * In-memory rate limiter (token bucket per key).
 *
 * Fine for a single Edge Function instance. For production with multiple
 * replicas, back this with Redis or Supabase — but the interface is the
 * same either way.
 */

interface Bucket {
  count: number
  windowStart: number
}

const STORE: Map<string, Bucket> = (() => {
  const g = globalThis as unknown as { __rateLimitStore?: Map<string, Bucket> }
  if (!g.__rateLimitStore) g.__rateLimitStore = new Map()
  return g.__rateLimitStore
})()

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAtMs: number
}

export function rateLimit(key: string, max: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const bucket = STORE.get(key)
  if (!bucket || now - bucket.windowStart >= windowMs) {
    STORE.set(key, { count: 1, windowStart: now })
    return { allowed: true, remaining: max - 1, resetAtMs: now + windowMs }
  }
  if (bucket.count >= max) {
    return { allowed: false, remaining: 0, resetAtMs: bucket.windowStart + windowMs }
  }
  bucket.count += 1
  return { allowed: true, remaining: max - bucket.count, resetAtMs: bucket.windowStart + windowMs }
}

/** Test helper — never call in production code paths. */
export function _resetRateLimits(): void {
  STORE.clear()
}
