/**
 * In-memory token-bucket rate limiter for Edge Functions.
 *
 * Per-process memory — good enough for low-QPS endpoints. For a multi-region
 * rollout this should be swapped for a Redis/Upstash-backed implementation;
 * the interface is intentionally identical so the swap is a drop-in.
 */

export interface RateLimitConfig {
  /** Max tokens held in the bucket (burst size). */
  maxTokens: number
  /** Tokens added per second. */
  refillRatePerSec: number
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterSeconds: number
}

interface Bucket {
  tokens: number
  lastRefillMs: number
}

const buckets = new Map<string, Bucket>()

export function checkRateLimit(
  key: string,
  config: RateLimitConfig,
  now: number = Date.now(),
): RateLimitResult {
  let bucket = buckets.get(key)
  if (!bucket) {
    bucket = { tokens: config.maxTokens, lastRefillMs: now }
    buckets.set(key, bucket)
  }

  const elapsedSec = Math.max(0, (now - bucket.lastRefillMs) / 1000)
  bucket.tokens = Math.min(
    config.maxTokens,
    bucket.tokens + elapsedSec * config.refillRatePerSec,
  )
  bucket.lastRefillMs = now

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1
    return {
      allowed: true,
      remaining: Math.floor(bucket.tokens),
      retryAfterSeconds: 0,
    }
  }

  const retryAfterSeconds = Math.max(1, Math.ceil((1 - bucket.tokens) / config.refillRatePerSec))
  return { allowed: false, remaining: 0, retryAfterSeconds }
}

/** Test hook — clears all buckets. Not exported from production index. */
export function __resetRateLimiter(): void {
  buckets.clear()
}
