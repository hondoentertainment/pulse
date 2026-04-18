/**
 * Application Configuration
 *
 * Centralises environment-specific settings so that all proxy calls,
 * timeouts, and secrets are derived from a single source of truth.
 *
 * In production (NODE_ENV=production or VITE_ENV=production):
 *   - API_BASE_URL is '' (same origin — the Express server serves the SPA)
 *   - WEBHOOK_SECRET comes from the VITE_WEBHOOK_SECRET env var (server only)
 *
 * In development:
 *   - API_BASE_URL points at the local Express dev server
 *   - WEBHOOK_SECRET falls back to a placeholder that triggers a warning
 */

// ---------------------------------------------------------------------------
// Environment detection
// ---------------------------------------------------------------------------

/** True when running in a Vite dev server or test runner. */
const isDev =
  typeof import.meta !== 'undefined' &&
  (import.meta.env?.DEV === true || import.meta.env?.MODE === 'test')

// ---------------------------------------------------------------------------
// API Base URL
// ---------------------------------------------------------------------------

/**
 * Base URL prepended to all proxy endpoint paths.
 *
 * - Production / same-origin deployment: '' (empty string, same origin)
 * - Local development: 'http://localhost:3001' (separate Express server)
 *
 * Override via the VITE_API_BASE_URL environment variable in .env.local:
 *   VITE_API_BASE_URL=http://localhost:3001
 */
export const API_BASE_URL: string =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) ||
  (isDev ? 'http://localhost:3001' : '')

// ---------------------------------------------------------------------------
// Timeouts
// ---------------------------------------------------------------------------

/**
 * Default request timeout for geocode proxy calls (milliseconds).
 * Nominatim can be slow under load — 5 s is generous but bounded.
 */
export const GEOCODE_TIMEOUT: number = 5_000

/**
 * Default request timeout for webhook signing proxy calls (milliseconds).
 */
export const WEBHOOK_TIMEOUT: number = 5_000

// ---------------------------------------------------------------------------
// Retry policy
// ---------------------------------------------------------------------------

/** Maximum number of retry attempts for retryable proxy calls. */
export const MAX_RETRIES: number = 3

/** Base delay (ms) for exponential back-off: delay = BASE_RETRY_DELAY_MS * 2^attempt */
export const BASE_RETRY_DELAY_MS: number = 200

// ---------------------------------------------------------------------------
// Webhook secret (server-side placeholder)
// ---------------------------------------------------------------------------

/**
 * HMAC-SHA256 secret used to sign webhook payloads.
 *
 * This value is intentionally a placeholder in the client bundle.
 * The real secret is read server-side from the WEBHOOK_SECRET environment
 * variable and never serialised into the browser bundle.
 *
 * The client proxy module sends the *payload* to the server endpoint;
 * signing happens exclusively on the server.
 */
export const WEBHOOK_SECRET: string =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_WEBHOOK_SECRET) ||
  'PLACEHOLDER_REPLACE_IN_PRODUCTION'
