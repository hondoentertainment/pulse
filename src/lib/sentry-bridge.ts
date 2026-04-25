/**
 * Sentry bridge — the critical-path-safe entrypoint used by `logger.ts`,
 * `web-vitals.ts` and `analytics.ts`.
 *
 * Why this file exists:
 * - `sentry-lazy.ts` statically imports `@sentry/react`, which means any
 *   module that *statically* imports `sentry-lazy` pulls the 250 KB Sentry
 *   chunk into the importing chunk's dependency graph — in practice landing
 *   it inside `index.js` and blocking first paint.
 * - This bridge forwards calls via `import('./sentry-lazy')` so Rollup keeps
 *   `@sentry/react` in its own async `sentry` chunk, loaded only when
 *   `AppBootstrap` schedules the dynamic import post-paint.
 *
 * Pre-init calls (breadcrumbs, exceptions, messages, measurements) are
 * buffered inside `sentry-lazy.ts` itself and flushed once `initSentry()`
 * runs — so nothing reported during startup is lost.
 */

import type { Breadcrumb, SeverityLevel } from '@sentry/react'

// A cached module-promise so every forward shares one dynamic import.
type LazyModule = typeof import('./sentry-lazy')
let lazyPromise: Promise<LazyModule> | null = null

function loadLazy(): Promise<LazyModule> {
  if (!lazyPromise) {
    lazyPromise = import('./sentry-lazy').catch((err) => {
      // Reset so the next call can retry — but never throw to callers.
      lazyPromise = null
      throw err
    })
  }
  return lazyPromise
}

function forward<T>(fn: (m: LazyModule) => T): void {
  // Fire-and-forget; Sentry failures must never break the app.
  void loadLazy()
    .then(fn)
    .catch(() => {
      /* swallow — Sentry is optional telemetry */
    })
}

export function breadcrumb(crumb: Breadcrumb): void {
  forward((m) => m.queueBreadcrumb(crumb))
}

export function exception(error: Error, context?: string): void {
  forward((m) => m.queueException(error, context))
}

export function message(
  msg: string,
  level?: SeverityLevel,
  context?: string,
): void {
  forward((m) => m.queueMessage(msg, level, context))
}

export function measurement(name: string, value: number, unit?: string): void {
  forward((m) => m.queueMeasurement(name, value, unit))
}
