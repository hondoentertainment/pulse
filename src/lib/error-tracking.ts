/**
 * Error Tracking Module
 *
 * Abstract error tracking interface that can be backed by any provider
 * (Sentry, Datadog, Bugsnag, etc.). The default implementation logs to
 * the console in development and stubs silently in production.
 *
 * To integrate Sentry later, install @sentry/react and replace the
 * default provider:
 *
 *   import * as Sentry from '@sentry/react'
 *
 *   setErrorTrackingProvider({
 *     init(config) {
 *       Sentry.init({ dsn: config.dsn, environment: config.environment, release: config.release })
 *     },
 *     captureException(error, context) {
 *       Sentry.captureException(error, { extra: context })
 *     },
 *     captureMessage(message, level) {
 *       Sentry.captureMessage(message, level)
 *     },
 *     setUser(user) {
 *       Sentry.setUser(user)
 *     },
 *     addBreadcrumb(category, message, data) {
 *       Sentry.addBreadcrumb({ category, message, data })
 *     },
 *   })
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ErrorLevel = 'fatal' | 'error' | 'warning' | 'info' | 'debug'

export interface ErrorTrackingConfig {
  /** DSN / API key for the upstream error tracking service */
  dsn?: string
  /** Deployment environment name */
  environment: string
  /** Application release / version tag */
  release?: string
  /** Sample rate 0-1 for error events */
  sampleRate?: number
  /** Whether to attach console breadcrumbs automatically */
  attachConsole?: boolean
}

export interface ErrorTrackingUser {
  id: string
  username?: string
  email?: string
  [key: string]: unknown
}

export interface ErrorTrackingProvider {
  init(config: ErrorTrackingConfig): void
  captureException(error: unknown, context?: Record<string, unknown>): void
  captureMessage(message: string, level?: ErrorLevel): void
  setUser(user: ErrorTrackingUser | null): void
  addBreadcrumb(category: string, message: string, data?: Record<string, unknown>): void
}

// ---------------------------------------------------------------------------
// Default (console-based) provider
// ---------------------------------------------------------------------------

const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV

const consoleProvider: ErrorTrackingProvider = {
  init(config) {
    if (isDev) {
      console.info('[error-tracking] Initialized', config)
    }
  },

  captureException(error, context) {
    if (isDev) {
      console.error('[error-tracking] Exception captured:', error, context ?? '')
    }
    // In production the default provider is a no-op.
    // Replace with a real provider (Sentry, etc.) for production use.
  },

  captureMessage(message, level = 'info') {
    if (isDev) {
      const logMethod = level === 'error' || level === 'fatal' ? 'error' : level === 'warning' ? 'warn' : 'info'
      console[logMethod](`[error-tracking] [${level}] ${message}`)
    }
  },

  setUser(user) {
    if (isDev) {
      console.info('[error-tracking] User context set:', user)
    }
  },

  addBreadcrumb(category, message, data) {
    if (isDev) {
      console.debug(`[error-tracking] Breadcrumb [${category}]: ${message}`, data ?? '')
    }
  },
}

// ---------------------------------------------------------------------------
// Active provider & public API
// ---------------------------------------------------------------------------

let activeProvider: ErrorTrackingProvider = consoleProvider

/**
 * Replace the active error-tracking provider at runtime.
 * Call this before `initErrorTracking` when wiring up Sentry, etc.
 */
export function setErrorTrackingProvider(provider: ErrorTrackingProvider): void {
  activeProvider = provider
}

/**
 * Initialize the error tracking system.
 */
export function initErrorTracking(config: ErrorTrackingConfig): void {
  activeProvider.init(config)

  // Register global handlers so unhandled errors are automatically captured.
  if (typeof window !== 'undefined') {
    window.addEventListener('error', (event) => {
      if (event.error) {
        activeProvider.captureException(event.error, { source: 'window.onerror' })
      }
    })

    window.addEventListener('unhandledrejection', (event) => {
      activeProvider.captureException(event.reason ?? 'Unhandled promise rejection', {
        source: 'window.unhandledrejection',
      })
    })
  }
}

// ---------------------------------------------------------------------------
// Context enrichment
// ---------------------------------------------------------------------------

export interface ErrorContext {
  /** Current route / tab visible to the user */
  route?: string
  /** Authenticated user ID */
  userId?: string
  /** Application version / release tag */
  appVersion?: string
  /** Arbitrary extra key-value pairs */
  [key: string]: unknown
}

