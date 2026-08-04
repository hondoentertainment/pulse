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

/**
 * Fetch the user's COMPLETE signal history, paginating past the 60-row cap that
 * {@link fetchSignalEntries} applies for hydration. Used by data export, where
 * silently truncating "every check-in" would be wrong. Returns [] when Supabase
 * isn't configured (callers fall back to locally-stored entries).
 */
export async function fetchAllSignalEntries(userId: string): Promise<SignalEntry[]> {
  if (!hasSupabaseConfig) return []

  const pageSize = 1000
  const all: SignalEntry[] = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('signal_entries')
      .select('id,user_id,created_at,focus,score,energy,mood,stress,sleep_quality,tags')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1)

    if (error) {
      console.warn('Signal entries full fetch failed', error.message)
      throw new Error(error.message || 'Could not load full signal history')
    }

    const rows = (data ?? []) as SignalEntryRow[]
    all.push(...rows.map(fromRow))
    if (rows.length < pageSize) break
  }

  return all
}

interface SignalProfileRow {
  tracking_focus: TrackingFocus
  goal: SignalProfile['goal']
  reminder_time: string | null
  reminder_enabled: boolean | null
}

/**
 * Fetch the user's saved onboarding profile.
 *
 * Without this, a returning user on a new device (or after clearing storage)
 * has a null local profile, gets pushed back through onboarding, and overwrites
 * the focus/goal/reminder settings already stored server-side.
 *
 * Returns null when unconfigured or when no profile row exists yet.
 */
export async function fetchSignalProfile(userId: string): Promise<SignalProfile | null> {
  if (!hasSupabaseConfig) return null

  const { data, error } = await supabase
    .from('signal_profiles')
    .select('tracking_focus,goal,reminder_time,reminder_enabled')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.warn('Signal profile fetch failed', error.message)
    throw new Error(error.message || 'Could not load your profile')
  }
  if (!data) return null

  const row = data as SignalProfileRow
  return {
    trackingFocus: row.tracking_focus,
    goal: row.goal,
    reminderTime: row.reminder_time ?? undefined,
    reminderEnabled: row.reminder_enabled ?? false,
  }
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

/**
 * Permanently delete every Signal record for a user: check-ins, profile, and
 * any pilot-waitlist row. RLS restricts each delete to the caller's own rows,
 * so this cannot be used to erase someone else's data.
 *
 * Returns the number of tables cleared. No-ops when Supabase isn't configured
 * (local-only builds still wipe local state — see `clearLocalSignalData`).
 */
export async function deleteAllSignalData(userId: string): Promise<void> {
  if (!hasSupabaseConfig) return

  const entriesResult = await supabase.from('signal_entries').delete().eq('user_id', userId)
  if (entriesResult.error) {
    throw new Error(entriesResult.error.message || 'Could not delete your check-ins')
  }

  const profileResult = await supabase.from('signal_profiles').delete().eq('user_id', userId)
  if (profileResult.error) {
    throw new Error(profileResult.error.message || 'Could not delete your profile')
  }

  // Best-effort: the waitlist is a separate opt-in, and failing to clear it
  // must not leave the user believing their check-in data survived.
  const pilotResult = await supabase.from('signal_pilot_signups').delete().eq('user_id', userId)
  if (pilotResult.error) {
    console.warn('Pilot signup not removed', pilotResult.error.message)
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
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

  if (error) {
    console.warn('Signal profile saved locally but not synced', error.message)
  }
}
