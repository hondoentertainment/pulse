import { describe, expect, it } from 'vitest'
import { availableTags, filterEntries, filterSummary, isFilterActive, toggleTag } from '@/lib/signal-filter'
import type { SignalEntry } from '@/lib/signal-insights'

const entry = (overrides: Partial<SignalEntry> & { dayKey: string }): SignalEntry => ({
  id: overrides.id ?? `${overrides.dayKey}-${overrides.window ?? 'morning'}`,
  userId: 'user-1',
  createdAt: overrides.createdAt ?? `${overrides.dayKey}T08:00:00`,
  focus: 'energy',
  score: overrides.score ?? 70,
  energy: 7,
  mood: 7,
  stress: 4,
  sleepQuality: 7,
  tags: overrides.tags ?? [],
  window: overrides.window ?? 'morning',
  dayKey: overrides.dayKey,
})

const entries = [
  entry({ dayKey: '2026-08-01', tags: ['calm', 'social'] }),
  entry({ dayKey: '2026-08-02', window: 'evening', tags: ['tired'] }),
  entry({ dayKey: '2026-08-03', tags: ['calm'] }),
  entry({ dayKey: '2026-07-30', window: 'evening', tags: ['Calm ', 'active'] }),
]

describe('filterEntries', () => {
  it('returns everything when no filter is set', () => {
    expect(filterEntries(entries, {})).toHaveLength(4)
    expect(isFilterActive({})).toBe(false)
    expect(isFilterActive({ tags: [] })).toBe(false)
  })

  it('requires every selected tag, case- and whitespace-insensitively', () => {
    expect(filterEntries(entries, { tags: ['calm'] }).map((item) => item.dayKey)).toEqual([
      '2026-08-01',
      '2026-08-03',
      '2026-07-30',
    ])
    expect(filterEntries(entries, { tags: ['calm', 'social'] }).map((item) => item.dayKey)).toEqual(['2026-08-01'])
  })

  it('filters by window', () => {
    expect(filterEntries(entries, { window: 'evening' }).map((item) => item.dayKey)).toEqual(['2026-08-02', '2026-07-30'])
    expect(filterEntries(entries, { window: null })).toHaveLength(4)
  })

  it('matches a query against tags and the day key', () => {
    expect(filterEntries(entries, { query: 'tir' }).map((item) => item.dayKey)).toEqual(['2026-08-02'])
    expect(filterEntries(entries, { query: '2026-07' }).map((item) => item.dayKey)).toEqual(['2026-07-30'])
    expect(filterEntries(entries, { query: '   ' })).toHaveLength(4)
  })

  it('combines filters', () => {
    expect(filterEntries(entries, { tags: ['calm'], window: 'evening' }).map((item) => item.dayKey)).toEqual(['2026-07-30'])
  })
})

describe('availableTags', () => {
  it('counts each tag once per entry, most frequent first then alphabetical', () => {
    expect(availableTags(entries)).toEqual([
      { tag: 'calm', count: 2 },
      { tag: 'active', count: 1 },
      { tag: 'Calm', count: 1 },
      { tag: 'social', count: 1 },
      { tag: 'tired', count: 1 },
    ])
  })
})

describe('toggleTag / filterSummary', () => {
  it('toggles a tag in and out of the selection', () => {
    expect(toggleTag([], 'calm')).toEqual(['calm'])
    expect(toggleTag(['calm', 'tired'], 'calm')).toEqual(['tired'])
  })

  it('summarizes the visible count', () => {
    expect(filterSummary(4, 4, {})).toBe('4 check-ins')
    expect(filterSummary(1, 1, {})).toBe('1 check-in')
    expect(filterSummary(2, 4, { tags: ['calm'] })).toBe('2 of 4 check-ins')
    expect(filterSummary(0, 4, { tags: ['nope'] })).toMatch(/No check-ins match/)
  })
})
