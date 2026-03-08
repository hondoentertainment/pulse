/**
 * Rate Limiter & Abuse Prevention
 *
 * Token bucket rate limiting for API endpoints and abuse detection.
 */

export interface RateLimitConfig {
  maxTokens: number
  refillRate: number   // tokens per second
  windowMs: number
}

export interface RateLimitBucket {
  tokens: number
  lastRefill: number
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterMs: number
}

/** Pre-configured limits for different actions */
export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  pulse_create: { maxTokens: 5, refillRate: 0.0028, windowMs: 1800000 },    // 5 per 30 min
  reaction: { maxTokens: 30, refillRate: 0.5, windowMs: 60000 },            // 30 per min
  venue_search: { maxTokens: 20, refillRate: 1, windowMs: 60000 },          // 20 per min
  friend_request: { maxTokens: 10, refillRate: 0.017, windowMs: 600000 },   // 10 per 10 min
  share_create: { maxTokens: 15, refillRate: 0.25, windowMs: 60000 },       // 15 per min
  report: { maxTokens: 3, refillRate: 0.001, windowMs: 3600000 },           // 3 per hour
}

const buckets: Map<string, RateLimitBucket> = new Map()

/**
 * Refill tokens based on elapsed time.
 */
function refillBucket(bucket: RateLimitBucket, config: RateLimitConfig): RateLimitBucket {
  const now = Date.now()
  const elapsed = (now - bucket.lastRefill) / 1000
  const newTokens = Math.min(config.maxTokens, bucket.tokens + elapsed * config.refillRate)
  return { tokens: newTokens, lastRefill: now }
}

/**
 * Check rate limit and consume a token if allowed.
 */
export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const bucketKey = key
  let bucket = buckets.get(bucketKey)

  if (!bucket) {
    bucket = { tokens: config.maxTokens, lastRefill: Date.now() }
  }

  bucket = refillBucket(bucket, config)

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1
    buckets.set(bucketKey, bucket)
    return {
      allowed: true,
      remaining: Math.floor(bucket.tokens),
      retryAfterMs: 0,
    }
  }

  buckets.set(bucketKey, bucket)
  const retryAfterMs = Math.ceil((1 - bucket.tokens) / config.refillRate * 1000)
  return {
    allowed: false,
    remaining: 0,
    retryAfterMs,
  }
}

/**
 * Check rate limit for a user + action combination.
 */
export function checkUserRateLimit(
  userId: string,
  action: keyof typeof RATE_LIMITS
): RateLimitResult {
  const config = RATE_LIMITS[action]
  if (!config) return { allowed: true, remaining: 999, retryAfterMs: 0 }
  return checkRateLimit(`${userId}:${action}`, config)
}

/**
 * Reset rate limit for a user + action (admin use).
 */
export function resetRateLimit(userId: string, action: string): void {
  buckets.delete(`${userId}:${action}`)
}

/**
 * Clear all rate limit buckets.
 */
export function clearAllRateLimits(): void {
  buckets.clear()
}

/**
 * Abuse detection — checks for suspicious patterns.
 */
export interface AbuseSignal {
  type: 'rapid_fire' | 'alternating_ratings' | 'spam_content' | 'location_spoofing'
  severity: 'low' | 'medium' | 'high'
  description: string
}

export function detectAbuse(
  userId: string,
  recentActions: { action: string; timestamp: number; metadata?: Record<string, any> }[]
): AbuseSignal[] {
  const signals: AbuseSignal[] = []
  const now = Date.now()
  const fiveMinutes = 5 * 60 * 1000

  // Rapid fire: too many actions in short window
  const recentCount = recentActions.filter(a => now - a.timestamp < fiveMinutes).length
  if (recentCount > 20) {
    signals.push({
      type: 'rapid_fire',
      severity: recentCount > 50 ? 'high' : 'medium',
      description: `${recentCount} actions in 5 minutes`,
    })
  }

  // Alternating ratings: flip-flopping energy ratings (gaming the system)
  const ratingActions = recentActions
    .filter(a => a.action === 'pulse_create' && a.metadata?.energyRating)
    .sort((a, b) => a.timestamp - b.timestamp)

  if (ratingActions.length >= 4) {
    let alternations = 0
    for (let i = 2; i < ratingActions.length; i++) {
      const prev = ratingActions[i - 2].metadata?.energyRating
      const curr = ratingActions[i].metadata?.energyRating
      if (prev === curr && prev !== ratingActions[i - 1].metadata?.energyRating) {
        alternations++
      }
    }
    if (alternations >= 2) {
      signals.push({
        type: 'alternating_ratings',
        severity: 'medium',
        description: 'Suspicious rating pattern detected',
      })
    }
  }

  return signals
}
