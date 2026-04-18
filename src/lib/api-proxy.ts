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
 * By routing through /api/*, the server controls rate limiting,
 * caches responses, manages API keys, and keeps secrets server-side.
 */

import {
  API_BASE_URL,
  GEOCODE_TIMEOUT,
  WEBHOOK_TIMEOUT,
  MAX_RETRIES,
  BASE_RETRY_DELAY_MS,
} from './config'

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
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Sleep for a given number of milliseconds.
 * Used by the exponential back-off retry loop.
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Wrap a fetch call with an AbortController-based timeout.
 *
 * @param url     - Full URL to fetch
 * @param init    - Standard RequestInit options (method, headers, body, …)
 * @param timeout - Milliseconds before the request is aborted
 */
async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeout: number = GEOCODE_TIMEOUT
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)

  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Retry a fetch-based operation with exponential back-off.
 *
 * Retries on network errors and 5xx responses (transient upstream failures).
 * Does NOT retry on 4xx (client errors — retrying would be pointless).
 *
 * @param operation   - Async function that performs the fetch and returns a ProxyResponse
 * @param maxRetries  - Maximum number of additional attempts (default MAX_RETRIES)
 */
async function withRetry<T>(
  operation: () => Promise<ProxyResponse<T>>,
  maxRetries: number = MAX_RETRIES
): Promise<ProxyResponse<T>> {
  let lastResult: ProxyResponse<T> = { data: null, error: { code: 'UNKNOWN', message: 'No attempts made' } }

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1)
      await sleep(delay)
    }

    lastResult = await operation()

    // Success — return immediately
    if (lastResult.data !== null) return lastResult

    // Non-retryable error codes (client errors)
    const nonRetryable = ['INVALID_PARAMS', 'NOT_FOUND', 'SUBSCRIPTION_INACTIVE', 'RATE_LIMITED']
    if (lastResult.error && nonRetryable.includes(lastResult.error.code)) {
      return lastResult
    }

    // On the last attempt, return whatever we have
    if (attempt === maxRetries) return lastResult
  }

  return lastResult
}

// ---------------------------------------------------------------------------
// Public Proxy Functions
// ---------------------------------------------------------------------------

/**
 * Reverse-geocode a latitude/longitude pair to a city and state.
 *
 * Calls `POST /api/geocode/reverse` on the local server which proxies
 * Nominatim (OpenStreetMap) server-side, avoiding rate-limit exposure
 * and keeping the browser's IP out of Nominatim's logs.
 *
 * Falls back gracefully — callers should default to 'New York, NY' on error.
 *
 * @param lat - Latitude (-90 to 90)
 * @param lng - Longitude (-180 to 180)
 * @returns Simplified `{ city, state }` on success, or a ProxyError
 */
export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<{ city: string; state: string }> {
  const perform = async (): Promise<ProxyResponse<{ city: string; state: string }>> => {
    try {
      const response = await fetchWithTimeout(
        `${API_BASE_URL}/api/geocode/reverse`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat, lng }),
        },
        GEOCODE_TIMEOUT
      )

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null)
        // Preserve server-provided error codes (e.g. INVALID_PARAMS) so that
        // the retry logic can correctly skip non-retryable client errors.
        const serverCode = errorBody?.error?.code
        return {
          data: null,
          error: {
            code: serverCode ?? (response.status >= 500 ? 'UPSTREAM_ERROR' : 'GEOCODE_FAILED'),
            message:
              errorBody?.error?.message ??
              `Geocode request failed with status ${response.status}`,
          },
        }
      }

      const result: ProxyResponse<GeocodeResult> = await response.json()

      if (!result.data) {
        return {
          data: null,
          error: result.error ?? { code: 'GEOCODE_FAILED', message: 'Empty response from geocode proxy' },
        }
      }

      return {
        data: { city: result.data.city, state: result.data.state },
        error: null,
      }
    } catch (err) {
      const isTimeout = err instanceof Error && err.name === 'AbortError'
      return {
        data: null,
        error: {
          code: isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR',
          message: isTimeout
            ? `Geocode request timed out after ${GEOCODE_TIMEOUT}ms`
            : err instanceof Error
            ? err.message
            : 'Failed to reach geocode proxy',
        },
      }
    }
  }

  const result = await withRetry(perform)
  if (result.data) return result.data

  // Graceful fallback
  console.warn('[api-proxy] reverseGeocode failed, using fallback:', result.error)
  return { city: 'New York', state: 'NY' }
}

/**
 * Sign a webhook payload server-side and return the HMAC signature.
 *
 * Calls `POST /api/webhook/sign` — the server reads the secret from its
 * environment, signs the payload, and returns only the hex signature.
 * The secret never travels to the browser.
 *
 * @param payload - Arbitrary JSON-serialisable object to sign
 * @param secret  - Ignored in this call (kept for API compatibility);
 *                  the server uses its own environment secret.
 * @returns Hex-encoded HMAC-SHA256 signature string
 */
