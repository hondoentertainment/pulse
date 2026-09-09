import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SignalEntry, SignalProfile } from '@/lib/signal-insights'
import { useSignalStore } from '@/stores/use-signal-store'

const profile: SignalProfile = {
  trackingFocus: 'energy',
  goal: 'more_energy',
}

function resetStore(entries: SignalEntry[] = []) {
  useSignalStore.setState({
    profile,
    entries,
    draft: { energy: 7, mood: 7, stress: 4, sleepQuality: 7, tags: ['calm'] },
    savedAt: null,
    firstWinOpen: false,
    reminderEnabled: false,
    lastCelebratedMilestone: null,
    snoozedUntil: null,
  })
}

describe('useSignalStore check-in windows', () => {
  beforeEach(() => {
    localStorage.clear()
    resetStore()
  })

  afterEach(() => {
    vi.useRealTimers()
    localStorage.clear()
  })

  it('writes day_key and check_in_window on a morning save', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 7, 16, 9, 0))
    const saved = useSignalStore.getState().saveEntry('user-1')
    expect(saved.dayKey).toBe('2026-08-16')
    expect(saved.window).toBe('morning')
    expect(saved.userId).toBe('user-1')
    expect(useSignalStore.getState().entries).toHaveLength(1)
  })

  it('refuses a second save in the same window', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 7, 16, 9, 15))
    const first = useSignalStore.getState().saveEntry('user-1')
    const second = useSignalStore.getState().saveEntry('user-1')
    expect(second.id).toBe(first.id)
    expect(useSignalStore.getState().entries).toHaveLength(1)
  })

  it('opens the evening window after noon when morning is already logged', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 7, 16, 9, 0))
    const morning = useSignalStore.getState().saveEntry('user-1')
    expect(morning.window).toBe('morning')

    vi.setSystemTime(new Date(2026, 7, 16, 15, 30))
    const evening = useSignalStore.getState().saveEntry('user-1')
    expect(evening.window).toBe('evening')
    expect(evening.dayKey).toBe('2026-08-16')
    expect(evening.id).not.toBe(morning.id)
    expect(useSignalStore.getState().entries).toHaveLength(2)
  })
})

describe('useSignalStore streak milestones', () => {
  beforeEach(() => {
    localStorage.clear()
    resetStore()
  })

  it('keeps the highest celebrated milestone and clears it with the account', () => {
    expect(useSignalStore.getState().lastCelebratedMilestone).toBeNull()
    useSignalStore.getState().celebrateMilestone(3)
    expect(useSignalStore.getState().lastCelebratedMilestone).toBe(3)
    useSignalStore.getState().celebrateMilestone(7)
    useSignalStore.getState().celebrateMilestone(3)
    expect(useSignalStore.getState().lastCelebratedMilestone).toBe(7)
    useSignalStore.getState().clearLocalAccount()
    expect(useSignalStore.getState().lastCelebratedMilestone).toBeNull()
  })
})


describe('useSignalStore import and snooze', () => {
  beforeEach(() => {
    localStorage.clear()
    resetStore()
  })

  afterEach(() => {
    vi.useRealTimers()
    localStorage.clear()
  })

  it('imports new day/window rows and skips conflicts', () => {
    // Pin to morning so saveEntry writes a morning row. After noon UTC the same
    // test would create an evening row and skip the imported evening conflict.
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 7, 16, 9, 0))
    const existing = useSignalStore.getState().saveEntry('user-1')
    const incoming = [
      { ...existing, id: 'dup' },
      {
        id: 'new-evening',
        userId: 'user-1',
        createdAt: '2026-08-16T18:00:00.000Z',
        focus: 'energy' as const,
        score: 70,
        energy: 7,
        mood: 7,
        stress: 4,
        sleepQuality: 7,
        tags: ['focus'],
        window: 'evening' as const,
        dayKey: existing.dayKey,
      },
    ]
    const result = useSignalStore.getState().importEntries('user-1', incoming)
    expect(result.imported).toBe(1)
    expect(result.skipped).toBe(1)
    expect(useSignalStore.getState().entries).toHaveLength(2)
  })

  it('persists snooze until cleared with the account', () => {
    useSignalStore.getState().setSnoozedUntil('2026-08-17T00:00:00.000Z')
    expect(useSignalStore.getState().snoozedUntil).toBe('2026-08-17T00:00:00.000Z')
    useSignalStore.getState().clearLocalAccount()
    expect(useSignalStore.getState().snoozedUntil).toBeNull()
  })
})
