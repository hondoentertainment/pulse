/**
 * Structured logger for Pulse.
 *
 * Writes JSON-shaped log lines with consistent fields. Intended for
 * developer observability in the browser console today; a future wave can
 * pipe this to Sentry breadcrumbs or a remote log drain without changing
 * call sites.
 *
 * Usage:
 *   const log = logger.child({ component: 'VenuePage' })
 *   log.info('venue viewed', { venueId })
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogContext {
  [key: string]: unknown
}

export interface Logger {
  debug: (message: string, context?: LogContext) => void
  info: (message: string, context?: LogContext) => void
  warn: (message: string, context?: LogContext) => void
  error: (message: string, context?: LogContext) => void
  child: (context: LogContext) => Logger
}

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
}

function resolveMinLevel(): LogLevel {
  if (typeof import.meta !== 'undefined') {
    const env = (import.meta as { env?: Record<string, string | undefined> }).env
    const fromEnv = env?.VITE_LOG_LEVEL as LogLevel | undefined
    if (fromEnv && fromEnv in LEVEL_ORDER) return fromEnv
    if (env?.MODE === 'production' || env?.PROD === 'true') return 'info'
  }
  return 'debug'
}

const MIN_LEVEL = resolveMinLevel()

function emit(level: LogLevel, message: string, context: LogContext = {}): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[MIN_LEVEL]) return
  const line = {
    level,
    time: new Date().toISOString(),
    msg: message,
    ...context,
  }
  const method =
    level === 'error'
      ? console.error
      : level === 'warn'
        ? console.warn
        : level === 'info'
          ? console.info
          : console.debug
  method.call(console, JSON.stringify(line))
}

function createLogger(baseContext: LogContext): Logger {
  const merge = (ctx?: LogContext): LogContext =>
    ctx ? { ...baseContext, ...ctx } : { ...baseContext }
  return {
    debug: (msg, ctx) => emit('debug', msg, merge(ctx)),
    info: (msg, ctx) => emit('info', msg, merge(ctx)),
    warn: (msg, ctx) => emit('warn', msg, merge(ctx)),
    error: (msg, ctx) => emit('error', msg, merge(ctx)),
    child: (ctx) => createLogger({ ...baseContext, ...ctx }),
  }
}

export const logger: Logger = createLogger({})
