import { hasSupabaseConfig, supabase } from '@/lib/supabase'
import type { SignalEntry, SignalProfile, TrackingFocus } from '@/lib/signal-insights'

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
})

export async function fetchSignalEntries(userId: string): Promise<SignalEntry[]> {
  if (!hasSupabaseConfig) return []

  const { data, error } = await supabase
    .from('signal_entries')
    .select('id,user_id,created_at,focus,score,energy,mood,stress,sleep_quality,tags')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(60)

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
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

  if (error) {
    console.warn('Signal profile saved locally but not synced', error.message)
  }
}
