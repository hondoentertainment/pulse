/**
 * Structured Logger
 *
 * Production-grade logging with:
 * - Levels: debug | info | warn | error
 * - Correlation IDs for request/session tracing
 * - Pluggable sinks: console in dev, Sentry breadcrumbs + pluggable
 *   backend sink (HTTP) in prod
 * - Typed log fields (userId, sessionId, route, action, ...)
 *
 * Design notes:
 * - Zero new runtime dependencies. Uses `fetch` + `@sentry/react`
 *   (already bundled) under the hood.
 * - Sinks are pure functions. Add a sink in one place, every logger
 *   call forwards to it.
 * - warn+ entries become Sentry breadcrumbs so they are attached to
 *   any subsequent captured error. error-level entries are captured
 *   as Sentry messages so they surface in the issue stream even when
 *   there is no thrown exception.
 */

import * as Sentry from '@sentry/react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
}

/**
 * Canonical, typed fields every log line may carry.
 * Additional keys are allowed via `LogFields['extra']`.
 */
export interface LogFields {
  /** Authenticated user id, if known. */
  userId?: string
  /** Anonymous session id (generated once per tab). */
  sessionId?: string
  /** Current client route / pathname. */
  route?: string
  /** Semantic action tag, e.g. `pulse.create`. */
  action?: string
  /** Correlation id to stitch related events across sinks. */
  correlationId?: string
  /** Request id (outbound fetch). */
  requestId?: string
  /** Component / module emitting the log. */
  component?: string
  /** Free-form extras. Must be JSON-serialisable. */
  extra?: Record<string, unknown>
}

export interface LogEntry extends LogFields {
  level: LogLevel
  message: string
  /** Epoch ms. */
  timestamp: number
  /** Optional attached error. */
  error?: { name: string; message: string; stack?: string }
}

export interface LogSink {
  name: string
  write(entry: LogEntry): void
}

// ---------------------------------------------------------------------------
// Environment helpers
// ---------------------------------------------------------------------------

const isDev = (() => {
  try {
    return Boolean(import.meta.env?.DEV)
  } catch {
    return false
  }
})()

const minLevel: LogLevel = ((): LogLevel => {
  try {
    const v = import.meta.env?.VITE_LOG_LEVEL as LogLevel | undefined
    if (v && v in LEVEL_RANK) return v
  } catch {
    // ignore
  }
  return isDev ? 'debug' : 'info'
})()

function shouldLog(level: LogLevel): boolean {
  return LEVEL_RANK[level] >= LEVEL_RANK[minLevel]
}

// ---------------------------------------------------------------------------
// Correlation / session ids
// ---------------------------------------------------------------------------

const SESSION_KEY = 'pulse.obs.sessionId'