let globalContext: ErrorContext = {}

/**
 * Set application-level context that will be merged into every captured event.
 * Useful for recording the current route, user ID, or app version once so you
 * don't have to repeat it at every call site.
 */
export function setErrorContext(context: Partial<ErrorContext>): void {
  globalContext = { ...globalContext, ...context }
}

/**
 * Read the current global error context (useful for testing).
 */
export function getErrorContext(): ErrorContext {
  return { ...globalContext }
}

/**
 * Clear all global error context (e.g. on sign-out).
 */
export function clearErrorContext(): void {
  globalContext = {}
}

// ---------------------------------------------------------------------------
// Rate limiting — max 10 errors per minute
// ---------------------------------------------------------------------------

const RATE_LIMIT_MAX = 10
const RATE_LIMIT_WINDOW_MS = 60_000

const errorTimestamps: number[] = []

/**
 * Returns true if the error should be captured (not rate-limited).
 * Maintains a sliding 60-second window allowing at most RATE_LIMIT_MAX events.
 */
function isAllowedByRateLimit(): boolean {
  const now = Date.now()
  // Drop timestamps older than the window
  const cutoff = now - RATE_LIMIT_WINDOW_MS
  while (errorTimestamps.length > 0 && errorTimestamps[0] < cutoff) {
    errorTimestamps.shift()
  }
  if (errorTimestamps.length >= RATE_LIMIT_MAX) {
    return false
  }
  errorTimestamps.push(now)
  return true
}

/** Expose for testing — resets the rate-limit sliding window. */
export function _resetRateLimit(): void {
  errorTimestamps.length = 0
}

/** Expose for testing — returns count of events in the current window. */
export function _getRateLimitCount(): number {
  const now = Date.now()
  const cutoff = now - RATE_LIMIT_WINDOW_MS
  return errorTimestamps.filter(t => t >= cutoff).length
}

// ---------------------------------------------------------------------------
// setupErrorTracking — enhanced global error hooks
// ---------------------------------------------------------------------------

let isSetup = false

/**
 * Wire up `window.onerror` and `window.onunhandledrejection` with context
 * enrichment and rate limiting.  Safe to call multiple times — subsequent
 * calls are no-ops.
 *
 * This is the preferred entry-point over `initErrorTracking` when you want
 * the full feature set without configuring an upstream provider.
 */
export function setupErrorTracking(contextDefaults?: Partial<ErrorContext>): void {
  if (typeof window === 'undefined') return
  if (isSetup) return
  isSetup = true

  if (contextDefaults) {
    setErrorContext(contextDefaults)
  }

  window.addEventListener('error', (event) => {
    if (!event.error) return
    if (!isAllowedByRateLimit()) {
      if (isDev) {
        console.warn('[error-tracking] Rate limit reached — dropping error', event.error)
      }
      return
    }
    activeProvider.captureException(event.error, {
      source: 'window.onerror',
      ...globalContext,
    })
  })

  window.addEventListener('unhandledrejection', (event) => {
    if (!isAllowedByRateLimit()) {
      if (isDev) {
        console.warn('[error-tracking] Rate limit reached — dropping unhandled rejection')
      }
      return
    }
    activeProvider.captureException(event.reason ?? 'Unhandled promise rejection', {
      source: 'window.unhandledrejection',
      ...globalContext,
    })
  })
}

/** Reset setup state — for testing only. */
export function _resetSetup(): void {
  isSetup = false
}

/**
 * Capture an exception with optional context metadata.
 * Global context (route, userId, appVersion) is automatically merged in.
 */
export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (!isAllowedByRateLimit()) {
    if (isDev) {
      console.warn('[error-tracking] Rate limit reached — dropping captureException')
    }
    return
  }
  activeProvider.captureException(error, { ...globalContext, ...context })
}

/**
 * Capture a standalone message at the given severity level.
 */
export function captureMessage(message: string, level?: ErrorLevel): void {
  activeProvider.captureMessage(message, level)
}

/**
 * Set the current user context for all subsequent error reports.
 * Pass `null` to clear.
 */
export function setUser(user: ErrorTrackingUser | null): void {
  activeProvider.setUser(user)
}

/**
 * Add a breadcrumb (navigation, user action, etc.) that will be attached
 * to the next error report for richer context.
 */
export function addBreadcrumb(category: string, message: string, data?: Record<string, unknown>): void {
  activeProvider.addBreadcrumb(category, message, data)
}
