import { hasSupabaseConfig, supabase } from '@/lib/supabase'
import { resolveEntryWindow, type SignalEntry, type SignalProfile, type TrackingFocus } from '@/lib/signal-insights'
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

const ENTRY_COLUMNS = 'id,user_id,created_at,focus,score,energy,mood,stress,sleep_quality,tags,check_in_window,day_key'

export function signalEntryWindowKey(entry: SignalEntry): string {
  const dayKey = entry.dayKey ?? localDayKey(new Date(entry.createdAt))
  return `${entry.userId}:${dayKey}:${resolveEntryWindow(entry)}`
}

/** Collapse local + remote rows that share (user, day, window) onto one id. */
export function mergeSignalEntryLists(local: SignalEntry[], remote: SignalEntry[]): SignalEntry[] {
  const merged = new Map<string, SignalEntry>()
  for (const entry of [...local, ...remote]) {
    merged.set(signalEntryWindowKey(entry), entry)
  }
  return Array.from(merged.values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export async function fetchSignalEntries(userId: string): Promise<SignalEntry[]> {
  if (!hasSupabaseConfig) return []

  const { data, error } = await supabase
    .from('signal_entries')
    .select(ENTRY_COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(180)

  if (error) {
    console.warn('Signal entries fetch failed', error.message)
    throw new Error(error.message || 'Could not load signal history')
  }

  return ((data ?? []) as SignalEntryRow[]).map(fromRow)
}

async function findEntryByWindow(row: SignalEntryRow): Promise<SignalEntryRow | null> {
  const { data, error } = await supabase
    .from('signal_entries')
    .select(ENTRY_COLUMNS)
    .eq('user_id', row.user_id)
    .eq('day_key', row.day_key)
    .eq('check_in_window', row.check_in_window)
    .maybeSingle()

  if (error) {
    console.warn('Signal entry lookup failed', error.message)
    return null
  }
  return (data as SignalEntryRow | null) ?? null
}

async function updateExistingEntry(id: string, row: SignalEntryRow): Promise<SignalEntry | null> {
  const { data, error } = await supabase
    .from('signal_entries')
    .update({
      focus: row.focus,
      score: row.score,
      energy: row.energy,
      mood: row.mood,
      stress: row.stress,
      sleep_quality: row.sleep_quality,
      tags: row.tags,
    })
    .eq('id', id)
    .select(ENTRY_COLUMNS)
    .single()

  if (error || !data) {
    console.warn('Signal entry saved locally but not synced', error?.message)
    return null
  }
  return fromRow(data as SignalEntryRow)
}

export async function saveSignalEntry(entry: SignalEntry): Promise<SignalEntry> {
  if (!hasSupabaseConfig) return entry

  const row = toRow(entry)
  const existing = await findEntryByWindow(row)
  if (existing?.id) {
    return (await updateExistingEntry(existing.id, row)) ?? fromRow(existing)
  }

  const { data, error } = await supabase
    .from('signal_entries')
    .insert(row)
    .select(ENTRY_COLUMNS)
    .single()

  if (!error && data) return fromRow(data as SignalEntryRow)

  if (error?.code === '23505') {
    const raced = await findEntryByWindow(row)
    if (raced?.id) return (await updateExistingEntry(raced.id, row)) ?? fromRow(raced)
  }

  if (error) {
    console.warn('Signal entry saved locally but not synced', error.message)
  }
  return entry
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
