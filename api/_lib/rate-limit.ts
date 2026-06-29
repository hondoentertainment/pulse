/**
 * In-memory rate limiters for Edge Functions.
 *
 * Two APIs coexist:
 *
 *   1. `rateLimit(key, limit, windowMs)` + `clientKey(req, scope)` — a simple
 *      sliding-window limiter used by integration endpoints (Spotify, Uber,
 *      Lyft, geocode, webhook sign, key generation).
 *   2. `consume(key, bucketName)` + `RATE_LIMITS` registry — a token-bucket
 *      limiter with named buckets, used by higher-trust write endpoints
 *      (moderation checks, pulse creation).
 *
 * For true multi-region limits swap the backing store for @upstash/ratelimit.
 * Both public APIs are intentionally shaped to make that swap mechanical.
 */

// ─── Sliding-window limiter (used by integration endpoints) ───

type SlidingBucket = {
  timestamps: number[]
}

const slidingBuckets = new Map<string, SlidingBucket>()

export interface SlidingRateLimitResult {
  allowed: boolean
  ok: boolean
  remaining: number
  limit: number
  resetMs: number
  resetAt: number
  retryAfterSeconds?: number
}

export function rateLimit(
  key: string,
  limitOrUser: number | string,
  limitOrWindowMs: number,
  maybeWindowMs?: number,
): SlidingRateLimitResult {
  const compositeKey = typeof limitOrUser === 'string' ? `${key}:${limitOrUser}` : key
  const limit = typeof limitOrUser === 'number' ? limitOrUser : limitOrWindowMs
  const windowMs = typeof limitOrUser === 'number' ? limitOrWindowMs : (maybeWindowMs ?? limitOrWindowMs)
  const now = Date.now()
  const cutoff = now - windowMs
  const bucket = slidingBuckets.get(compositeKey) ?? { timestamps: [] }
  bucket.timestamps = bucket.timestamps.filter(ts => ts > cutoff)

  if (bucket.timestamps.length >= limit) {
    slidingBuckets.set(compositeKey, bucket)
    const oldest = bucket.timestamps[0] ?? now
    const retryAfterMs = Math.max(0, oldest + windowMs - now)
    return {
      allowed: false,
      ok: false,
      remaining: 0,
      limit,
      resetMs: retryAfterMs,
      resetAt: now + retryAfterMs,
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
    }
  }

  bucket.timestamps.push(now)
  slidingBuckets.set(compositeKey, bucket)
  return {
    allowed: true,
    ok: true,
    remaining: limit - bucket.timestamps.length,
    limit,
    resetMs: windowMs,
    resetAt: now + windowMs,
  }
}

export type LegacyRateLimitConfig = {
  maxTokens: number
  refillRatePerSec: number
}

export function checkRateLimit(
  key: string,
  config: LegacyRateLimitConfig,
): { allowed: boolean; remaining: number; retryAfterSeconds?: number } {
  const windowMs = Math.max(
    1_000,
    Math.ceil((config.maxTokens / Math.max(config.refillRatePerSec, 0.000001)) * 1000),
  )
  const result = rateLimit(key, config.maxTokens, windowMs)
  return {
    allowed: result.allowed,
    remaining: result.remaining,
    retryAfterSeconds: result.retryAfterSeconds,
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

// ─── Token-bucket limiter (used by write endpoints) ───

export type RateLimitConfig = {
  /** Burst capacity (max tokens). */
  maxTokens: number
  /** Tokens added per second while idle. */
  refillRate: number
  /** Window size — used only for diagnostic labelling. */
  windowMs: number
}

export type TokenBucketResult = {
  allowed: boolean
  remaining: number
  retryAfterMs: number
  limit: number
}

type TokenBucket = {
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
  // 10 GDPR exports per hour per user.
  account_export: { maxTokens: 10, refillRate: 10 / 3600, windowMs: 3_600_000 },
  // 3 account deletions per day per user (prevents accidental hammering).
  account_delete: { maxTokens: 3, refillRate: 3 / 86_400, windowMs: 86_400_000 },
  // 5 test pushes per hour per user (ops/device verification).
  push_test: { maxTokens: 5, refillRate: 5 / 3600, windowMs: 3_600_000 },
  // Generic write default — used when an endpoint forgets to pick a bucket.
  default_write: { maxTokens: 30, refillRate: 0.5, windowMs: 60_000 },
} as const satisfies Record<string, RateLimitConfig>

export type RateLimitName = keyof typeof RATE_LIMITS

const globalKey = '__pulseEdgeRateLimitBuckets'
type GlobalWithBuckets = typeof globalThis & {
  [globalKey]?: Map<string, TokenBucket>
}

const getStore = (): Map<string, TokenBucket> => {
  const g = globalThis as GlobalWithBuckets
  if (!g[globalKey]) {
    g[globalKey] = new Map<string, TokenBucket>()
  }
  return g[globalKey]!
}

const refill = (bucket: TokenBucket, config: RateLimitConfig): TokenBucket => {
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
): TokenBucketResult => {
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

/** Test-only helper: clear all token buckets. */
export const resetAll = (): void => {
  getStore().clear()
}
