import { describe, expect, it } from 'vitest'
import { entriesToCsv, signalExportFilename } from '@/lib/signal-export'
import type { SignalEntry } from '@/lib/signal-insights'

const entry = (overrides: Partial<SignalEntry> = {}): SignalEntry => ({
  id: overrides.id ?? '1',
  userId: 'user-1',
  createdAt: overrides.createdAt ?? '2026-08-30T08:00:00.000Z',
  focus: 'energy',
  score: overrides.score ?? 72,
  energy: 7,
  mood: 6,
  stress: 4,
  sleepQuality: 8,
  tags: overrides.tags ?? ['calm'],
  window: overrides.window ?? 'morning',
  dayKey: overrides.dayKey ?? '2026-08-30',
})

describe('entriesToCsv', () => {
  it('writes a header row even when there are no entries', () => {
    expect(entriesToCsv([])).toBe('day_key,window,score,energy,mood,stress,sleep_quality,tags,created_at')
  })

  it('escapes commas and quotes in tags', () => {
    const csv = entriesToCsv([entry({ tags: ['need rest, coffee', 'quoted "day"'] })])
    expect(csv).toContain('"need rest, coffee|quoted ""day"""')
  })

  it('exports only the rows passed in for this account', () => {
    const csv = entriesToCsv([
      entry({ id: 'mine-1', userId: 'user-1', dayKey: '2026-08-30', score: 72 }),
      entry({ id: 'mine-2', userId: 'user-1', dayKey: '2026-08-29', score: 61, window: 'evening', createdAt: '2026-08-29T20:00:00.000Z' }),
    ])
    const lines = csv.split('\n')
    expect(lines).toHaveLength(3)
    expect(csv).not.toContain('user-2')
    expect(csv).toContain('2026-08-29,evening,61')
    expect(csv).toContain('2026-08-30,morning,72')
  })

  it('sorts oldest first and includes window + day_key', () => {
    const csv = entriesToCsv([
      entry({ id: 'e', createdAt: '2026-08-30T20:00:00.000Z', window: 'evening', dayKey: '2026-08-30', score: 80 }),
      entry({ id: 'm', createdAt: '2026-08-29T08:00:00.000Z', window: 'morning', dayKey: '2026-08-29', score: 61 }),
    ])
    const lines = csv.split('\n')
    expect(lines[1]).toContain('2026-08-29,morning,61')
    expect(lines[2]).toContain('2026-08-30,evening,80')
  })
})

describe('signalExportFilename', () => {
  it('uses the local day key', () => {
    expect(signalExportFilename(new Date(2026, 7, 30, 9))).toBe('pulse-signal-2026-08-30.csv')
  })
})
