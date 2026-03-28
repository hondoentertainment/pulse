/**
 * Enhanced Rate Limiter & Abuse Prevention
 *
 * Sliding-window token-bucket rate limiting with:
 *  - Per-user keying by user ID
 *  - Operation-specific limits
 *  - Abuse-pattern detection
 *  - Standard rate-limit response headers
 *  - Persistent client-side enforcement via localStorage
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RateLimitConfig {
  /** Maximum tokens in the bucket */
  maxTokens: number;
  /** Tokens added per second */
  refillRate: number;
  /** Window duration in milliseconds (used for header reset calculation) */
  windowMs: number;
}

export interface RateLimitBucket {
  tokens: number;
  lastRefill: number;
  /** Timestamps of the last N actions for sliding-window abuse detection */
  recentTimestamps: number[];
}

export interface RateLimitResult {
  allowed: boolean;
  /** Tokens remaining after this request */
  remaining: number;
  /** Milliseconds until the next token becomes available (0 when allowed) */
  retryAfterMs: number;
  /** HTTP headers to attach to the response */
  headers: RateLimitHeaders;
}

export interface RateLimitHeaders {
  'X-RateLimit-Limit': string;
  'X-RateLimit-Remaining': string;
  'X-RateLimit-Reset': string;
  /** Present only when the request was blocked */
  'Retry-After'?: string;
}

export interface AbuseSignal {
  type: 'rapid_fire' | 'alternating_ratings' | 'spam_content' | 'location_spoofing';
  severity: 'low' | 'medium' | 'high';
  description: string;
}

// ---------------------------------------------------------------------------
// Operation-specific limits
// ---------------------------------------------------------------------------

export const ENHANCED_RATE_LIMITS: Record<string, RateLimitConfig> = {
  // 10 pulses per hour
  pulse_create: { maxTokens: 10, refillRate: 10 / 3600, windowMs: 3_600_000 },
  // 60 reactions per minute
  reaction: { maxTokens: 60, refillRate: 1, windowMs: 60_000 },
  // 30 search queries per minute
  search: { maxTokens: 30, refillRate: 0.5, windowMs: 60_000 },
  // 20 check-ins per hour
  check_in: { maxTokens: 20, refillRate: 20 / 3600, windowMs: 3_600_000 },
  // 5 reports per hour
  report: { maxTokens: 5, refillRate: 5 / 3600, windowMs: 3_600_000 },
  // 10 profile updates per hour
  profile_update: { maxTokens: 10, refillRate: 10 / 3600, windowMs: 3_600_000 },
  // 5 stories per hour
  story_create: { maxTokens: 5, refillRate: 5 / 3600, windowMs: 3_600_000 },
  // Legacy aliases kept for compatibility with existing call sites
  venue_search: { maxTokens: 30, refillRate: 0.5, windowMs: 60_000 },
  friend_request: { maxTokens: 10, refillRate: 10 / 3600, windowMs: 3_600_000 },
  share_create: { maxTokens: 15, refillRate: 0.25, windowMs: 60_000 },
};

// ---------------------------------------------------------------------------
// In-process bucket store (server / Node context)
// ---------------------------------------------------------------------------

const inProcessBuckets = new Map<string, RateLimitBucket>();

// ---------------------------------------------------------------------------
// localStorage persistence helpers (client / browser context)
// ---------------------------------------------------------------------------

const LS_PREFIX = 'rl_bucket:';

function loadBucketFromStorage(key: string): RateLimitBucket | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw) as RateLimitBucket;
  } catch {
    return null;
  }
}

function saveBucketToStorage(key: string, bucket: RateLimitBucket): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(bucket));
  } catch {
    // Storage quota exceeded or private browsing — degrade gracefully.
  }
}

