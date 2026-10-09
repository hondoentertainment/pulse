/**
 * Heading persistence. A local copy keeps the sheet working without Supabase.
 * When venue_headings exists, the same record is written there so a friend
 * opening ?hop=1 on another device can read the name.
 */

import {
  buildHeadingRecord,
  headingById,
  isHeadingActive,
  pickActiveHeading,
  type HeadingRecord,
} from './heading-there'

const STORAGE_KEY = 'pulse_heading_there_v1'

function readAll(): HeadingRecord[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((row): row is HeadingRecord => {
      if (!row || typeof row !== 'object') return false
      const record = row as HeadingRecord
      return typeof record.userId === 'string'
        && typeof record.venueId === 'string'
        && typeof record.displayName === 'string'
        && typeof record.createdAt === 'string'
    })
  } catch {
    return []
  }
}

function writeAll(records: HeadingRecord[]): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(-40)))
  } catch {
    /* private mode */
  }
}

export function readLocalHeading(venueId: string, nowMs: number = Date.now()): HeadingRecord | null {
  return pickActiveHeading(readAll(), venueId, nowMs)
}

export function readLocalHeadingById(
  venueId: string,
  headingId: string,
  nowMs: number = Date.now(),
): HeadingRecord | null {
  return headingById(readAll(), venueId, headingId, nowMs)
}

export function saveLocalHeading(record: HeadingRecord): HeadingRecord {
  const next = readAll().filter((row) => !(row.userId === record.userId && row.venueId === record.venueId && !row.cancelledAt))
  next.push(record)
  writeAll(next)
  return record
}

export function cancelLocalHeading(userId: string, venueId: string, nowIso: string = new Date().toISOString()): void {
  const next = readAll().map((row) => (
    row.userId === userId && row.venueId === venueId && !row.cancelledAt
      ? { ...row, cancelledAt: nowIso }
      : row
  ))
  writeAll(next)
}

async function db() {
  try {
    const mod = await import('./supabase')
    if (!mod.hasSupabaseConfig) return null
    return mod.supabase
  } catch {
    return null
  }
}

export async function saveHeading(input: {
  userId: string
  venueId: string
  displayName: string
  now?: Date
}): Promise<HeadingRecord> {
  const record = buildHeadingRecord(input)
  saveLocalHeading(record)
  const client = await db()
  if (!client) return record
  try {
    await client
      .from('venue_headings')
      .update({ cancelled_at: record.createdAt })
      .eq('user_id', input.userId)
      .eq('venue_id', input.venueId)
      .is('cancelled_at', null)
    const { error } = await client.from('venue_headings').insert({
      id: record.id,
      user_id: record.userId,
      venue_id: record.venueId,
      display_name: record.displayName,
      created_at: record.createdAt,
    })
    if (error) console.warn('[heading] save skipped', error.message)
  } catch (err) {
    console.warn('[heading] save skipped', err)
  }
  return record
}

export async function cancelHeading(userId: string, venueId: string): Promise<void> {
  const nowIso = new Date().toISOString()
  cancelLocalHeading(userId, venueId, nowIso)
  const client = await db()
  if (!client) return
  try {
    await client
      .from('venue_headings')
      .update({ cancelled_at: nowIso })
      .eq('user_id', userId)
      .eq('venue_id', venueId)
      .is('cancelled_at', null)
  } catch (err) {
    console.warn('[heading] cancel skipped', err)
  }
}

function mapHeadingRow(row: {
  id?: unknown
  user_id?: unknown
  display_name?: unknown
  created_at?: unknown
}, venueId: string, nowMs: number): HeadingRecord | null {
  if (typeof row.user_id !== 'string' || typeof row.display_name !== 'string' || typeof row.created_at !== 'string') {
    return null
  }
  const record: HeadingRecord = {
    id: typeof row.id === 'string' ? row.id : undefined,
    userId: row.user_id,
    venueId,
    displayName: row.display_name,
    createdAt: row.created_at,
  }
  return isHeadingActive(record, nowMs) ? record : null
}

/** The heading named in this hop link. A different person's newer row is not a substitute. */
export async function loadHeadingById(
  venueId: string,
  headingId: string,
  nowMs: number = Date.now(),
): Promise<HeadingRecord | null> {
  const local = readLocalHeadingById(venueId, headingId, nowMs)
  const client = await db()
  if (!client) return local
  try {
    const { data, error } = await client
      .from('venue_headings')
      .select('id, user_id, display_name, created_at')
      .eq('id', headingId)
      .eq('venue_id', venueId)
      .is('cancelled_at', null)
      .maybeSingle()
    if (error || !data) return local
    return mapHeadingRow(data, venueId, nowMs) ?? local
  } catch {
    return local
  }
}

export async function loadOwnHeading(
  userId: string,
  venueId: string,
  nowMs: number = Date.now(),
): Promise<HeadingRecord | null> {
  const local = readAll().find((row) =>
    row.userId === userId && row.venueId === venueId && isHeadingActive(row, nowMs),
  ) ?? null
  const client = await db()
  if (!client) return local
  try {
    const { data, error } = await client
      .from('venue_headings')
      .select('id, user_id, display_name, created_at')
      .eq('user_id', userId)
      .eq('venue_id', venueId)
      .is('cancelled_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error || !data) return local
    return mapHeadingRow(data, venueId, nowMs) ?? local
  } catch {
    return local
  }
}
