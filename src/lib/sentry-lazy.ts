/**
 * Minimal Sentry surface that we pull in via a dynamic `import()`.
 *
 * Because this module uses named imports (`init`, `browserTracingIntegration`,
 * `replayIntegration`, `captureException`, `captureMessage`, `addBreadcrumb`,
 * `setMeasurement`), Rollup can tree-shake the unused portions of
 * `@sentry/react` when this file is emitted as a separate chunk — shrinking
 * the sentry chunk from ~450 kB back down to the ~250 kB range the app
 * actually uses.
 *
 * ## Buffer / flush pattern
 *
 * `AppBootstrap` schedules `initSentry()` via `requestIdleCallback` AFTER
 * first paint, which means anything the app wants to report before the SDK
 * finishes loading would otherwise be dropped on the floor.
 *
 * To avoid that we expose thin `queue*` helpers (`queueBreadcrumb`,
 * `queueException`, `queueMessage`, `queueMeasurement`). Pre-init they
 * append to an in-memory buffer; post-init they forward directly. On
 * `initSentry()` the buffer is flushed so breadcrumbs / exceptions that
 * happened during startup still appear in the dashboard.
 *
 * The surface is intentionally narrow so `logger.ts` and `web-vitals.ts`
 * can call it without re-importing `@sentry/react` themselves — this is
 * what keeps the Sentry chunk out of the critical-path bundle.
 */
import {
  init,
  browserTracingIntegration,
  replayIntegration,
  captureException,
  captureMessage,
  addBreadcrumb,
  setMeasurement,
  type Breadcrumb,
  type SeverityLevel,
} from '@sentry/react'

// ---------------------------------------------------------------------------
// Buffered call queue
// ---------------------------------------------------------------------------

type QueuedCall =
  | { kind: 'breadcrumb'; crumb: Breadcrumb }
  | { kind: 'exception'; error: Error; context?: string }
  | { kind: 'message'; message: string; level?: SeverityLevel; context?: string }
  | { kind: 'measurement'; name: string; value: number; unit?: string }

const MAX_QUEUED = 200

let initialised = false
const queue: QueuedCall[] = []

function push(call: QueuedCall): void {
  if (queue.length >= MAX_QUEUED) {
    // Drop oldest — a long-lived tab without Sentry shouldn't grow unbounded.
    queue.shift()
  }
  queue.push(call)
}

function drain(): void {
  while (queue.length > 0) {
    const call = queue.shift()!
    try {
      dispatch(call)
    } catch {
      // Swallow — Sentry forwarding must never take the app down.
    }
  }
}

function dispatch(call: QueuedCall): void {
  switch (call.kind) {
    case 'breadcrumb':
      addBreadcrumb(call.crumb)
      return
    case 'exception':
      captureException(call.error, { extra: { context: call.context } })
      return
    case 'message':
      captureMessage(call.message, {
        level: call.level,
        extra: { context: call.context },
      })
      return
    case 'measurement':
      // setMeasurement's unit param is non-optional in `@sentry/react` typings
      // even though passing `undefined` works at runtime; default to 'none'
      // to keep us type-safe.
      setMeasurement(call.name, call.value, call.unit ?? 'none')
      return
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function initSentry(dsn: string): void {
  if (initialised) return
  init({
    dsn,
    integrations: [browserTracingIntegration(), replayIntegration()],
    tracesSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  })
  initialised = true
  drain()
}

/** Whether `initSentry()` has been called in this runtime. */
export function isSentryInitialised(): boolean {
  return initialised
}

export function reportException(error: Error, context?: string): void {
  if (!initialised) {
    push({ kind: 'exception', error, context })
    return
  }
  captureException(error, { extra: { context } })
}

export function reportMessage(message: string, context?: string): void {
  if (!initialised) {
    push({ kind: 'message', message, context })
    return
  }
  captureMessage(message, { extra: { context } })
}

/** Breadcrumb variant that queues pre-init. */
export function queueBreadcrumb(crumb: Breadcrumb): void {
  if (!initialised) {
    push({ kind: 'breadcrumb', crumb })
    return
  }
  addBreadcrumb(crumb)
}

/** Capture an exception. Queues pre-init and flushes on `initSentry()`. */
export function queueException(error: Error, context?: string): void {
  reportException(error, context)
}

/** Capture a message at the given severity. Queues pre-init. */
export function queueMessage(
  message: string,
  level?: SeverityLevel,
  context?: string,
): void {
  if (!initialised) {
    push({ kind: 'message', message, level, context })
    return
  }
  captureMessage(message, { level, extra: { context } })
}

/** Attach a measurement (e.g. a web vital). Queues pre-init. */
export function queueMeasurement(name: string, value: number, unit?: string): void {
  if (!initialised) {
    push({ kind: 'measurement', name, value, unit })
    return
  }
  setMeasurement(name, value, unit ?? 'none')
}

/** Test-only: wipe the queue + init flag so multiple specs can exercise init. */
export function __resetSentryLazyForTest(): void {
  initialised = false
  queue.length = 0
}
