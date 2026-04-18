/**
 * Health Check Module
 *
 * Provides a `getHealthStatus()` function that returns a structured snapshot of
 * the application's runtime health.  This is intended for consumption by a
 * future health endpoint (e.g. `/api/health`) or an in-app diagnostics panel.
 *
 * Data sources:
 *  - App version  — resolved from `import.meta.env.VITE_APP_VERSION` or a
 *                   build-time constant.
 *  - Uptime       — milliseconds since `initHealthCheck()` was called.
 *  - Memory       — `performance.memory` if available (Chrome/Blink only).
 *  - Error count  — counts accumulated via `recordHealthError()`.
 *  - Last error   — ISO timestamp of the most recent recorded error.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MemoryInfo {
  /** Bytes of JS heap currently in use */
  usedJSHeapSizeMB: number
  /** Maximum JS heap size allowed by the browser */
  totalJSHeapSizeMB: number
  /** Heap size limit set by the V8 engine */
  jsHeapSizeLimitMB: number
}

export interface HealthStatus {
  /** Semantic version string, e.g. "1.2.3" */
  appVersion: string
  /** Milliseconds the app has been running since `initHealthCheck()` */
  uptimeMs: number
  /** Memory usage from `performance.memory`, if available */
  memory: MemoryInfo | null
  /** Total number of errors recorded via `recordHealthError()` */
  errorCount: number
  /** ISO-8601 timestamp of the most recent recorded error, or null */
  lastErrorTimestamp: string | null
  /** Overall status derived from error rate and memory pressure */
  status: 'healthy' | 'degraded' | 'unhealthy'
}

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

const APP_VERSION =
  (typeof import.meta !== 'undefined' && (import.meta as Record<string, unknown>).env as Record<string, string> | undefined)
    ?.VITE_APP_VERSION ?? '0.0.0'

let startTimestamp: number = Date.now()
let errorCount = 0
let lastErrorTimestamp: number | null = null

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * (Re-)initialise the health check module.  Call once at app startup.
 * Resets the uptime clock.
 */
export function initHealthCheck(): void {
  startTimestamp = Date.now()
}

/**
 * Record an error occurrence.  Call from error handlers / error boundaries so
 * `getHealthStatus` can surface the error count and recency.
 */
export function recordHealthError(): void {
  errorCount += 1
  lastErrorTimestamp = Date.now()
}

/**
 * Reset internal counters — intended for testing only.
 */
export function _resetHealthCheck(): void {
  startTimestamp = Date.now()
  errorCount = 0
  lastErrorTimestamp = null
}

/**
 * Return the current health snapshot.
 *
 * The `status` field is computed as:
 *  - `unhealthy`  — 10+ errors recorded
 *  - `degraded`   — 1-9 errors recorded, or JS heap > 90 % of limit
 *  - `healthy`    — no errors and memory within bounds
 */
export function getHealthStatus(): HealthStatus {
  const uptimeMs = Date.now() - startTimestamp

  // ---------------------------------------------------------------------------
  // Memory — available in Chrome/Blink via performance.memory (non-standard).
  // We guard carefully so the module works in all environments.
  // ---------------------------------------------------------------------------
  let memory: MemoryInfo | null = null
  try {
    // `performance.memory` is non-standard; cast through unknown to avoid TS errors.
    const mem = (performance as unknown as { memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } }).memory
    if (mem) {
      const MB = 1 / (1024 * 1024)
      memory = {
        usedJSHeapSizeMB: +(mem.usedJSHeapSize * MB).toFixed(2),
        totalJSHeapSizeMB: +(mem.totalJSHeapSize * MB).toFixed(2),
        jsHeapSizeLimitMB: +(mem.jsHeapSizeLimit * MB).toFixed(2),
      }
    }
  } catch {
    // Silently ignore — memory info is optional.
  }

  // ---------------------------------------------------------------------------
  // Status derivation
  // ---------------------------------------------------------------------------
  let status: HealthStatus['status'] = 'healthy'

  if (errorCount >= 10) {
    status = 'unhealthy'
  } else if (errorCount > 0) {
    status = 'degraded'
  } else if (memory && memory.jsHeapSizeLimitMB > 0) {
    const heapUsageRatio = memory.usedJSHeapSizeMB / memory.jsHeapSizeLimitMB
    if (heapUsageRatio > 0.9) {
      status = 'degraded'
    }
  }

  return {
    appVersion: APP_VERSION,
    uptimeMs,
    memory,
    errorCount,
    lastErrorTimestamp: lastErrorTimestamp !== null ? new Date(lastErrorTimestamp).toISOString() : null,
    status,
  }
}
