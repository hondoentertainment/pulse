/**
 * Performance Monitoring Module
 *
 * Tracks key web vitals (LCP, FID, CLS, TTFB), route transition timing,
 * and arbitrary user-interaction durations.  Metrics are forwarded to the
 * analytics module via `trackPerformance`.
 */

import { trackPerformance } from '@/lib/analytics'
import { logger } from '@/lib/logger'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WebVitals {
  lcp?: number
  fid?: number
  cls?: number
  ttfb?: number
}

interface NavigationMark {
  routeName: string
  startTime: number
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const collectedVitals: WebVitals = {}
let activeNavigation: NavigationMark | null = null

// ---------------------------------------------------------------------------
// Web Vitals collection via PerformanceObserver
// ---------------------------------------------------------------------------

function observeLCP(): void {
  try {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      const last = entries[entries.length - 1] as PerformanceEntry & { startTime: number }
      if (last) {
        collectedVitals.lcp = last.startTime
        trackPerformance('lcp', last.startTime, 'ms')
        logger.info(`LCP: ${last.startTime.toFixed(1)}ms`, 'PerformanceMonitor')
      }
    })
    observer.observe({ type: 'largest-contentful-paint', buffered: true })
  } catch {
    // PerformanceObserver not supported or entry type unavailable
  }
}

function observeFID(): void {
  try {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries() as (PerformanceEntry & { processingStart: number; startTime: number })[]
      for (const entry of entries) {
        const fid = entry.processingStart - entry.startTime
        collectedVitals.fid = fid
        trackPerformance('fid', fid, 'ms')
        logger.info(`FID: ${fid.toFixed(1)}ms`, 'PerformanceMonitor')
      }
    })
    observer.observe({ type: 'first-input', buffered: true })
  } catch {
    // Not supported
  }
}

function observeCLS(): void {
  try {
    let clsValue = 0
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries() as (PerformanceEntry & { hadRecentInput: boolean; value: number })[]
      for (const entry of entries) {
        if (!entry.hadRecentInput) {
          clsValue += entry.value
        }
      }
      collectedVitals.cls = clsValue
      trackPerformance('cls', clsValue, 'score')
    })
    observer.observe({ type: 'layout-shift', buffered: true })
  } catch {
    // Not supported
  }
}

function measureTTFB(): void {
  try {
    const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[]
    if (navEntries.length > 0) {
      const ttfb = navEntries[0].responseStart - navEntries[0].requestStart
      if (ttfb >= 0) {
        collectedVitals.ttfb = ttfb
        trackPerformance('ttfb', ttfb, 'ms')
        logger.info(`TTFB: ${ttfb.toFixed(1)}ms`, 'PerformanceMonitor')
      }
    }
  } catch {
    // Not supported
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialize all web-vital observers.  Call once at app startup.
 */
export function initPerformanceMonitoring(): void {
  if (typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') {
    return
  }

  observeLCP()
  observeFID()
  observeCLS()
  measureTTFB()

  logger.info('Performance monitoring initialized', 'PerformanceMonitor')
}

/**
 * Return the latest collected web vitals snapshot.
 */
export function getWebVitals(): WebVitals {
  return { ...collectedVitals }
}

/**
 * Call when a route navigation begins.
 * Pair with `endNavigation` to measure the full transition time.
 */
export function measureNavigation(routeName: string): void {
  activeNavigation = {
    routeName,
    startTime: performance.now(),
  }
}

/**
 * Call when the navigated route has finished rendering / loading.
 * Reports the measured duration to the analytics module.
 */
export function endNavigation(): void {
  if (!activeNavigation) return

  const duration = performance.now() - activeNavigation.startTime
  trackPerformance(`navigation.${activeNavigation.routeName}`, duration, 'ms')
  logger.debug(
    `Navigation to "${activeNavigation.routeName}" took ${duration.toFixed(1)}ms`,
    'PerformanceMonitor',
  )
  activeNavigation = null
}

/**
 * Wrap and time a synchronous or asynchronous user interaction.
 *
 * @example
 *   await measureInteraction('submit-pulse', async () => { ... })
 */
export async function measureInteraction<T>(
  interactionName: string,
  fn: () => T | Promise<T>,
): Promise<T> {
  const start = performance.now()
  try {
    const result = await fn()
    const duration = performance.now() - start
    trackPerformance(`interaction.${interactionName}`, duration, 'ms')
    logger.debug(
      `Interaction "${interactionName}" completed in ${duration.toFixed(1)}ms`,
      'PerformanceMonitor',
    )
    return result
  } catch (error) {
    const duration = performance.now() - start
    trackPerformance(`interaction.${interactionName}.error`, duration, 'ms')
    throw error
  }
}
