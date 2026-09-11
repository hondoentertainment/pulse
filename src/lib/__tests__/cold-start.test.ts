import { describe, expect, it } from 'vitest'
import {
  ALL_SEATTLE_TIP,
  COLD_START_HEADLINE,
  COLD_START_SUBLINE,
  COLD_START_TIP_STORAGE_KEY,
  dismissColdStartTip,
  shouldShowColdStartTip,
  START_EXPLORING_LABEL,
  formatColdStartDebug,
  markMapInteractive,
  markNavigationStart,
} from '../cold-start'

function memoryStore(initial: Record<string, string> = {}): Storage {
  const data = { ...initial }
  return {
    get length() { return Object.keys(data).length },
    clear() { for (const key of Object.keys(data)) delete data[key] },
    getItem(key: string) { return data[key] ?? null },
    key(index: number) { return Object.keys(data)[index] ?? null },
    removeItem(key: string) { delete data[key] },
    setItem(key: string, value: string) { data[key] = value },
  }
}

describe('cold start', () => {
  it('ships Launch 33 first + All Seattle tip copy', () => {
    expect(COLD_START_HEADLINE).toBe('Where the energy is')
    expect(COLD_START_SUBLINE).toContain('Launch 33 first')
    expect(ALL_SEATTLE_TIP).toContain('All Seattle')
    expect(START_EXPLORING_LABEL).toBe('Start Exploring')
  })

  it('shows the tip once until dismissed', () => {
    const store = memoryStore()
    expect(shouldShowColdStartTip(store)).toBe(true)
    dismissColdStartTip(store)
    expect(store.getItem(COLD_START_TIP_STORAGE_KEY)).toBe('1')
    expect(shouldShowColdStartTip(store)).toBe(false)
  })

  it('measures map-interactive marks for the <2s cold-start helper', () => {
    const entries: Array<{ name: string; duration: number }> = []
    const perf = {
      mark() { return {} as PerformanceMark },
      measure(name: string) {
        entries.push({ name, duration: 840 })
        return {} as PerformanceMeasure
      },
      getEntriesByName(name: string) { return entries.filter((entry) => entry.name === name) },
    }
    markNavigationStart(perf)
    expect(markMapInteractive(perf)).toBe(840)
    expect(formatColdStartDebug(840)).toContain('840ms')
    expect(formatColdStartDebug(840)).toContain('<2000ms')
  })
})