function removeBucketFromStorage(key: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.removeItem(LS_PREFIX + key);
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// Bucket helpers
// ---------------------------------------------------------------------------

function getBucket(key: string): RateLimitBucket | null {
  return inProcessBuckets.get(key) ?? loadBucketFromStorage(key);
}

function putBucket(key: string, bucket: RateLimitBucket): void {
  inProcessBuckets.set(key, bucket);
  saveBucketToStorage(key, bucket);
}

function refillBucket(bucket: RateLimitBucket, config: RateLimitConfig): RateLimitBucket {
  const now = Date.now();
  const elapsedSeconds = (now - bucket.lastRefill) / 1000;
  const addedTokens = elapsedSeconds * config.refillRate;
  const newTokens = Math.min(config.maxTokens, bucket.tokens + addedTokens);
  return { ...bucket, tokens: newTokens, lastRefill: now };
}

function buildHeaders(
  config: RateLimitConfig,
  remaining: number,
  retryAfterMs: number,
): RateLimitHeaders {
  const resetEpochSeconds = Math.ceil((Date.now() + config.windowMs) / 1000);
  const headers: RateLimitHeaders = {
    'X-RateLimit-Limit': String(config.maxTokens),
    'X-RateLimit-Remaining': String(Math.max(0, remaining)),
    'X-RateLimit-Reset': String(resetEpochSeconds),
  };
  if (retryAfterMs > 0) {
    headers['Retry-After'] = String(Math.ceil(retryAfterMs / 1000));
  }
  return headers;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Core check-and-consume function.  Returns a detailed result including
 * standard HTTP rate-limit headers suitable for attaching to API responses.
 */
export function checkRateLimitEnhanced(
  key: string,
  config: RateLimitConfig,
): RateLimitResult {
  const now = Date.now();
  let bucket = getBucket(key) ?? {
    tokens: config.maxTokens,
    lastRefill: now,
    recentTimestamps: [],
  };

  bucket = refillBucket(bucket, config);

  // Prune timestamps older than 10 seconds (used by rapid-fire detection)
  bucket.recentTimestamps = bucket.recentTimestamps.filter(t => now - t < 10_000);

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    bucket.recentTimestamps.push(now);
    putBucket(key, bucket);
    const remaining = Math.floor(bucket.tokens);
    return {
      allowed: true,
      remaining,
      retryAfterMs: 0,
      headers: buildHeaders(config, remaining, 0),
    };
  }

  putBucket(key, bucket);
  const retryAfterMs = Math.ceil(((1 - bucket.tokens) / config.refillRate) * 1000);
  return {
    allowed: false,
    remaining: 0,
    retryAfterMs,
    headers: buildHeaders(config, 0, retryAfterMs),
  };
}

/**
 * Check rate limit for a given user and named operation.
 * Falls back to allowing the request if the operation is unknown.
 */
export function checkUserRateLimitEnhanced(
  userId: string,
  operation: keyof typeof ENHANCED_RATE_LIMITS | string,
): RateLimitResult {
  const config = ENHANCED_RATE_LIMITS[operation];
  if (!config) {
    return {
      allowed: true,
      remaining: 999,
      retryAfterMs: 0,
      headers: buildHeaders({ maxTokens: 999, refillRate: 1, windowMs: 60_000 }, 999, 0),
    };
  }
  return checkRateLimitEnhanced(`${userId}:${operation}`, config);
}

/**
 * Reset the rate-limit bucket for a user + operation (admin/test use).
 */
export function resetRateLimitEnhanced(userId: string, operation: string): void {
  const key = `${userId}:${operation}`;
  inProcessBuckets.delete(key);
  removeBucketFromStorage(key);
}

/**
 * Wipe all in-process buckets and all rl_bucket:* localStorage entries.
 */
export function clearAllRateLimitsEnhanced(): void {
  inProcessBuckets.clear();
  if (typeof window !== 'undefined' && window.localStorage) {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(LS_PREFIX)) keysToRemove.push(k);
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  }
}

// ---------------------------------------------------------------------------
// Abuse detection
// ---------------------------------------------------------------------------

/**
 * Inspect a user's recent action log for suspicious patterns.
 * Returns an array of detected abuse signals (empty = clean).
 */
export function detectAbusePatterns(
  _userId: string,
  recentActions: {
    action: string;
    timestamp: number;
    metadata?: Record<string, unknown>;
  }[],
): AbuseSignal[] {
  const signals: AbuseSignal[] = [];
  const now = Date.now();

  // 1. Rapid-fire: more than 5 actions within 10 seconds
  const last10s = recentActions.filter(a => now - a.timestamp < 10_000);
  if (last10s.length > 5) {
    signals.push({
      type: 'rapid_fire',
      severity: last10s.length > 15 ? 'high' : 'medium',
      description: `${last10s.length} actions in the last 10 seconds`,
    });
  }

  // 2. High volume in 5-minute window (legacy threshold kept for compatibility)
  const last5min = recentActions.filter(a => now - a.timestamp < 300_000);
  if (last5min.length > 20 && last10s.length <= 5) {
    signals.push({
      type: 'rapid_fire',
      severity: last5min.length > 50 ? 'high' : 'medium',
      description: `${last5min.length} actions in 5 minutes`,
    });
  }

  // 3. Alternating energy ratings (gaming detection)
  const ratingActions = recentActions
    .filter(a => a.action === 'pulse_create' && a.metadata?.energyRating)
    .sort((a, b) => a.timestamp - b.timestamp);

  if (ratingActions.length >= 4) {
    let alternations = 0;
    for (let i = 2; i < ratingActions.length; i++) {
      const prev = ratingActions[i - 2].metadata?.energyRating;
      const curr = ratingActions[i].metadata?.energyRating;
      if (prev === curr && prev !== ratingActions[i - 1].metadata?.energyRating) {
        alternations++;
      }
    }
    if (alternations >= 2) {
      signals.push({
        type: 'alternating_ratings',
        severity: 'medium',
        description: 'Suspicious alternating rating pattern detected',
      });
    }
  }

  // 4. Suspicious location patterns: ≥5 different venues within 5 minutes
  const venueCheckIns = recentActions.filter(
    a => a.action === 'check_in' && a.metadata?.venueId && now - a.timestamp < 300_000,
  );
  const uniqueVenues = new Set(venueCheckIns.map(a => a.metadata?.venueId));
  if (uniqueVenues.size >= 5) {
    signals.push({
      type: 'location_spoofing',
      severity: 'high',
      description: `Check-ins at ${uniqueVenues.size} different venues within 5 minutes`,
    });
  }

  return signals;
}
