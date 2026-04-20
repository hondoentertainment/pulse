/**
 * Web Vitals capture — LCP, FID, CLS, INP (+ TTFB, FCP as bonus)
 *
 * We intentionally avoid adding the `web-vitals` package: the Performance
 * APIs it wraps (`PerformanceObserver`, `LayoutShift`, `LargestContentfulPaint`)
 * are available in every browser we support.
 *
 * Metrics are forwarded to:
 *   - structured logger (so they become Sentry breadcrumbs)
 *   - Sentry measurements (via `Sentry.setMeasurement` when available)
 *   - the configured HTTP log sink
 *
 * Product analytics intentionally does NOT receive web vitals: they are
 * performance telemetry, not user-intent events. Surface them on the
 * performance dashboard instead.
 */

import * as sentryBridge from '@/lib/sentry-bridge'
import { logger } from './logger'

export type WebVitalName = 'LCP' | 'FID' | 'CLS' | 'INP' | 'TTFB' | 'FCP'

export interface WebVital {
  name: WebVitalName
  /** Metric value. ms for timing metrics, unitless for CLS. */
  value: number
  /** Threshold rating. */
  rating: 'good' | 'needs-improvement' | 'poor'
  /** Route in effect when the metric fired. */
  route?: string
}

// Google's recommended thresholds (Core Web Vitals).
const THRESHOLDS: Record<WebVitalName, [number, number]> = {
  LCP: [2500, 4000],
  FID: [100, 300],
  CLS: [0.1, 0.25],
  INP: [200, 500],
  TTFB: [800, 1800],
  FCP: [1800, 3000],
}

function rate(name: WebVitalName, value: number): WebVital['rating'] {
  const [good, poor] = THRESHOLDS[name]
  if (value <= good) return 'good'
  if (value <= poor) return 'needs-improvement'
  return 'poor'
}

function report(v: WebVital): void {
  const level = v.rating === 'poor' ? 'warn' : 'info'
  logger[level](`web-vital:${v.name}`, {
    component: 'web-vitals',
    action: `web-vital.${v.name}`,
    route: v.route ?? (typeof location !== 'undefined' ? location.pathname : undefined),
    extra: { name: v.name, value: v.value, rating: v.rating },
  })
  try {
    // Forwarded via the lazy bridge so we don't pull `@sentry/react` into
    // the critical-path chunk. Pre-init calls are buffered inside
    // `sentry-lazy` and flushed once `initSentry()` runs.
    sentryBridge.measurement(
      v.name,
      v.value,
      v.name === 'CLS' ? 'none' : 'millisecond'
    )
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Observers
// ---------------------------------------------------------------------------

function supportsObserver(type: string): boolean {
  try {
    const entryTypes = (PerformanceObserver as unknown as { supportedEntryTypes?: string[] })
      .supportedEntryTypes
    return Array.isArray(entryTypes) && entryTypes.includes(type)
  } catch {
    return false
  }
}

function observe(type: string, cb: (entries: PerformanceEntryList) => void): PerformanceObserver | undefined {
  if (!supportsObserver(type)) return undefined
  try {
    const obs = new PerformanceObserver((list) => cb(list.getEntries()))
    obs.observe({ type, buffered: true } as PerformanceObserverInit)
    return obs
  } catch {
    return undefined
  }
}

// LCP: final value is the largest paint before the first user interaction or page hide.
function observeLCP(): void {
  let last: number | undefined
  const obs = observe('largest-contentful-paint', (entries) => {
    const e = entries[entries.length - 1] as (PerformanceEntry & { startTime: number }) | undefined
    if (e) last = e.startTime
  })
  if (!obs) return
  const finalize = () => {
    if (last !== undefined) {
      report({ name: 'LCP', value: last, rating: rate('LCP', last) })
      last = undefined
    }
    try {
      obs.disconnect()
    } catch {
      // ignore
    }
  }
  addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') finalize()
  })
  addEventListener('pagehide', finalize, { once: true })
}

// FID: first input delay — single, one-shot.
function observeFID(): void {
  const obs = observe('first-input', (entries) => {
    const e = entries[0] as (PerformanceEntry & { processingStart: number; startTime: number }) | undefined
    if (!e) return
    const value = e.processingStart - e.startTime
    report({ name: 'FID', value, rating: rate('FID', value) })
    try {
      obs?.disconnect()
    } catch {
      // ignore
    }
  })
}

// CLS: cumulative layout shift across session, using session windowing.
function observeCLS(): void {
  let clsValue = 0
  let clsEntries: Array<PerformanceEntry & { value: number; hadRecentInput: boolean; startTime: number }> = []

  const obs = observe('layout-shift', (entries) => {
    for (const raw of entries) {
      const e = raw as PerformanceEntry & { value: number; hadRecentInput: boolean; startTime: number }
      if (e.hadRecentInput) continue
      const first = clsEntries[0]
      const last = clsEntries[clsEntries.length - 1]
      if (
        clsEntries.length > 0 &&
        last &&
        first &&
        (e.startTime - last.startTime >= 1000 || e.startTime - first.startTime >= 5000)
      ) {
        clsEntries = [e]
      } else {
        clsEntries.push(e)
      }
      const windowed = clsEntries.reduce((acc, x) => acc + x.value, 0)
      if (windowed > clsValue) clsValue = windowed
    }
  })
  if (!obs) return
  const finalize = () => {
    report({ name: 'CLS', value: clsValue, rating: rate('CLS', clsValue) })
  }
  addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') finalize()
  })
  addEventListener('pagehide', finalize, { once: true })
}

// INP: largest interaction delay across the session.
function observeINP(): void {
  let worst = 0
  const obs = observe('event', (entries) => {
    for (const raw of entries) {
      const e = raw as PerformanceEntry & { duration: number; interactionId?: number }
      // Only count entries with an interactionId (i.e. real user interactions).
      if (!e.interactionId) continue
      if (e.duration > worst) worst = e.duration
    }
  })
  if (!obs) return
  const finalize = () => {
    if (worst > 0) report({ name: 'INP', value: worst, rating: rate('INP', worst) })
  }
  addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') finalize()
  })
  addEventListener('pagehide', finalize, { once: true })
}

// TTFB + FCP: read from navigation / paint timing — one-shot.
function observeTTFBAndFCP(): void {
  try {
    const [nav] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[]
    if (nav && nav.responseStart > 0) {
      const ttfb = nav.responseStart - nav.startTime
      report({ name: 'TTFB', value: ttfb, rating: rate('TTFB', ttfb) })
    }
    const fcp = performance.getEntriesByName('first-contentful-paint')[0] as
      | PerformanceEntry
      | undefined
    if (fcp) {
      report({ name: 'FCP', value: fcp.startTime, rating: rate('FCP', fcp.startTime) })
    }
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Public
// ---------------------------------------------------------------------------

let started = false

/**
 * Start capturing web vitals. Safe to call multiple times.
 * Call once near the root (e.g. from main.tsx) — but per the task
 * constraints this file does NOT auto-start; opt-in via `initWebVitals()`.
 */
export function initWebVitals(): void {
  if (started) return
  if (typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') return
  started = true
  observeLCP()
  observeFID()
  observeCLS()
  observeINP()
  observeTTFBAndFCP()
}

/** Testing hook — resets internal state so `initWebVitals` can be called again. */
export function __resetWebVitalsForTest(): void {
  started = false
}
