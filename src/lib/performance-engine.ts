/**
 * Performance Engine
 *
 * Virtual list calculations, prefetch management,
 * progressive image loading, and Web Vitals measurement.
 */

// ---------------------------------------------------------------------------
// Virtual List
// ---------------------------------------------------------------------------

export interface VirtualListConfig {
  itemHeight: number
  overscan: number
  containerHeight: number
}

export interface VisibleRange {
  startIndex: number
  endIndex: number
  offsetY: number
}

/**
 * Calculate which items are visible in a virtualized list given the current
 * scroll position and configuration. Returns the start/end indices plus a
 * pixel offset for the CSS transform.
 */
export function calculateVisibleRange(
  scrollTop: number,
  config: VirtualListConfig,
  totalItems: number
): VisibleRange {
  const { itemHeight, overscan, containerHeight } = config

  const firstVisible = Math.floor(scrollTop / itemHeight)
  const visibleCount = Math.ceil(containerHeight / itemHeight)

  const startIndex = Math.max(0, firstVisible - overscan)
  const endIndex = Math.min(totalItems - 1, firstVisible + visibleCount + overscan)
  const offsetY = startIndex * itemHeight

  return { startIndex, endIndex, offsetY }
}

// ---------------------------------------------------------------------------
// Prefetch Manager
// ---------------------------------------------------------------------------

export interface PrefetchEntry {
  url: string
  priority: 'high' | 'medium' | 'low'
  prefetchedAt?: number
}

const PRIORITY_WEIGHT: Record<PrefetchEntry['priority'], number> = {
  high: 3,
  medium: 2,
  low: 1,
}

export class PrefetchManager {
  private queue: Map<string, PrefetchEntry> = new Map()
  private readonly maxSize: number

  constructor(maxSize: number = 50) {
    this.maxSize = maxSize
  }

  /** Add a URL to the prefetch queue and trigger a `<link rel="prefetch">`. */
  add(url: string, priority: PrefetchEntry['priority'] = 'medium'): void {
    if (this.queue.has(url)) return

    // Evict lowest-priority entry when at capacity
    if (this.queue.size >= this.maxSize) {
      this.evictLowest()
    }

    const entry: PrefetchEntry = { url, priority, prefetchedAt: Date.now() }
    this.queue.set(url, entry)

    this.injectPrefetchLink(url, priority)
  }

  /** Check whether a URL has already been queued. */
  has(url: string): boolean {
    return this.queue.has(url)
  }

  /** Return basic stats about the prefetch queue. */
  getStats(): { total: number; byPriority: Record<string, number> } {
    const byPriority: Record<string, number> = { high: 0, medium: 0, low: 0 }
    for (const entry of this.queue.values()) {
      byPriority[entry.priority]++
    }
    return { total: this.queue.size, byPriority }
  }

  /** Remove all entries. */
  clear(): void {
    this.queue.clear()
  }

  // -- private ---------------------------------------------------------------

  private evictLowest(): void {
    let lowestKey: string | null = null
    let lowestWeight = Infinity

    for (const [key, entry] of this.queue) {
      const w = PRIORITY_WEIGHT[entry.priority]
      if (w < lowestWeight) {
        lowestWeight = w
        lowestKey = key
      }
    }

    if (lowestKey) {
      this.queue.delete(lowestKey)
    }
  }

  private injectPrefetchLink(url: string, priority: PrefetchEntry['priority']): void {
    if (typeof document === 'undefined') return

    const existing = document.querySelector(`link[href="${url}"]`)
    if (existing) return

    const link = document.createElement('link')
    link.rel = 'prefetch'
    link.href = url
    link.as = this.guessResourceType(url)
    if (priority === 'high') {
      link.setAttribute('fetchpriority', 'high')
    }
    document.head.appendChild(link)
  }

