import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { mergeSignalEntryLists, saveSignalEntry, saveSignalProfile } from '@/lib/signal-data'
import { computeDraftScore } from '@/lib/signal-score'
import { getOpenWindow, getTodayEntries, resolveEntryWindow, type SignalEntry, type SignalGoal, type SignalProfile, type TrackingFocus } from '@/lib/signal-insights'
import { localDayKey, resolveCheckInWindow } from '@/lib/signal-windows'

interface DraftSignal {
  energy: number
  mood: number
  stress: number
  sleepQuality: number
  tags: string[]
}

interface SignalStore {
  profile: SignalProfile | null
  entries: SignalEntry[]
  draft: DraftSignal
  savedAt: string | null
  firstWinOpen: boolean
  reminderEnabled: boolean
  /** Highest streak milestone already celebrated, so each fires once. */
  lastCelebratedMilestone: number | null
  setProfile: (userId: string, profile: SignalProfile) => void
  mergeRemoteEntries: (entries: SignalEntry[]) => void
  updateDraft: (patch: Partial<DraftSignal>) => void
  saveEntry: (userId: string, focus?: TrackingFocus) => SignalEntry
  closeFirstWin: () => void
  celebrateMilestone: (milestone: number) => void
  setReminder: (enabled: boolean, reminderTime?: string, userId?: string) => void
  clearLocalAccount: () => void
}

const clampScore = (value: number) => Math.max(1, Math.min(10, Math.round(value)))

const createEntryId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `signal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

const scoreDraft = computeDraftScore

export const useSignalStore = create<SignalStore>()(
  persist(
    (set, get) => ({
      profile: null,
      entries: [],
      draft: {
        energy: 7,
        mood: 7,
        stress: 4,
        sleepQuality: 7,
        tags: ['calm'],
      },
      savedAt: null,
      firstWinOpen: false,
      reminderEnabled: false,
      lastCelebratedMilestone: null,
      setProfile: (userId, profile) => {
        set({ profile })
        void saveSignalProfile(userId, profile)
      },
      mergeRemoteEntries: (remoteEntries) => {
        if (remoteEntries.length === 0) return
        set((state) => ({
          entries: mergeSignalEntryLists(state.entries, remoteEntries),
        }))
      },
      updateDraft: (patch) => {
        set((state) => ({
          draft: {
            ...state.draft,
            ...patch,
            energy: patch.energy !== undefined ? clampScore(patch.energy) : state.draft.energy,
            mood: patch.mood !== undefined ? clampScore(patch.mood) : state.draft.mood,
            stress: patch.stress !== undefined ? clampScore(patch.stress) : state.draft.stress,
            sleepQuality: patch.sleepQuality !== undefined ? clampScore(patch.sleepQuality) : state.draft.sleepQuality,
          },
        }))
      },
      saveEntry: (userId, focus) => {
        const state = get()
        const now = new Date()
        const window = getOpenWindow(state.entries, now) ?? resolveCheckInWindow(now)
        const today = getTodayEntries(state.entries, now)
        const existing = today.find((entry) => resolveEntryWindow(entry) === window)
        if (existing) return existing

        const entry: SignalEntry = {
          id: createEntryId(),
          userId,
          createdAt: now.toISOString(),
          focus: focus ?? state.profile?.trackingFocus ?? 'energy',
          score: scoreDraft(state.draft),
          energy: state.draft.energy,
          mood: state.draft.mood,
          stress: state.draft.stress,
          sleepQuality: state.draft.sleepQuality,
          tags: state.draft.tags,
          window,
          dayKey: localDayKey(now),
        }

        set((current) => ({
          entries: [entry, ...current.entries.filter((item) => item.id !== entry.id)],
          savedAt: now.toISOString(),
          firstWinOpen: current.entries.length === 0,
        }))
        void saveSignalEntry(entry).then((saved) => {
          if (saved.id === entry.id) return
          set((current) => ({
            entries: mergeSignalEntryLists(current.entries.filter((item) => item.id !== entry.id), [saved]),
          }))
        })
        return entry
      },
      closeFirstWin: () => set({ firstWinOpen: false }),
      celebrateMilestone: (milestone) =>
        set((state) => ({ lastCelebratedMilestone: Math.max(state.lastCelebratedMilestone ?? 0, milestone) })),
      setReminder: (enabled, reminderTime, userId) => {
        const current = get().profile
        const nextProfile = current
          ? {
              ...current,
              reminderTime: reminderTime ?? current.reminderTime,
              reminderEnabled: enabled,
              reminderTimezone: current.reminderTimezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
            }
          : null
        set({
          reminderEnabled: enabled,
          profile: nextProfile,
        })
        const persistUserId = userId ?? get().entries[0]?.userId
        if (nextProfile && persistUserId) void saveSignalProfile(persistUserId, nextProfile)
      },
      clearLocalAccount: () => {
        set({
          profile: null,
          entries: [],
          savedAt: null,
          firstWinOpen: false,
          reminderEnabled: false,
          lastCelebratedMilestone: null,
          draft: {
            energy: 7,
            mood: 7,
            stress: 4,
            sleepQuality: 7,
            tags: ['calm'],
          },
        })
      },
    }),
    {
      name: 'pulse-signal-store-v1',
      partialize: (state) => ({
        profile: state.profile,
        entries: state.entries,
        savedAt: state.savedAt,
        reminderEnabled: state.reminderEnabled,
        lastCelebratedMilestone: state.lastCelebratedMilestone,
      }),
    },
  ),
)

export const TRACKING_OPTIONS: Array<{ id: TrackingFocus; label: string; description: string }> = [
  { id: 'energy', label: 'Energy', description: 'Know when you feel sharp or drained.' },
  { id: 'mood', label: 'Mood', description: 'Spot the moments that lift or lower you.' },
  { id: 'focus', label: 'Focus', description: 'Protect your clearest work windows.' },
  { id: 'sleep', label: 'Sleep', description: "Connect rest with tomorrow's state." },
]

export const GOAL_OPTIONS: Array<{ id: SignalGoal; label: string; description: string }> = [
  { id: 'more_energy', label: 'More steady energy', description: 'Find what makes good days repeatable.' },
  { id: 'less_stress', label: 'Less stress', description: 'Catch pressure early and recover faster.' },
  { id: 'better_sleep', label: 'Better sleep', description: 'See how nights shape your days.' },
  { id: 'deeper_focus', label: 'Deeper focus', description: 'Build reliable blocks of attention.' },
]
