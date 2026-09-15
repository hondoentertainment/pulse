/**
 * Open now — chip only when a hours value already exists on the venue row.
 * If hours are missing, omit. Never invent or scrape hours.
 */

import type { Venue } from './types'

export const OPEN_NOW_LABEL = 'Open now'
export const OPEN_NOW_TZ = 'America/Los_Angeles'

const WEEKDAYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const

export function venueHasHours(venue: Pick<Venue, 'hours'> | null | undefined): boolean {
  const hours = venue?.hours
  if (!hours || typeof hours !== 'object') return false
  return Object.values(hours).some((value) => typeof value === 'string' && value.trim().length > 0)
}

function minutesFromMidnight(raw: string): number | null {
  const match = raw.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i)
  if (!match) return null
  let hour = Number(match[1])
  const minute = Number(match[2] ?? '0')
  const mer = match[3].toUpperCase()
  if (!Number.isFinite(hour) || hour < 1 || hour > 12 || minute > 59) return null
  if (mer === 'AM') hour = hour === 12 ? 0 : hour
  else hour = hour === 12 ? 12 : hour + 12
  return hour * 60 + minute
}

function parseHoursRange(value: string): { open: number; close: number; overnight: boolean } | null {
  const trimmed = value.trim()
  if (!trimmed || /^closed$/i.test(trimmed)) return null
  const parts = trimmed.split(/\s*-\s*/)
  if (parts.length !== 2) return null
  const open = minutesFromMidnight(parts[0] ?? '')
  const close = minutesFromMidnight(parts[1] ?? '')
  if (open === null || close === null) return null
  return { open, close, overnight: close <= open }
}

function seattleClock(now: Date): { weekday: (typeof WEEKDAYS)[number]; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: OPEN_NOW_TZ,
    weekday: 'long',
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now)
  const weekdayRaw = (parts.find((part) => part.type === 'weekday')?.value ?? '').toLowerCase()
  const weekday = WEEKDAYS.find((day) => day === weekdayRaw) ?? 'sunday'
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0')
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? '0')
  return { weekday, minutes: (hour % 24) * 60 + minute }
}

/** True only when today’s hours exist and parse as currently open. Never guess. */
export function isOpenNow(
  venue: Pick<Venue, 'hours'> | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!venueHasHours(venue)) return false
  const { weekday, minutes } = seattleClock(now)
  const today = venue?.hours?.[weekday]
  if (typeof today !== 'string' || !today.trim()) return false
  const range = parseHoursRange(today)
  if (!range) return false
  if (range.overnight) {
    return minutes >= range.open || minutes < range.close
  }
  return minutes >= range.open && minutes < range.close
}

/** Chip label, or null when hours are missing / closed / unparseable. */
export function openNowChip(
  venue: Pick<Venue, 'hours'> | null | undefined,
  now: Date = new Date(),
): string | null {
  return isOpenNow(venue, now) ? OPEN_NOW_LABEL : null
}
