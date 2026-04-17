/**
 * In-memory token-bucket rate limiter for Edge Functions.
 *
 * Shares the same algorithm as `src/lib/rate-limiter.ts` but lives under
 * `api/_lib/` because the Edge runtime cannot import Vite-resolved client code.
 * Buckets are held per instance; for production we expect Vercel to reuse warm
 * instances but a cold start resets buckets. That's acceptable for abuse
 * throttling — accuracy is not the goal, resilience is.
 *
 * Named buckets are registered in `RATE_LIMITS` below. New endpoints MUST add a
 * named bucket rather than construct config inline, so we have a single audit
 * surface for throttles.
 */

export type RateLimitConfig = {
  /** Burst capacity (max tokens). */
  maxTokens: number
  /** Tokens added per second while idle. */
  refillRate: number
  /** Window size — used only for diagnostic labelling. */
  windowMs: number
}

export type RateLimitResult = {
  allowed: boolean
  remaining: number
  retryAfterMs: number
  limit: number
}

type Bucket = {
  tokens: number
  lastRefill: number
}

/**
 * Named rate-limit buckets.
 *
 * Naming convention: `<domain>_<verb>`.
 * Rates below are deliberately more generous on reads than writes.
 */
export const RATE_LIMITS = {
  // 60 moderation checks per minute per user (1/s sustained, burst to 60).
  moderation_check: { maxTokens: 60, refillRate: 1, windowMs: 60_000 },
  // 10 pulse creations per hour per user.
  pulse_create: { maxTokens: 10, refillRate: 10 / 3600, windowMs: 3_600_000 },
  // Generic write default — used when an endpoint forgets to pick a bucket.
  default_write: { maxTokens: 30, refillRate: 0.5, windowMs: 60_000 },
} as const satisfies Record<string, RateLimitConfig>

export type RateLimitName = keyof typeof RATE_LIMITS

const globalKey = '__pulseEdgeRateLimitBuckets'
type GlobalWithBuckets = typeof globalThis & {
  [globalKey]?: Map<string, Bucket>
}

const getStore = (): Map<string, Bucket> => {
  const g = globalThis as GlobalWithBuckets
  if (!g[globalKey]) {
    g[globalKey] = new Map<string, Bucket>()
  }
  return g[globalKey]!
}

const refill = (bucket: Bucket, config: RateLimitConfig): Bucket => {
  const now = Date.now()
  const elapsedSec = Math.max(0, (now - bucket.lastRefill) / 1000)
  const tokens = Math.min(
    config.maxTokens,
    bucket.tokens + elapsedSec * config.refillRate,
  )
  return { tokens, lastRefill: now }
}

/**
 * Consume one token for the given (key, bucket) pair.
 *
 * `key` should include the user id (or IP for unauthenticated flows) to avoid
 * one user starving another.
 */
export const consume = (
  key: string,
  name: RateLimitName,
): RateLimitResult => {
  const config = RATE_LIMITS[name]
  const store = getStore()
  const compositeKey = `${name}:${key}`

  const existing = store.get(compositeKey) ?? {
    tokens: config.maxTokens,
    lastRefill: Date.now(),
  }

  const refilled = refill(existing, config)

  if (refilled.tokens >= 1) {
    const next = { ...refilled, tokens: refilled.tokens - 1 }
    store.set(compositeKey, next)
    return {
      allowed: true,
      remaining: Math.floor(next.tokens),
      retryAfterMs: 0,
      limit: config.maxTokens,
    }
  }

  store.set(compositeKey, refilled)
  const deficit = 1 - refilled.tokens
  const retryAfterMs = Math.ceil((deficit / config.refillRate) * 1000)
  return {
    allowed: false,
    remaining: 0,
    retryAfterMs,
    limit: config.maxTokens,
  }
}

/** Test-only helper: clear all buckets. */
export const resetAll = (): void => {
  getStore().clear()
}