  private guessResourceType(url: string): string {
    if (/\.(jpe?g|png|gif|webp|avif|svg)(\?|$)/i.test(url)) return 'image'
    if (/\.(js|mjs)(\?|$)/i.test(url)) return 'script'
    if (/\.(css)(\?|$)/i.test(url)) return 'style'
    if (/\.(woff2?|ttf|otf)(\?|$)/i.test(url)) return 'font'
    return 'fetch'
  }
}

// ---------------------------------------------------------------------------
// Progressive Image Loading
// ---------------------------------------------------------------------------

export type ImageLoadState = 'placeholder' | 'thumbnail' | 'full'

/**
 * Generate a pleasing CSS gradient placeholder based on dimensions.
 * This is a lightweight alternative to blurhash that requires no decoding.
 */
export function generateBlurhash(width: number, height: number): string {
  // Derive deterministic hue from aspect ratio so each image gets a consistent look
  const ratio = width / (height || 1)
  const hue = Math.round((ratio * 137.5) % 360)
  const hue2 = (hue + 40) % 360

  return `linear-gradient(135deg, oklch(0.25 0.04 ${hue}) 0%, oklch(0.18 0.06 ${hue2}) 100%)`
}

// ---------------------------------------------------------------------------
// Web Vitals
// ---------------------------------------------------------------------------

export interface PerformanceMetrics {
  /** First Contentful Paint (ms) */
  fcp?: number
  /** Largest Contentful Paint (ms) */
  lcp?: number
  /** Cumulative Layout Shift */
  cls?: number
  /** First Input Delay (ms) */
  fid?: number
  /** Time to First Byte (ms) */
  ttfb?: number
}

/**
 * Measure Core Web Vitals using the PerformanceObserver API.
 * Calls `callback` each time a new metric is available.
 */
export function measureWebVitals(
  callback: (metrics: PerformanceMetrics) => void
): () => void {
  if (typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') {
    return () => {}
  }

  const metrics: PerformanceMetrics = {}
  const observers: PerformanceObserver[] = []

  // FCP
  try {
    const fcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      for (const entry of entries) {
        if (entry.name === 'first-contentful-paint') {
          metrics.fcp = entry.startTime
          callback({ ...metrics })
        }
      }
    })
    fcpObserver.observe({ type: 'paint', buffered: true })
    observers.push(fcpObserver)
  } catch {
    // Observer type not supported
  }

  // LCP
  try {
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      const last = entries[entries.length - 1]
      if (last) {
        metrics.lcp = last.startTime
        callback({ ...metrics })
      }
    })
    lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true })
    observers.push(lcpObserver)
  } catch {
    // Observer type not supported
  }

  // CLS
  try {
    let clsValue = 0
    const clsObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const layoutShift = entry as PerformanceEntry & {
          hadRecentInput?: boolean
          value?: number
        }
        if (!layoutShift.hadRecentInput && layoutShift.value != null) {
          clsValue += layoutShift.value
          metrics.cls = clsValue
          callback({ ...metrics })
        }
      }
    })
    clsObserver.observe({ type: 'layout-shift', buffered: true })
    observers.push(clsObserver)
  } catch {
    // Observer type not supported
  }

  // FID
  try {
    const fidObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      const first = entries[0] as PerformanceEntry & { processingStart?: number }
      if (first && first.processingStart != null) {
        metrics.fid = first.processingStart - first.startTime
        callback({ ...metrics })
      }
    })
    fidObserver.observe({ type: 'first-input', buffered: true })
    observers.push(fidObserver)
  } catch {
    // Observer type not supported
  }

  // TTFB
  try {
    const navEntries = performance.getEntriesByType('navigation')
    if (navEntries.length > 0) {
      const nav = navEntries[0] as PerformanceNavigationTiming
      metrics.ttfb = nav.responseStart - nav.requestStart
      callback({ ...metrics })
    }
  } catch {
    // Navigation timing not available
  }

  // Return cleanup function
  return () => {
    for (const observer of observers) {
      observer.disconnect()
    }
  }
}
