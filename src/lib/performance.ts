/**
 * Performance monitoring helpers
 *
 * - Web Vitals measurement (LCP, FID, CLS, INP, TTFB) via PerformanceObserver
 * - Custom marks/measures for key Pulse user journeys
 * - Reports to Vercel Analytics via the `track` API
 */

import { track } from '@vercel/analytics';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type VitalName = 'LCP' | 'FID' | 'CLS' | 'INP' | 'TTFB';

export interface VitalReport {
  name: VitalName;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
}

// ---------------------------------------------------------------------------
// Rating thresholds (Google Core Web Vitals 2024)
// ---------------------------------------------------------------------------

const thresholds: Record<VitalName, [number, number]> = {
  LCP:  [2500, 4000],
  FID:  [100,  300],
  CLS:  [0.1,  0.25],
  INP:  [200,  500],
  TTFB: [800,  1800],
};

function rate(name: VitalName, value: number): VitalReport['rating'] {
  const [good, poor] = thresholds[name];
  if (value <= good) return 'good';
  if (value <= poor) return 'needs-improvement';
  return 'poor';
}

function report(name: VitalName, value: number) {
  const vital: VitalReport = { name, value, rating: rate(name, value) };

  // Log in development for quick visibility
  if (import.meta.env.DEV) {
    console.debug(`[Vitals] ${name}: ${Math.round(value)} — ${vital.rating}`);
  }

  // Report to Vercel Analytics (non-blocking fire-and-forget)
  try {
    track('web-vital', { name, value: Math.round(value), rating: vital.rating });
  } catch {
    // Analytics may not be ready yet; silently ignore
  }
}

// ---------------------------------------------------------------------------
// Web Vitals observers
// ---------------------------------------------------------------------------

let observersInstalled = false;

export function initWebVitals(): void {
  if (observersInstalled || typeof window === 'undefined' || !('PerformanceObserver' in window)) {
    return;
  }
  observersInstalled = true;

  // TTFB — from Navigation Timing
  const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
  if (navEntries.length > 0) {
    report('TTFB', navEntries[0].responseStart - navEntries[0].requestStart);
  }

  // LCP
  try {
    const lcpObs = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1] as PerformanceEntry & { startTime: number };
      report('LCP', last.startTime);
    });
    lcpObs.observe({ type: 'largest-contentful-paint', buffered: true });
  } catch { /* unsupported */ }

  // FID (first input delay — legacy, replaced by INP but still useful)
  try {
    const fidObs = new PerformanceObserver((list) => {
      const entry = list.getEntries()[0] as PerformanceEntry & { processingStart: number; startTime: number };
      report('FID', entry.processingStart - entry.startTime);
      fidObs.disconnect();
    });
    fidObs.observe({ type: 'first-input', buffered: true });
  } catch { /* unsupported */ }

  // CLS — accumulate session window
  let clsValue = 0;
  let clsSessionValue = 0;
  let clsSessionEntries: PerformanceEntry[] = [];

  try {
    const clsObs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as (PerformanceEntry & { hadRecentInput: boolean; value: number })[]) {
        if (!entry.hadRecentInput) {
          const firstEntry = clsSessionEntries[0] as (PerformanceEntry & { startTime: number }) | undefined;
          const lastEntry = clsSessionEntries[clsSessionEntries.length - 1] as (PerformanceEntry & { startTime: number }) | undefined;

          if (
            !firstEntry ||
            (entry as unknown as { startTime: number }).startTime - lastEntry!.startTime < 1000 &&
            (entry as unknown as { startTime: number }).startTime - firstEntry.startTime < 5000
          ) {
            clsSessionValue += entry.value;
            clsSessionEntries.push(entry);
          } else {
            clsSessionValue = entry.value;
            clsSessionEntries = [entry];
          }

          if (clsSessionValue > clsValue) {
            clsValue = clsSessionValue;
            report('CLS', clsValue);
          }
        }
      }
    });
    clsObs.observe({ type: 'layout-shift', buffered: true });
  } catch { /* unsupported */ }

  // INP (Interaction to Next Paint — replaces FID as primary responsiveness metric)
  try {
    const inpObs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as (PerformanceEntry & { duration: number })[]) {
        report('INP', entry.duration);
      }
    });
    inpObs.observe({ type: 'event', buffered: true, durationThreshold: 16 } as PerformanceObserverInit);
  } catch { /* unsupported */ }
}

// ---------------------------------------------------------------------------
// Custom performance marks for Pulse journeys
// ---------------------------------------------------------------------------

/**
 * Mark the start of an instrumented operation.
 * Returns a function that, when called, finalises the measure and reports it.
 *
 * Usage:
 *   const done = startMark('pulse-create');
 *   // ... user creates a pulse ...
 *   done();
 */
export function startMark(name: string): () => void {
  if (typeof performance === 'undefined') return () => {};
  const start = `${name}:start`;
  performance.mark(start);

  return () => {
    try {
      const measure = performance.measure(name, start);
      const duration = Math.round(measure.duration);

      if (import.meta.env.DEV) {
        console.debug(`[Perf] ${name}: ${duration}ms`);
      }

      track('perf-mark', { name, duration });
    } catch {
      // Marks may be cleared by the browser; silently ignore
    }
  };
}

// Convenience wrappers for the most important Pulse journeys

/** Call when the user opens CreatePulseDialog; call returned fn when pulse is submitted. */
export const markPulseCreate = () => startMark('pulse-create');

/** Call when the map tab becomes active; call returned fn when tiles are painted. */
export const markMapLoad = () => startMark('map-load');

/** Call when a venue detail page starts loading; call returned fn when it renders. */
export const markVenuePageLoad = () => startMark('venue-page-load');
