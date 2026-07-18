import { describe, expect, it } from 'vitest'
import { toSignalCsv, buildExportFilename } from '@/lib/signal-export'
import type { SignalEntry } from '@/lib/signal-insights'

function entry(overrides: Partial<SignalEntry> & { id: string; createdAt: string }): SignalEntry {
  return {
    userId: 'u1',
    focus: 'energy',
    score: 70,
    energy: 7,
    mood: 7,
    stress: 4,
    sleepQuality: 7,
    tags: [],
    ...overrides,
  }
}

describe('toSignalCsv', () => {
  it('emits a header row even with no entries', () => {
    const csv = toSignalCsv([])
    expect(csv).toBe('date,time,focus,score,energy,mood,stress,sleep_quality,tags')
  })

  it('serialises entries newest-first with local date/time and tags space-joined', () => {
    // Build createdAt from LOCAL components so the expected local formatting is
    // timezone-independent (export uses the viewer's local date, like History).
    const csv = toSignalCsv([
      entry({ id: 'a', createdAt: new Date(2026, 6, 1, 9, 30, 0).toISOString(), score: 60, tags: ['calm', 'active'] }),
      entry({ id: 'b', createdAt: new Date(2026, 6, 3, 18, 5, 0).toISOString(), score: 82, tags: ['clear'] }),
    ])
    const lines = csv.split('\n')
    expect(lines).toHaveLength(3)
    // Newest (Jul 3) comes first.
    expect(lines[1]).toBe('2026-07-03,18:05,energy,82,7,7,4,7,clear')
    expect(lines[2]).toBe('2026-07-01,09:30,energy,60,7,7,4,7,calm active')
  })

  it('escapes fields that contain commas or quotes', () => {
    const csv = toSignalCsv([
      entry({ id: 'c', createdAt: '2026-07-01T09:00:00Z', tags: ['a,b', 'q"uote'] }),
    ])
    const row = csv.split('\n')[1]
    // tags joined by space → `a,b q"uote` → needs quoting + doubled quote
    expect(row.endsWith('"a,b q""uote"')).toBe(true)
  })
})

describe('buildExportFilename', () => {
  it('date-stamps the filename', () => {
    expect(buildExportFilename(new Date('2026-07-05T12:00:00Z'))).toBe('pulse-signal-2026-07-05.csv')
  })
})
