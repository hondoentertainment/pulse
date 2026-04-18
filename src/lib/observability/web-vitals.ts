/**
 * Web Vitals capture.
 *
 * Uses the PerformanceObserver API when available to record paint and
 * long-task metrics without adding a runtime dependency. Metrics are
 * forwarded to the legacy performance tracker (`trackPerformance`) so they
 * show up in the existing analytics dashboard.
 */

import { trackPerformance } from '@/lib/analytics'
import { logger } from './logger'

let initialized = false

export interface WebVitalsOptions {
  /** Enable verbose logging for each metric. */
  debug?: boolean
}

export function initWebVitals(options: WebVitalsOptions = {}): void {
  if (initialized) return
  if (typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') return
  initialized = true

  const log = logger.child({ component: 'web-vitals' })

  safeObserve('paint', (entry) => {
    if (entry.name === 'first-contentful-paint') {
      record('FCP', entry.startTime, log, options.debug)
    }
  })

  safeObserve('largest-contentful-paint', (entry) => {
    record('LCP', entry.startTime, log, options.debug)
  })

  safeObserve('layout-shift', (entry: PerformanceEntry & { value?: number; hadRecentInput?: boolean }) => {
    if (!entry.hadRecentInput && typeof entry.value === 'number') {
      record('CLS', entry.value, log, options.debug, 'score')
    }
  })

  safeObserve('first-input', (entry: PerformanceEntry & { processingStart?: number }) => {
    if (typeof entry.processingStart === 'number') {
      record('FID', entry.processingStart - entry.startTime, log, options.debug)
    }
  })

  safeObserve('longtask', (entry) => {
    if (entry.duration > 200) {
      record('LongTask', entry.duration, log, options.debug)
    }
  })

  // Navigation timing (TTFB)
  try {
    const nav = performance.getEntriesByType('navigation')[0] as
      | PerformanceNavigationTiming
      | undefined
    if (nav) {
      record('TTFB', nav.responseStart, log, options.debug)
    }
  } catch {
    // noop
  }
}

function safeObserve(
  type: string,
  cb: (entry: PerformanceEntry & Record<string, unknown>) => void,
): void {
  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        cb(entry as PerformanceEntry & Record<string, unknown>)
      }
    })
    observer.observe({ type, buffered: true } as PerformanceObserverInit)
  } catch {
    // Some entry types are unsupported in older browsers; ignore silently.
  }
}

function record(
  metric: string,
  value: number,
  log: ReturnType<typeof logger.child>,
  debug: boolean | undefined,
  unit: string = 'ms',
): void {
  trackPerformance(metric, value, unit)
  if (debug) {
    log.info('metric', { metric, value, unit })
  }
}
