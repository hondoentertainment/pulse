import { hasSupabaseConfig, supabase } from '@/lib/supabase'
import type { SignalEntry, SignalProfile, TrackingFocus } from '@/lib/signal-insights'
import { localDayKey, resolveCheckInWindow, type CheckInWindow } from '@/lib/signal-windows'

interface SignalEntryRow {
  id: string
  user_id: string
  created_at: string
  focus: TrackingFocus
  score: number
  energy: number
  mood: number
  stress: number
  sleep_quality: number
  tags: string[] | null
  check_in_window?: CheckInWindow | null
  day_key?: string | null
}

const fromRow = (row: SignalEntryRow): SignalEntry => ({
  id: row.id,
  userId: row.user_id,
  createdAt: row.created_at,
  focus: row.focus,
  score: row.score,
  energy: row.energy,
  mood: row.mood,
  stress: row.stress,
  sleepQuality: row.sleep_quality,
  tags: row.tags ?? [],
  window: row.check_in_window ?? resolveCheckInWindow(new Date(row.created_at)),
  dayKey: row.day_key ?? localDayKey(new Date(row.created_at)),
})

const toRow = (entry: SignalEntry): SignalEntryRow => ({
  id: entry.id,
  user_id: entry.userId,
  created_at: entry.createdAt,
  focus: entry.focus,
  score: entry.score,
  energy: entry.energy,
  mood: entry.mood,
  stress: entry.stress,
  sleep_quality: entry.sleepQuality,
  tags: entry.tags,
  check_in_window: entry.window ?? resolveCheckInWindow(new Date(entry.createdAt)),
  day_key: entry.dayKey ?? localDayKey(new Date(entry.createdAt)),
})

export async function fetchSignalEntries(userId: string): Promise<SignalEntry[]> {
  if (!hasSupabaseConfig) return []

  const { data, error } = await supabase
    .from('signal_entries')
    .select('id,user_id,created_at,focus,score,energy,mood,stress,sleep_quality,tags,check_in_window,day_key')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(180)

  if (error) {
    console.warn('Signal entries fetch failed', error.message)
    throw new Error(error.message || 'Could not load signal history')
  }

  return ((data ?? []) as SignalEntryRow[]).map(fromRow)
}

export async function saveSignalEntry(entry: SignalEntry): Promise<void> {
  if (!hasSupabaseConfig) return

  const { error } = await supabase
    .from('signal_entries')
    .upsert(toRow(entry), { onConflict: 'id' })

  if (error) {
    console.warn('Signal entry saved locally but not synced', error.message)
  }
}

export async function saveSignalProfile(userId: string, profile: SignalProfile): Promise<void> {
  if (!hasSupabaseConfig) return

  const { error } = await supabase
    .from('signal_profiles')
    .upsert({
      user_id: userId,
      tracking_focus: profile.trackingFocus,
      goal: profile.goal,
      reminder_time: profile.reminderTime ?? null,
      reminder_enabled: profile.reminderEnabled ?? false,
      reminder_timezone: profile.reminderTimezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

  if (error) {
    console.warn('Signal profile saved locally but not synced', error.message)
  }
}
