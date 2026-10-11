/**
 * Signed-in “hide this pulse” — reuse pulse_reports with reason=hide.
 * Hidden rows leave that user’s Tonight.
 *
 * Admin hide (separate) stores a resolution note the post owner can read.
 * Undo is a short window (about 10 seconds) that clears the admin hide.
 */

export const HIDE_PULSE_REASON = 'hide'

export function isHiddenPulseReport(report: {
  reason?: string | null
  reporterId?: string
  reporter_id?: string
}): boolean {
  return (report.reason ?? '').toLowerCase() === HIDE_PULSE_REASON
}

export function hiddenPulseIdsForUser(
  reports: readonly { pulseId?: string; pulse_id?: string; reason?: string | null; reporterId?: string; reporter_id?: string }[],
  userId: string,
): Set<string> {
  const ids = new Set<string>()
  for (const report of reports) {
    const reporter = report.reporterId ?? report.reporter_id
    if (reporter !== userId) continue
    if (!isHiddenPulseReport(report)) continue
    const pulseId = report.pulseId ?? report.pulse_id
    if (pulseId) ids.add(pulseId)
  }
  return ids
}

export function filterHiddenPulses<T extends { id: string }>(
  pulses: readonly T[],
  hiddenIds: ReadonlySet<string>,
): T[] {
  if (hiddenIds.size === 0) return [...pulses]
  return pulses.filter((pulse) => !hiddenIds.has(pulse.id))
}

export const HIDE_UNDO_MS = 10_000
export const HIDE_NOTE_MAX = 280

export interface HideDecision {
  ok: true
  hiddenAt: string
  note: string | null
}

export interface HideRejection {
  ok: false
  message: string
}

export function hidePulseDecision(input: {
  admin: boolean
  note?: string | null
  now?: Date
}): HideDecision | HideRejection {
  if (!input.admin) return { ok: false, message: 'Admin role required to hide a post' }
  const note = (input.note ?? '').trim()
  if (note.length > HIDE_NOTE_MAX) {
    return { ok: false, message: `Note must be ${HIDE_NOTE_MAX} characters or fewer` }
  }
  return {
    ok: true,
    hiddenAt: (input.now ?? new Date()).toISOString(),
    note: note.length > 0 ? note : null,
  }
}

export function undoHideDecision(input: {
  admin: boolean
  hiddenAt?: string | null
  now?: Date
  windowMs?: number
}): { ok: true } | { ok: false; reason: 'forbidden' | 'not_hidden' | 'expired' } {
  if (!input.admin) return { ok: false, reason: 'forbidden' }
  if (!input.hiddenAt) return { ok: false, reason: 'not_hidden' }
  const hiddenMs = Date.parse(input.hiddenAt)
  if (!Number.isFinite(hiddenMs)) return { ok: false, reason: 'not_hidden' }
  const nowMs = (input.now ?? new Date()).getTime()
  const windowMs = input.windowMs ?? HIDE_UNDO_MS
  if (nowMs - hiddenMs > windowMs) return { ok: false, reason: 'expired' }
  return { ok: true }
}

export function ownerHiddenCopy(input: {
  hiddenAt?: string | null
  note?: string | null
}): { hidden: boolean; line: string; note: string | null } {
  if (!input.hiddenAt) return { hidden: false, line: '', note: null }
  const note = input.note?.trim() ? input.note.trim() : null
  return {
    hidden: true,
    line: 'Hidden from Live now · only you can see it',
    note,
  }
}

export interface OwnerHiddenPulse {
  id: string
  venueId: string
  caption: string
  energyRating: string
  createdAt: string
  hiddenAt: string
  note: string | null
}

export function mapOwnerHiddenRow(row: {
  id?: unknown
  venue_id?: unknown
  caption?: unknown
  energy_rating?: unknown
  created_at?: unknown
  hidden_at?: unknown
  hidden_note?: unknown
}): OwnerHiddenPulse | null {
  if (typeof row.id !== 'string' || typeof row.hidden_at !== 'string') return null
  return {
    id: row.id,
    venueId: typeof row.venue_id === 'string' ? row.venue_id : '',
    caption: typeof row.caption === 'string' ? row.caption : '',
    energyRating: typeof row.energy_rating === 'string' ? row.energy_rating : 'chill',
    createdAt: typeof row.created_at === 'string' ? row.created_at : row.hidden_at,
    hiddenAt: row.hidden_at,
    note: typeof row.hidden_note === 'string' && row.hidden_note.trim() ? row.hidden_note.trim() : null,
  }
}
