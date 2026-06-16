import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { saveSignalEntry, saveSignalProfile } from '@/lib/signal-data'
import { computeDraftScore } from '@/lib/signal-score'
import type { SignalEntry, SignalGoal, SignalProfile, TrackingFocus } from '@/lib/signal-insights'

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
  setProfile: (userId: string, profile: SignalProfile) => void
  mergeRemoteEntries: (entries: SignalEntry[]) => void
  updateDraft: (patch: Partial<DraftSignal>) => void
  saveEntry: (userId: string, focus?: TrackingFocus) => SignalEntry
  closeFirstWin: () => void
  setReminder: (enabled: boolean, reminderTime?: string) => void
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
      setProfile: (userId, profile) => {
        set({ profile })
        void saveSignalProfile(userId, profile)
      },
      mergeRemoteEntries: (remoteEntries) => {
        if (remoteEntries.length === 0) return
        set((state) => {
          const byId = new Map([...state.entries, ...remoteEntries].map((entry) => [entry.id, entry]))
          return {
            entries: Array.from(byId.values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
          }
        })
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
        const entry: SignalEntry = {
          id: createEntryId(),
          userId,
          createdAt: new Date().toISOString(),
          focus: focus ?? state.profile?.trackingFocus ?? 'energy',
          score: scoreDraft(state.draft),
          energy: state.draft.energy,
          mood: state.draft.mood,
          stress: state.draft.stress,
          sleepQuality: state.draft.sleepQuality,
          tags: state.draft.tags,
        }

        set((current) => ({
          entries: [entry, ...current.entries.filter((existing) => existing.id !== entry.id)],
          savedAt: new Date().toISOString(),
          firstWinOpen: current.entries.length === 0,
        }))
        void saveSignalEntry(entry)
        return entry
      },
      closeFirstWin: () => set({ firstWinOpen: false }),
      setReminder: (enabled, reminderTime) => {
        const nextProfile = get().profile
          ? { ...get().profile!, reminderTime: reminderTime ?? get().profile!.reminderTime }
          : null
        set({
          reminderEnabled: enabled,
          profile: nextProfile,
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
