/**
 * Minimal Sentry surface that we pull in via a dynamic `import()`.
 *
 * Because this module uses named imports (`init`, `browserTracingIntegration`,
 * `replayIntegration`, `captureException`, `captureMessage`), Rollup can
 * tree-shake the unused portions of `@sentry/react` when this file is emitted
 * as a separate chunk — shrinking the sentry-lazy bundle from ~450 kB back
 * down to the ~250 kB range the app actually uses.
 */
import {
  init,
  browserTracingIntegration,
  replayIntegration,
  captureException,
  captureMessage,
} from '@sentry/react'

export function initSentry(dsn: string) {
  init({
    dsn,
    integrations: [browserTracingIntegration(), replayIntegration()],
    tracesSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  })
}

export function reportException(error: Error, context?: string) {
  captureException(error, { extra: { context } })
}

export function reportMessage(message: string, context?: string) {
  captureMessage(message, { extra: { context } })
}