function genId(): string {
  // Prefer crypto.randomUUID when available; fallback for older runtimes.
  const g =
    typeof globalThis !== 'undefined'
      ? (globalThis as unknown as { crypto?: Crypto }).crypto
      : undefined
  if (g && typeof g.randomUUID === 'function') return g.randomUUID()
  return `id_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
}

let cachedSessionId: string | null = null
export function getSessionId(): string {
  if (cachedSessionId) return cachedSessionId
  try {
    if (typeof sessionStorage !== 'undefined') {
      const existing = sessionStorage.getItem(SESSION_KEY)
      if (existing) {
        cachedSessionId = existing
        return existing
      }
      const fresh = genId()
      sessionStorage.setItem(SESSION_KEY, fresh)
      cachedSessionId = fresh
      return fresh
    }
  } catch {
    // storage disabled; fall through
  }
  cachedSessionId = genId()
  return cachedSessionId
}

/** Create a new correlation id. Callers stash this in `LogFields.correlationId`. */
export function newCorrelationId(): string {
  return genId()
}

// ---------------------------------------------------------------------------
// Sinks
// ---------------------------------------------------------------------------

const consoleSink: LogSink = {
  name: 'console',
  write(entry) {
    const { level, message, timestamp, ...rest } = entry
    const payload = { timestamp: new Date(timestamp).toISOString(), ...rest }
    const method: 'debug' | 'info' | 'warn' | 'error' =
      level === 'debug' ? 'debug' : level === 'info' ? 'info' : level === 'warn' ? 'warn' : 'error'
    // Use structured console output so devtools render the object tree.
    console[method](`[${level}] ${message}`, payload)
  },
}

/**
 * Sentry sink:
 * - warn+ becomes a breadcrumb (attached to the next captured error)
 * - error becomes a captureMessage so it surfaces standalone too
 */
const sentrySink: LogSink = {
  name: 'sentry',
  write(entry) {
    if (LEVEL_RANK[entry.level] < LEVEL_RANK.warn) return
    try {
      Sentry.addBreadcrumb({
        level: entry.level === 'warn' ? 'warning' : entry.level,
        category: entry.component ?? entry.action ?? 'log',
        message: entry.message,
        timestamp: entry.timestamp / 1000,
        data: {
          userId: entry.userId,
          sessionId: entry.sessionId,
          route: entry.route,
          action: entry.action,
          correlationId: entry.correlationId,
          requestId: entry.requestId,
          ...entry.extra,
        },
      })
      if (entry.level === 'error') {
        if (entry.error) {
          Sentry.captureException(new Error(entry.error.message), {
            extra: {
              ...entry,
              logMessage: entry.message,
              stack: entry.error.stack,
            },
          })
        } else {
          Sentry.captureMessage(entry.message, {
            level: 'error',
            extra: { ...entry },
          })
        }
      }
    } catch {
      // Never let the sink throw.
    }
  },
}

/**
 * HTTP backend sink: ships logs to an arbitrary collector (Datadog,
 * Logtail, Axiom, or a bespoke endpoint) via `fetch`. Gated on
 * `VITE_LOG_SINK_URL`; no-op otherwise. Uses `navigator.sendBeacon`
 * when the page is unloading for best-effort delivery.
 */
const httpSink: LogSink = {
  name: 'http',
  write(entry) {
    let url: string | undefined
    try {
      url = import.meta.env?.VITE_LOG_SINK_URL as string | undefined
    } catch {
      // ignore
    }
    if (!url) return
    try {
      const body = JSON.stringify(entry)
      if (
        typeof navigator !== 'undefined' &&
        'sendBeacon' in navigator &&
        document.visibilityState === 'hidden'
      ) {
        ;(navigator as Navigator).sendBeacon(url, body)
        return
      }
      void fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {
        // Swallow — logger must never raise.
      })
    } catch {
      // ignore
    }
  },
}

// Sink registry (mutable so tests / adapters can swap it).
const sinks: LogSink[] = isDev ? [consoleSink, sentrySink] : [sentrySink, httpSink]

export function registerSink(sink: LogSink): void {
  sinks.push(sink)
}

export function clearSinks(): void {
  sinks.length = 0
}

// ---------------------------------------------------------------------------
// Logger API
// ---------------------------------------------------------------------------

function normaliseError(err: unknown): LogEntry['error'] | undefined {
  if (!err) return undefined
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack }
  }
  return { name: 'NonError', message: String(err) }
}

function emit(level: LogLevel, message: string, fields: LogFields & { err?: unknown } = {}): void {
  if (!shouldLog(level)) return
  const { err, ...rest } = fields
  const entry: LogEntry = {
    level,
    message,
    timestamp: Date.now(),
    sessionId: rest.sessionId ?? getSessionId(),
    ...rest,
    error: normaliseError(err),
  }
  for (const sink of sinks) {
    try {
      sink.write(entry)
    } catch {
      // sink errors must never escape
    }
  }
}

export interface Logger {
  debug: (message: string, fields?: LogFields) => void
  info: (message: string, fields?: LogFields) => void
  warn: (message: string, fields?: LogFields & { err?: unknown }) => void
  error: (message: string, fields?: LogFields & { err?: unknown }) => void
  /** Returns a new logger with `bound` fields merged into every call. */
  child: (bound: LogFields) => Logger
}

function create(bound: LogFields = {}): Logger {
  const merge = (f?: LogFields) => ({
    ...bound,
    ...f,
    extra: { ...(bound.extra ?? {}), ...(f?.extra ?? {}) },
  })
  return {
    debug: (m, f) => emit('debug', m, merge(f)),
    info: (m, f) => emit('info', m, merge(f)),
    warn: (m, f) => emit('warn', m, merge(f)),
    error: (m, f) => emit('error', m, merge(f)),
    child: (extra) => create({ ...bound, ...extra }),
  }
}

/** Root logger. Use `logger.child({ component: 'x' })` in modules. */
export const logger: Logger = create()

/** Convenience: time a block and log the duration at `info`. */
export async function withTiming<T>(
  action: string,
  fn: () => Promise<T> | T,
  fields: LogFields = {}
): Promise<T> {
  const started = Date.now()
  const correlationId = fields.correlationId ?? newCorrelationId()
  try {
    const result = await fn()
    logger.info(`${action} ok`, {
      ...fields,
      action,
      correlationId,
      extra: { ...(fields.extra ?? {}), durationMs: Date.now() - started },
    })
    return result
  } catch (err) {
    logger.error(`${action} failed`, {
      ...fields,
      action,
      correlationId,
      err,
      extra: { ...(fields.extra ?? {}), durationMs: Date.now() - started },
    })
    throw err
  }
}
