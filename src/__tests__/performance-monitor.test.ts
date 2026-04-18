/**
 * Performance Monitor — Unit Tests
 *
 * Separated from observability.test.ts because vi.mock() is hoisted to the
 * top of the file and would replace the real logger/analytics used by other
 * test suites in that file.
 */

import { describe, it, expect, afterEach, vi } from 'vitest'

import {
  startMapRenderTiming,
  startVenueListRenderTiming,
  startSearchQueryTiming,
  getPerformanceReport,
} from '@/lib/performance-monitor'

vi.mock('@/lib/analytics', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/analytics')>()
  return {
    ...actual,
    trackPerformance: vi.fn(),
  }
})

vi.mock('@/lib/logger', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/logger')>()
  return {
    ...actual,
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  }
})

describe('Performance Monitor — custom timings', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('startMapRenderTiming', () => {
    it('returns a function that records a custom timing entry', () => {
      const end = startMapRenderTiming()
      end()

      const report = getPerformanceReport()
      expect(report.customTimings.some(t => t.name === 'map_render')).toBe(true)
    })

    it('records a non-negative duration', () => {
      const end = startMapRenderTiming()
      end()

      const report = getPerformanceReport()
      const entry = report.customTimings.find(t => t.name === 'map_render')
      expect(entry?.durationMs).toBeGreaterThanOrEqual(0)
    })
  })

  describe('startVenueListRenderTiming', () => {
    it('records venue_list_render timing', () => {
      const end = startVenueListRenderTiming()
      end()

      const report = getPerformanceReport()
      expect(report.customTimings.some(t => t.name === 'venue_list_render')).toBe(true)
    })
  })

  describe('startSearchQueryTiming', () => {
    it('records search_query timing', () => {
      const end = startSearchQueryTiming()
      end()

      const report = getPerformanceReport()
      expect(report.customTimings.some(t => t.name === 'search_query')).toBe(true)
    })
  })

  describe('getPerformanceReport', () => {
    it('returns webVitals snapshot', () => {
      const report = getPerformanceReport()
      expect(report).toHaveProperty('webVitals')
      expect(typeof report.webVitals).toBe('object')
    })

    it('returns customTimings array', () => {
      const report = getPerformanceReport()
      expect(Array.isArray(report.customTimings)).toBe(true)
    })

    it('customTimingsSummary contains averaged stats per operation', () => {
      const end1 = startMapRenderTiming()
      end1()
      const end2 = startMapRenderTiming()
      end2()

      const report = getPerformanceReport()
      const summary = report.customTimingsSummary['map_render']
      expect(summary).toBeDefined()
      expect(summary.count).toBeGreaterThanOrEqual(2)
      expect(summary.avgMs).toBeGreaterThanOrEqual(0)
      expect(summary.maxMs).toBeGreaterThanOrEqual(0)
    })

    it('customTimingsSummary maxMs is the largest observed value', () => {
      startMapRenderTiming()()
      const report = getPerformanceReport()
      const summary = report.customTimingsSummary['map_render']
      expect(summary.maxMs).toBeGreaterThanOrEqual(summary.avgMs)
    })

    it('report is a snapshot — mutating it does not affect internal state', () => {
      const report1 = getPerformanceReport()
      ;(report1.customTimings as unknown as unknown[]).push({ name: 'injected', durationMs: 999, timestamp: 0 })

      const report2 = getPerformanceReport()
      expect(report2.customTimings.some(t => t.name === 'injected')).toBe(false)
    })
  })
})
