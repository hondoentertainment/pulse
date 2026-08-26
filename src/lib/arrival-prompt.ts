/**
 * Post-Go arrival window and mismatch loop (P0-9 / RPT-05/06).
 *
 * After a user taps Go we open a confirmation window. One tap confirms the
 * signal or reports a mismatch. Volume of taps is not a score — the event
 * itself is the product signal.
 */

export const ARRIVAL_WINDOW_MS = 45 * 60 * 1000
export const ARRIVAL_PROMPT_MIN_ELAPSED_MS = 4 * 60 * 1000

export type ArrivalPromptStatus = 'pending' | 'ready' | 'confirmed' | 'mismatch' | 'expired'
export type ArrivalCorrection =
  | 'quieter'
  | 'busier'
  | 'longer_line'
  | 'shorter_line'
  | 'closed'
  | 'other'

export interface ArrivalWatch {
  id: string
  venueId: string
  venueName: string
  startedAt: string
  windowMs: number
  status: ArrivalPromptStatus
  correction?: ArrivalCorrection
  resolvedAt?: string
}

const watches = new Map<string, ArrivalWatch>()

function createId(): string {
  return `arrival-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function startArrivalWatch(
  venueId: string,
  venueName: string,
  now: Date = new Date(),
  windowMs: number = ARRIVAL_WINDOW_MS,
): ArrivalWatch {
  const watch: ArrivalWatch = {
    id: createId(),
    venueId,
    venueName,
    startedAt: now.toISOString(),
    windowMs,
    status: 'pending',
  }
  watches.set(watch.id, watch)
  return watch
}

export function getArrivalWatchStatus(watch: ArrivalWatch, now: Date = new Date()): ArrivalPromptStatus {
  if (watch.status === 'confirmed' || watch.status === 'mismatch') return watch.status
  const elapsed = now.getTime() - new Date(watch.startedAt).getTime()
  if (elapsed > watch.windowMs) return 'expired'
  if (elapsed >= ARRIVAL_PROMPT_MIN_ELAPSED_MS) return 'ready'
  return 'pending'
}

export function shouldShowArrivalPrompt(watch: ArrivalWatch, now: Date = new Date()): boolean {
  return getArrivalWatchStatus(watch, now) === 'ready'
}

export function confirmArrival(watchId: string, now: Date = new Date()): ArrivalWatch | null {
  const watch = watches.get(watchId)
  if (!watch) return null
  const next = { ...watch, status: 'confirmed' as const, resolvedAt: now.toISOString() }
  watches.set(watchId, next)
  return next
}

export function reportArrivalMismatch(
  watchId: string,
  correction: ArrivalCorrection,
  now: Date = new Date(),
): ArrivalWatch | null {
  const watch = watches.get(watchId)
  if (!watch) return null
  const next = {
    ...watch,
    status: 'mismatch' as const,
    correction,
    resolvedAt: now.toISOString(),
  }
  watches.set(watchId, next)
  return next
}

export function listArrivalWatches(): ArrivalWatch[] {
  return [...watches.values()]
}

export function getActiveArrivalWatch(venueId?: string): ArrivalWatch | undefined {
  return [...watches.values()].find((watch) => {
    if (watch.status === 'confirmed' || watch.status === 'mismatch') return false
    if (venueId && watch.venueId !== venueId) return false
    return getArrivalWatchStatus(watch) !== 'expired'
  })
}

export function clearArrivalWatches(): void {
  watches.clear()
}
