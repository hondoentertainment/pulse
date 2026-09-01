import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SignalEntry } from '@/lib/signal-insights'

const maybeSingle = vi.fn()
const updateSingle = vi.fn()
const insertSingle = vi.fn()
const insertRow = vi.fn()

vi.mock('@/lib/supabase', () => ({
  hasSupabaseConfig: true,
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle,
            }),
          }),
        }),
      }),
      update: () => ({
        eq: () => ({
          select: () => ({
            single: updateSingle,
          }),
        }),
      }),
      insert: (row: unknown) => {
        insertRow(row)
        return {
          select: () => ({
            single: insertSingle,
          }),
        }
      },
    }),
  },
}))

import { mergeSignalEntryLists, saveSignalEntry, signalEntryWindowKey } from '@/lib/signal-data'

const entry = (overrides: Partial<SignalEntry>): SignalEntry => ({
  id: overrides.id ?? 'local-new',
  userId: 'user-1',
  createdAt: overrides.createdAt ?? '2026-08-16T08:00:00.000Z',
  focus: 'energy',
  score: overrides.score ?? 70,
  energy: 7,
  mood: 7,
  stress: 4,
  sleepQuality: 7,
  tags: [],
  window: overrides.window ?? 'morning',
  dayKey: overrides.dayKey ?? '2026-08-16',
})

describe('mergeSignalEntryLists', () => {
  it('keeps one row per user/day/window and prefers the remote id', () => {
    const local = entry({ id: 'local-id', score: 50 })
    const remote = entry({ id: 'server-id', score: 80, createdAt: '2026-08-16T08:05:00.000Z' })
    const merged = mergeSignalEntryLists([local], [remote])
    expect(merged).toHaveLength(1)
    expect(merged[0]).toMatchObject({ id: 'server-id', score: 80 })
    expect(signalEntryWindowKey(local)).toBe(signalEntryWindowKey(remote))
  })
})

describe('saveSignalEntry', () => {
  beforeEach(() => {
    maybeSingle.mockReset()
    updateSingle.mockReset()
    insertSingle.mockReset()
    insertRow.mockReset()
  })

  it('inserts day_key and check_in_window on a new AM/PM check-in', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null })
    insertSingle.mockResolvedValue({
      data: {
        id: 'server-new',
        user_id: 'user-1',
        created_at: '2026-08-16T08:00:00.000Z',
        focus: 'energy',
        score: 70,
        energy: 7,
        mood: 7,
        stress: 4,
        sleep_quality: 7,
        tags: [],
        check_in_window: 'morning',
        day_key: '2026-08-16',
      },
      error: null,
    })

    const saved = await saveSignalEntry(entry({}))
    expect(saved.id).toBe('server-new')
    expect(insertRow).toHaveBeenCalledWith(expect.objectContaining({
      day_key: '2026-08-16',
      check_in_window: 'morning',
      user_id: 'user-1',
    }))
    expect(insertSingle).toHaveBeenCalled()
  })

  it('updates the existing server row when the window is already taken', async () => {
    const incoming = entry({ id: 'device-b', score: 91 })
    const existing = {
      id: 'server-id',
      user_id: 'user-1',
      created_at: '2026-08-16T08:00:00.000Z',
      focus: 'energy',
      score: 70,
      energy: 7,
      mood: 7,
      stress: 4,
      sleep_quality: 7,
      tags: [],
      check_in_window: 'morning',
      day_key: '2026-08-16',
    }
    maybeSingle.mockResolvedValue({ data: existing, error: null })
    updateSingle.mockResolvedValue({
      data: { ...existing, score: 91 },
      error: null,
    })

    const saved = await saveSignalEntry(incoming)
    expect(saved.id).toBe('server-id')
    expect(saved.score).toBe(91)
    expect(insertSingle).not.toHaveBeenCalled()
  })
})
