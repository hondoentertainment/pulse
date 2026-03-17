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

/**
 * Capture an exception with optional context metadata.
 */
export function captureException(error: unknown, context?: Record<string, unknown>): void {
  activeProvider.captureException(error, context)
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
