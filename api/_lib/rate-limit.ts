/**
 * In-memory token-bucket rate limiter for serverless handlers.
 * Per-instance only — good enough for scan bursts at a single door;
 * swap for Upstash/Redis for cross-region accuracy.
 */

interface Bucket {
  tokens: number
  updatedAt: number
}

const buckets = new Map<string, Bucket>()

export interface RateLimitConfig {
  maxTokens: number
  refillPerSec: number
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterMs: number
}

export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now()
  const bucket = buckets.get(key) ?? { tokens: config.maxTokens, updatedAt: now }
  const elapsedSec = (now - bucket.updatedAt) / 1000
  const refilled = Math.min(config.maxTokens, bucket.tokens + elapsedSec * config.refillPerSec)
  if (refilled >= 1) {
    const next = { tokens: refilled - 1, updatedAt: now }
    buckets.set(key, next)
    return { allowed: true, remaining: Math.floor(next.tokens), retryAfterMs: 0 }
  }
  const retryAfterMs = Math.ceil(((1 - refilled) / config.refillPerSec) * 1000)
  buckets.set(key, { tokens: refilled, updatedAt: now })
  return { allowed: false, remaining: 0, retryAfterMs }
}

export function __clearRateLimits(): void {
  buckets.clear()
}
