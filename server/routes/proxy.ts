/**
 * Server-Side Proxy Routes
 *
 * Express route handlers that proxy external API calls on behalf of the client.
 * These routes ensure that:
 * - Third-party API rate limits are managed server-side (not per-browser)
 * - Secrets (webhook HMAC keys, future API keys) never reach the client
 * - Responses can be cached to reduce external API load
 * - Abuse can be rate-limited per authenticated user
 */

import { Router, Request, Response, NextFunction } from 'express'
import { createHmac } from 'crypto'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RateLimitEntry {
  count: number
  resetAt: number
}

interface WebhookSubscription {
  id: string
  url: string
  secret: string
  active: boolean
  failureCount: number
}

// ---------------------------------------------------------------------------
// Rate Limiting Middleware (Stub)
// ---------------------------------------------------------------------------

/**
 * In-memory rate limiter stub.
 *
 * Production implementation should use Redis or a similar shared store
 * so that limits are enforced across multiple server instances.
 *
 * This stub uses a per-IP Map and is suitable for single-instance
 * development only.
 */
const rateLimitStore = new Map<string, RateLimitEntry>()

/**
 * Creates a rate limiting middleware.
 *
 * @param windowMs - Time window in milliseconds
 * @param maxRequests - Maximum requests allowed in the window
 * @param keyPrefix - Prefix to namespace rate limit keys
 */
function rateLimit(windowMs: number, maxRequests: number, keyPrefix: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown'
    const key = `${keyPrefix}:${ip}`
    const now = Date.now()

    const entry = rateLimitStore.get(key)

    if (!entry || now > entry.resetAt) {
      // Window expired or first request — start a new window
      rateLimitStore.set(key, { count: 1, resetAt: now + windowMs })
      res.set('X-RateLimit-Limit', String(maxRequests))
      res.set('X-RateLimit-Remaining', String(maxRequests - 1))
      next()
      return
    }

    if (entry.count >= maxRequests) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
      res.set('Retry-After', String(retryAfter))
      res.status(429).json({
        data: null,
        error: {
          code: 'RATE_LIMITED',
          message: `Too many requests. Retry after ${retryAfter} seconds.`,
        },
      })
      return
    }

    entry.count++
    res.set('X-RateLimit-Limit', String(maxRequests))
    res.set('X-RateLimit-Remaining', String(maxRequests - entry.count))
    next()
  }
}

// ---------------------------------------------------------------------------
// API Key Validation Middleware (Stub)
// ---------------------------------------------------------------------------

/**
 * Validates that the request includes a valid API key or auth session.
 *
 * In production, this middleware should:
 * 1. Check the Authorization header for a valid Bearer token (user sessions)
 * 2. Or check the X-API-Key header for a valid API key (developer API)
 * 3. Look up the key/session in the database
 * 4. Attach the authenticated user or API key to req for downstream use
 *
 * This stub always passes through to allow development without auth.
 */
function validateApiKeyOrSession(req: Request, res: Response, next: NextFunction): void {
  // Stub: In production, validate the Authorization header or X-API-Key header
  // against the sessions/api_keys tables.
  //
  // Example production logic:
  //
  //   const authHeader = req.headers.authorization
  //   if (!authHeader?.startsWith('Bearer ')) {
  //     return res.status(401).json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Missing auth token' } })
  //   }
  //   const token = authHeader.slice(7)
  //   const session = await verifyAccessToken(token)
  //   if (!session) {
  //     return res.status(401).json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } })
  //   }
  //   (req as any).userId = session.userId

  next()
}

// ---------------------------------------------------------------------------
// Geocode Cache (Stub)
// ---------------------------------------------------------------------------

/**
 * Simple in-memory geocode cache.
 *
 * Coordinates are rounded to 3 decimal places (~111 meters) to group
 * nearby lookups into the same cache entry. This dramatically reduces
 * Nominatim calls for venues in the same area.
 *
 * Production should use Redis with a TTL of ~24 hours.
 */
const geocodeCache = new Map<string, { data: unknown; cachedAt: number }>()
const GEOCODE_CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

function getCacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(3)}:${lng.toFixed(3)}`
}

// ---------------------------------------------------------------------------
// Webhook Subscription Lookup (Stub)
// ---------------------------------------------------------------------------

/**
 * Looks up a webhook subscription by ID.
 *
 * Production implementation queries the webhook_subscriptions table.
 * This stub returns null, which triggers a 404.
 */
async function lookupWebhookSubscription(subscriptionId: string): Promise<WebhookSubscription | null> {
  // Stub: In production, query the database:
  //
  //   const sub = await db.query(
  //     'SELECT id, url, secret, active, failure_count FROM webhook_subscriptions WHERE id = $1',
  //     [subscriptionId]
  //   )
  //   return sub.rows[0] ?? null

  void subscriptionId
  return null
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const router = Router()

/**
 * GET /api/proxy/geocode
 *
 * Proxies reverse geocoding requests to Nominatim (OpenStreetMap).
 *
 * Why this is proxied:
 * - Nominatim enforces a strict 1 req/sec policy and will block abusive IPs.
 *   The server enforces its own rate limit and queues requests.
 * - Browser-originated requests may be blocked by CORS or content policies.
 * - Server-side caching prevents redundant external lookups.
 * - Future: can swap Nominatim for a paid geocoding provider without
 *   changing any client code.
 *
 * Query params:
 *   lat (required) - Latitude, -90 to 90
 *   lng (required) - Longitude, -180 to 180
 *
 * Rate limit: 30 requests per minute per IP
 */
router.get(
  '/geocode',
  validateApiKeyOrSession,
  rateLimit(60_000, 30, 'geocode'),
  async (req: Request, res: Response): Promise<void> => {
    const lat = parseFloat(req.query.lat as string)
    const lng = parseFloat(req.query.lng as string)

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      res.status(400).json({
        data: null,
        error: { code: 'INVALID_PARAMS', message: 'Valid lat (-90 to 90) and lng (-180 to 180) are required.' },
      })
      return
    }

    // Check cache
    const cacheKey = getCacheKey(lat, lng)
    const cached = geocodeCache.get(cacheKey)
    if (cached && Date.now() - cached.cachedAt < GEOCODE_CACHE_TTL_MS) {
      res.set('X-Cache', 'HIT')
      res.json({ data: cached.data, error: null })
      return
    }

    try {
      // Nominatim requires a descriptive User-Agent per their usage policy
      const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
      const upstream = await fetch(nominatimUrl, {
        headers: {
          'User-Agent': 'PulseApp/1.0 (https://pulse.app; contact@pulse.app)',
        },
      })

      if (!upstream.ok) {
        res.status(502).json({
          data: null,
          error: { code: 'UPSTREAM_ERROR', message: `Nominatim returned status ${upstream.status}` },
        })
        return
      }

      const raw = await upstream.json()
      const address = raw.address ?? {}

      const result = {
        city: address.city || address.town || address.village || 'Unknown',
        state: address.state || 'Unknown',
        displayName: raw.display_name || '',
        address: {
          city: address.city,
          town: address.town,
          village: address.village,
          state: address.state,
          country: address.country,
          postcode: address.postcode,
        },
      }

      // Cache the result
      geocodeCache.set(cacheKey, { data: result, cachedAt: Date.now() })

      res.set('X-Cache', 'MISS')
      res.json({ data: result, error: null })
    } catch (err) {
      res.status(502).json({
        data: null,
        error: {
          code: 'UPSTREAM_ERROR',
          message: err instanceof Error ? err.message : 'Failed to reach Nominatim',
        },
      })
    }
  }
)

/**
 * POST /api/proxy/webhook
 *
 * Signs a webhook payload with the subscription's HMAC secret and
 * delivers it to the registered URL.
 *
 * Why this is proxied:
 * - Webhook secrets are per-subscription HMAC-SHA256 keys that must never
 *   be exposed to the client. The current public-api.ts imports Node.js
 *   `crypto.createHmac` which cannot run in a browser.
 * - Server-side delivery enables retry logic, failure counting, and
 *   circuit breaking (disable subscription after N consecutive failures).
 * - The server can log delivery attempts for debugging and audit.
 *
 * Request body:
 *   event (string)          - Webhook event type (e.g. 'venue.surge')
 *   data (object)           - Event payload
 *   subscriptionId (string) - ID of the webhook subscription to deliver to
 *
 * Rate limit: 10 requests per minute per IP
 */
router.post(
  '/webhook',
  validateApiKeyOrSession,
  rateLimit(60_000, 10, 'webhook'),
  async (req: Request, res: Response): Promise<void> => {
    const { event, data, subscriptionId } = req.body ?? {}

    if (!event || typeof event !== 'string') {
      res.status(400).json({
        data: null,
        error: { code: 'INVALID_PARAMS', message: 'event (string) is required.' },
      })
      return
    }

    if (!data || typeof data !== 'object') {
      res.status(400).json({
        data: null,
        error: { code: 'INVALID_PARAMS', message: 'data (object) is required.' },
      })
      return
    }

    if (!subscriptionId || typeof subscriptionId !== 'string') {
      res.status(400).json({
        data: null,
        error: { code: 'INVALID_PARAMS', message: 'subscriptionId (string) is required.' },
      })
      return
    }

    // Look up the subscription (server-side — client never sees the URL or secret)
    const subscription = await lookupWebhookSubscription(subscriptionId)

    if (!subscription) {
      res.status(404).json({
        data: null,
        error: { code: 'NOT_FOUND', message: 'Webhook subscription not found.' },
      })
      return
    }

    if (!subscription.active) {
      res.status(409).json({
        data: null,
        error: { code: 'SUBSCRIPTION_INACTIVE', message: 'Webhook subscription is inactive.' },
      })
      return
    }

    try {
      // Build and sign the payload (secret stays server-side)
      const timestamp = Date.now()
      const body = JSON.stringify({ event, timestamp, data })
      const signature = createHmac('sha256', subscription.secret).update(body).digest('hex')

      const payload = { event, timestamp, data, signature }

      // Deliver to the subscription URL
      const delivery = await fetch(subscription.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Pulse-Signature': signature,
          'X-Pulse-Timestamp': String(timestamp),
        },
        body: JSON.stringify(payload),
      })

      // TODO: In production, update failure_count in the database.
      // If failureCount exceeds threshold (e.g. 10), mark subscription inactive.

      res.json({
        data: {
          delivered: delivery.ok,
          statusCode: delivery.status,
          timestamp: new Date(timestamp).toISOString(),
        },
        error: null,
      })
    } catch (err) {
      // TODO: In production, increment failure_count and implement retry with backoff.
      res.status(502).json({
        data: null,
        error: {
          code: 'DELIVERY_FAILED',
          message: err instanceof Error ? err.message : 'Failed to deliver webhook',
        },
      })
    }
  }
)

export default router
