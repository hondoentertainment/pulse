/**
 * Sentry — Centralized Error Monitoring Configuration
 *
 * Lazy-loads the full Sentry SDK only when a DSN is configured. This keeps
 * the bundle clean in development and on deployments without Sentry credentials.
 *
 * The rest of the app should import helpers from this module rather than
 * importing @sentry/react directly so initialization timing is consistent.
 *
 * Features:
 * - Lazy async initialization (zero bundle overhead until DSN is set)
 * - PII stripping in beforeSend (email, IP stripped)
 * - Browser tracing + session replay
 * - Environment-aware sample rates (full in dev, 10% in prod)
 * - User context helpers (set / clear)
 * - Breadcrumb helpers for structured audit trail
 * - Performance span helpers via withSpan
 * - Backward-compatible registerSentry shim for main.tsx
 */

import type * as SentryType from '@sentry/react'

let sentryLoaded = false
let SentryModule: typeof SentryType | null = null

/**
 * Called by main.tsx after synchronously initialising Sentry so that the
 * module reference is available for subsequent captureError / addBreadcrumb
 * calls throughout the app's lifetime.
 */
export function registerSentry(sdk: typeof SentryType): void {
  SentryModule = sdk
  sentryLoaded = true
}

/**
 * Asynchronously initialise Sentry if a DSN is present.
 * Idempotent — safe to call multiple times.
 */
export async function initSentry(): Promise<void> {
  if (sentryLoaded || !import.meta.env.VITE_SENTRY_DSN) return

  const Sentry = await import('@sentry/react')
  SentryModule = Sentry

  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN as string,
    environment: import.meta.env.MODE,
    release: (import.meta.env.VITE_APP_VERSION as string | undefined) || '0.0.0',
    integrations: [
      Sentry.browserTracingIntegration({
        // Propagate trace headers only to same-origin requests and localhost
        tracePropagationTargets: ['localhost', /^\//],
      }),
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],

    // Capture all traces in dev; 10 % in production to control costs
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,

    // Record 10 % of sessions; always record sessions with errors
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    beforeSend(event) {
      // Strip PII from error events before they leave the browser
      if (event.user) {
        delete event.user.email
        delete event.user.ip_address
      }

      // Scrub Authorization headers accidentally captured in breadcrumbs
      if (event.breadcrumbs?.values) {
        for (const crumb of event.breadcrumbs.values) {
          if (crumb.data?.['Authorization']) {
            crumb.data['Authorization'] = '[Filtered]'
          }
        }
      }

      return event
    },
  })

  sentryLoaded = true
}

/**
 * Capture an exception with optional structured context.
 * Always falls back to console.error when Sentry isn't loaded.
 */
export function captureError(
  error: Error | string,
  extra?: Record<string, unknown>
): void {
  if (SentryModule) {
    SentryModule.withScope((scope) => {
      if (extra) scope.setExtras(extra)
      if (typeof error === 'string') {
        SentryModule!.captureMessage(error, 'error')
      } else {
        SentryModule!.captureException(error)
      }
    })
  }
  const message = typeof error === 'string' ? error : error.message
  console.error('[Pulse Error]', message, extra)
}

/**
 * Capture a non-error message (e.g. a warning or important event).
 */
export function captureMessage(
  message: string,
  level: 'debug' | 'info' | 'warning' | 'error' = 'info',
  context?: Record<string, unknown>
): void {
  if (SentryModule) {
    SentryModule.captureMessage(message, { level, extra: context })
  }
}

/**
 * Associate future events with an authenticated user.
 * Never pass raw email or IP — those are stripped in beforeSend anyway.
 */
export function setUser(id: string, username?: string): void {
  if (SentryModule) {
    SentryModule.setUser({ id, username })
  }
}

/**
 * Clear user context on sign-out.
 */
export function clearUser(): void {
  if (SentryModule) {
    SentryModule.setUser(null)
  }
}

/**
 * Add a structured breadcrumb for richer error context in Sentry's timeline.
 */
export function addBreadcrumb(
  message: string,
  category: string,
  data?: Record<string, unknown>
): void {
  if (SentryModule) {
    SentryModule.addBreadcrumb({ message, category, data, level: 'info' })
  }
}

/**
 * Set a custom tag that will appear on all future events for this session.
 */
export function setTag(key: string, value: string): void {
  if (SentryModule) {
    SentryModule.setTag(key, value)
  }
}

/**
 * Wrap an async operation in a Sentry performance span.
 * Returns the result of the operation. Fails silently if Sentry is not loaded.
 */
export async function withSpan<T>(
  name: string,
  op: string,
  fn: () => Promise<T>
): Promise<T> {
  if (SentryModule) {
    return SentryModule.startSpan({ name, op }, fn)
  }
  return fn()
}
