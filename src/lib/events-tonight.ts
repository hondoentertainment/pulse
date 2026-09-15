/**
 * Events tonight — overlay from the existing `events` table only.
 * Empty = honest empty + Start here catalog. Zero fake rows. Zero external APIs.
 */

import type { Venue } from './types'
import { listEmptySurgingStartHere } from './empty-surging'
import { localDateKey } from './tonight-digest'

export const EVENTS_TONIGHT_EMPTY = 'No events in Pulse tonight.'
export const EVENTS_TONIGHT_EMPTY_BODY =
  'We only show rows already in the events table. Start at a real Seattle room.'

export interface CatalogEvent {
  id: string
  venueId: string
  title: string
  startsAt: string | null
  date: string | null
}

export function eventIsTonight(
  event: CatalogEvent,
  now: Date = new Date(),
  timeZone = 'America/Los_Angeles',
): boolean {
  const today = localDateKey(now, timeZone)
  if (event.date && event.date.slice(0, 10) === today) return true
  if (event.startsAt) {
    const start = new Date(event.startsAt)
    if (Number.isFinite(start.getTime()) && localDateKey(start, timeZone) === today) return true
  }
  return false
}

export function listEventsTonight(
  events: readonly CatalogEvent[],
  now: Date = new Date(),
): CatalogEvent[] {
  return events.filter((event) => eventIsTonight(event, now))
}

export function mapEventRow(row: {
  id: string
  venue_id?: string
  venueId?: string
  title?: string | null
  starts_at?: string | null
  startsAt?: string | null
  date?: string | null
}): CatalogEvent | null {
  const venueId = row.venue_id ?? row.venueId
  const title = (row.title ?? '').trim()
  if (!row.id || !venueId || !title) return null
  return {
    id: row.id,
    venueId,
    title,
    startsAt: row.starts_at ?? row.startsAt ?? null,
    date: typeof row.date === 'string' ? row.date : null,
  }
}

export function eventsTonightEmptyStartHere(venues: readonly Venue[]): Venue[] {
  return listEmptySurgingStartHere(venues)
}
