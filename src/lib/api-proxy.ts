/**
 * API Proxy Module
 *
 * Redirects external API calls through server-side proxy endpoints
 * instead of calling third-party services directly from the browser.
 *
 * This module exists because the current client code makes direct calls to:
 * 1. Nominatim (OpenStreetMap) for reverse geocoding — exposes usage to
 *    third-party rate limits and CORS restrictions
 * 2. Webhook signing — uses HMAC secrets that must never exist in client bundles
 *
 * By routing through /api/proxy/*, the server controls rate limiting,
 * caches responses, manages API keys, and keeps secrets server-side.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Response shape from the geocode proxy endpoint. */
export interface GeocodeResult {
  /** City name (falls back to town or village). */
  city: string
  /** State or region name. */
  state: string
  /** Full formatted display name from Nominatim. */
  displayName: string
  /** Raw address components for additional parsing if needed. */
  address: {
    city?: string
    town?: string
    village?: string
    state?: string
    country?: string
    postcode?: string
  }
}

/** Payload sent to the webhook proxy endpoint. */
export interface WebhookProxyRequest {
  /** The webhook event type (e.g. 'venue.surge'). */
  event: string
  /** Event data payload. */
  data: Record<string, unknown>
  /** Target webhook subscription ID — the server looks up the URL and secret. */
  subscriptionId: string
}

/** Response from the webhook proxy endpoint. */
export interface WebhookProxyResult {
  /** Whether the webhook was delivered successfully. */
  delivered: boolean
  /** HTTP status code from the receiving endpoint. */
  statusCode: number
  /** Timestamp of the delivery attempt. */
  timestamp: string
}

/** Standard error shape returned by proxy endpoints. */
export interface ProxyError {
  code: string
  message: string
}

/** Wrapper for proxy responses. */
export interface ProxyResponse<T> {
  data: T | null
  error: ProxyError | null
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Base URL for proxy endpoints. In production this is the same origin;
 * in development it may point at a local Express server.
 */
const PROXY_BASE = '/api/proxy'

// ---------------------------------------------------------------------------
// Proxy Functions
// ---------------------------------------------------------------------------

/**
 * Reverse-geocode a latitude/longitude pair to a city and state.
 *
 * **Why this must be proxied:**
 * - Nominatim enforces a strict 1 request/second rate limit per IP and will
 *   block clients that exceed it. The server can queue and cache requests.
 * - Direct browser calls to nominatim.openstreetmap.org face CORS
 *   restrictions in some environments.
 * - Server-side caching prevents redundant lookups for the same coordinates
 *   (venues at similar locations).
 *
 * Replaces the direct fetch to:
 *   `https://nominatim.openstreetmap.org/reverse?lat=...&lon=...&format=json`
 *   currently in App.tsx.
 *
 * @param lat - Latitude (-90 to 90)
 * @param lng - Longitude (-180 to 180)
 * @returns Geocode result with city and state
 */
export async function proxyGeocode(lat: number, lng: number): Promise<ProxyResponse<GeocodeResult>> {
  try {
    const params = new URLSearchParams({
      lat: lat.toString(),
      lng: lng.toString(),
    })

    const response = await fetch(`${PROXY_BASE}/geocode?${params}`)

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null)
      return {
        data: null,
        error: {
          code: 'GEOCODE_FAILED',
          message: errorBody?.error?.message ?? `Geocode request failed with status ${response.status}`,
        },
      }
    }

    const result: ProxyResponse<GeocodeResult> = await response.json()
    return result
  } catch (err) {
    return {
      data: null,
      error: {
        code: 'NETWORK_ERROR',
        message: err instanceof Error ? err.message : 'Failed to reach geocode proxy',
      },
    }
  }
}

/**
 * Sign and deliver a webhook payload through the server.
 *
 * **Why this must be proxied:**
 * - Webhook payloads are signed with HMAC-SHA256 using a per-subscription
 *   secret. These secrets must never be sent to or stored in the client.
 * - The server looks up the subscription URL and secret by ID, signs the
 *   payload, and delivers it — the client never sees the secret or target URL.
 * - Server-side delivery allows retry logic, failure tracking, and circuit
 *   breaking that would be unreliable from a browser.
 *
 * Replaces the direct use of `generateWebhookPayload()` and
 * `createHmac('sha256', secret)` from `src/lib/public-api.ts` which
 * imports Node.js `crypto` and cannot run safely in a browser context.
 *
 * @param payload - The webhook event and data to deliver
 * @returns Delivery result with status code and timestamp
 */
export async function proxyWebhook(payload: WebhookProxyRequest): Promise<ProxyResponse<WebhookProxyResult>> {
  try {
    const response = await fetch(`${PROXY_BASE}/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null)
      return {
        data: null,
        error: {
          code: 'WEBHOOK_FAILED',
          message: errorBody?.error?.message ?? `Webhook proxy request failed with status ${response.status}`,
        },
      }
    }

    const result: ProxyResponse<WebhookProxyResult> = await response.json()
    return result
  } catch (err) {
    return {
      data: null,
      error: {
        code: 'NETWORK_ERROR',
        message: err instanceof Error ? err.message : 'Failed to reach webhook proxy',
      },
    }
  }
}
