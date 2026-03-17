/**
 * Structured Logging Module
 *
 * Provides leveled, structured logging with JSON output for production
 * ingestion and pretty-printed console output for development.
 *
 * Each log entry carries: timestamp, level, message, component (source),
 * optional data payload, and an optional correlation ID for tying related
 * log lines together across an operation.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  component: string
  correlationId?: string
  data?: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV

/** The minimum level that will actually be emitted. */
let minLevel: LogLevel = isDev ? 'debug' : 'info'

/**
 * Override the minimum log level at runtime.
 */
export function setLogLevel(level: LogLevel): void {
  minLevel = level
}

// ---------------------------------------------------------------------------
// Correlation ID support
// ---------------------------------------------------------------------------

let globalCorrelationId: string | undefined

/**
 * Set a correlation ID that will be attached to every subsequent log entry
 * until cleared. Useful for tying together all logs within a single user
 * session or request lifecycle.
 */
export function setCorrelationId(id: string | undefined): void {
  globalCorrelationId = id
}

/**
 * Generate a short random correlation ID.
 */
export function generateCorrelationId(): string {
  return `cid-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

// ---------------------------------------------------------------------------
// Log buffer (for production batching / export)
// ---------------------------------------------------------------------------

const LOG_BUFFER_MAX = 500
const logBuffer: LogEntry[] = []

/**
 * Return and clear the buffered log entries.
 * In a real production setup these would be flushed to a log aggregator
 * (e.g. Datadog, Loki, CloudWatch) on a timer or threshold.
 */
export function flushLogs(): LogEntry[] {
  return logBuffer.splice(0, logBuffer.length)
}

/**
 * Get a read-only snapshot of buffered logs.
 */
export function getLogBuffer(): readonly LogEntry[] {
  return [...logBuffer]
}

// ---------------------------------------------------------------------------
// Core emit function
// ---------------------------------------------------------------------------

function emit(level: LogLevel, message: string, component: string, data?: Record<string, unknown>): void {
  if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[minLevel]) {
    return
  }

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    component,
    ...(globalCorrelationId ? { correlationId: globalCorrelationId } : {}),
    ...(data ? { data } : {}),
  }

  // Buffer for production export
  logBuffer.push(entry)
  if (logBuffer.length > LOG_BUFFER_MAX) {
    logBuffer.splice(0, logBuffer.length - LOG_BUFFER_MAX)
  }

  if (isDev) {
    prettyPrint(entry)
  } else {
    // In production emit structured JSON to the console so that a log
    // aggregator sidecar can pick it up.
    const consoleMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'
    console[consoleMethod](JSON.stringify(entry))
  }
}

// ---------------------------------------------------------------------------
// Pretty-print (development only)
// ---------------------------------------------------------------------------

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: '#6b7280', // gray
  info: '#3b82f6',  // blue
  warn: '#f59e0b',  // amber
  error: '#ef4444', // red
}

function prettyPrint(entry: LogEntry): void {
  const color = LEVEL_COLORS[entry.level]
  const badge = `%c ${entry.level.toUpperCase()} %c ${entry.component} `
  const badgeStyles = [
    `background:${color};color:#fff;font-weight:bold;border-radius:3px;padding:1px 4px`,
    'background:#27272a;color:#a1a1aa;font-weight:normal;border-radius:3px;padding:1px 4px',
  ]

  const parts: unknown[] = [badge, ...badgeStyles, entry.message]

  if (entry.correlationId) {
    parts.push(`[${entry.correlationId}]`)
  }

  if (entry.data) {
    parts.push(entry.data)
  }

  const method = entry.level === 'error' ? 'error' : entry.level === 'warn' ? 'warn' : entry.level === 'debug' ? 'debug' : 'info'
  ;(console[method] as (...args: unknown[]) => void)(...parts)
}

// ---------------------------------------------------------------------------
// Public logger API
// ---------------------------------------------------------------------------

export const logger = {
  debug(message: string, component: string, data?: Record<string, unknown>): void {
    emit('debug', message, component, data)
  },

  info(message: string, component: string, data?: Record<string, unknown>): void {
    emit('info', message, component, data)
  },

  warn(message: string, component: string, data?: Record<string, unknown>): void {
    emit('warn', message, component, data)
  },

  error(message: string, component: string, data?: Record<string, unknown>): void {
    emit('error', message, component, data)
  },
}