export async function signWebhook(payload: object, _secret?: string): Promise<string> {
  const perform = async (): Promise<ProxyResponse<{ signature: string }>> => {
    try {
      const response = await fetchWithTimeout(
        `${API_BASE_URL}/api/webhook/sign`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payload }),
        },
        WEBHOOK_TIMEOUT
      )

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null)
        return {
          data: null,
          error: {
            code: response.status >= 500 ? 'UPSTREAM_ERROR' : 'WEBHOOK_FAILED',
            message:
              errorBody?.error?.message ??
              `Webhook sign request failed with status ${response.status}`,
          },
        }
      }

      const result: ProxyResponse<{ signature: string }> = await response.json()

      if (!result.data?.signature) {
        return {
          data: null,
          error: result.error ?? { code: 'WEBHOOK_FAILED', message: 'Empty signature in response' },
        }
      }

      return { data: { signature: result.data.signature }, error: null }
    } catch (err) {
      const isTimeout = err instanceof Error && err.name === 'AbortError'
      return {
        data: null,
        error: {
          code: isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR',
          message: isTimeout
            ? `Webhook sign request timed out after ${WEBHOOK_TIMEOUT}ms`
            : err instanceof Error
            ? err.message
            : 'Failed to reach webhook sign proxy',
        },
      }
    }
  }

  const result = await withRetry(perform)

  if (result.data) return result.data.signature

  const errMsg = result.error?.message ?? 'Webhook signing failed'
  console.error('[api-proxy] signWebhook failed:', result.error)
  throw new Error(errMsg)
}

/**
 * Retrieve an API key for a named third-party service.
 *
 * Calls `GET /api/keys/:service` — the server returns only the key value,
 * never the full secret store. Intended for future API key management where
 * multiple client surfaces need a service credential without it being
 * hard-coded in the bundle.
 *
 * @param service - Service identifier (e.g. 'maps', 'analytics')
 * @returns The API key string for the requested service
 */
export async function getApiKey(service: string): Promise<string> {
  if (!service || typeof service !== 'string') {
    throw new Error('getApiKey: service name must be a non-empty string')
  }

  const perform = async (): Promise<ProxyResponse<{ key: string }>> => {
    try {
      const response = await fetchWithTimeout(
        `${API_BASE_URL}/api/keys/${encodeURIComponent(service)}`,
        { method: 'GET' },
        GEOCODE_TIMEOUT
      )

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null)
        return {
          data: null,
          error: {
            code: response.status === 404 ? 'NOT_FOUND' : response.status >= 500 ? 'UPSTREAM_ERROR' : 'KEY_FETCH_FAILED',
            message:
              errorBody?.error?.message ??
              `API key fetch failed with status ${response.status}`,
          },
        }
      }

      const result: ProxyResponse<{ key: string }> = await response.json()

      if (!result.data?.key) {
        return {
          data: null,
          error: result.error ?? { code: 'KEY_FETCH_FAILED', message: 'Empty key in response' },
        }
      }

      return { data: { key: result.data.key }, error: null }
    } catch (err) {
      const isTimeout = err instanceof Error && err.name === 'AbortError'
      return {
        data: null,
        error: {
          code: isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR',
          message: isTimeout
            ? `API key fetch timed out after ${GEOCODE_TIMEOUT}ms`
            : err instanceof Error
            ? err.message
            : 'Failed to reach API key proxy',
        },
      }
    }
  }

  const result = await withRetry(perform)

  if (result.data) return result.data.key

  const errMsg = result.error?.message ?? `Failed to retrieve API key for service "${service}"`
  console.error('[api-proxy] getApiKey failed:', result.error)
  throw new Error(errMsg)
}

// ---------------------------------------------------------------------------
// Legacy proxy functions (kept for backwards compatibility)
// ---------------------------------------------------------------------------

/**
 * @deprecated Use `reverseGeocode()` instead.
 * Kept for any existing callers of the old proxyGeocode shape.
 */
export async function proxyGeocode(lat: number, lng: number): Promise<ProxyResponse<GeocodeResult>> {
  try {
    const response = await fetchWithTimeout(
      `${API_BASE_URL}/api/geocode/reverse`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng }),
      },
      GEOCODE_TIMEOUT
    )

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

    return response.json()
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
 * @deprecated Use the server-side webhook route directly.
 * Kept for any existing callers of the old proxyWebhook shape.
 */
export async function proxyWebhook(payload: WebhookProxyRequest): Promise<ProxyResponse<WebhookProxyResult>> {
  try {
    const response = await fetchWithTimeout(
      `${API_BASE_URL}/api/proxy/webhook`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
      WEBHOOK_TIMEOUT
    )

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

    return response.json()
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
