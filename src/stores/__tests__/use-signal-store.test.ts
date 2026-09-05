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
