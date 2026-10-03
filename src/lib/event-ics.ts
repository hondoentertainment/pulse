/**
 * Add to calendar — events-tonight row → download .ics.
 * Empty events stay empty. No Ticketmaster. No fake events.
 */

import type { CatalogEvent } from './events-tonight'

export const ADD_TO_CALENDAR_CTA = 'Add to calendar'

function icsEscape(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

function icsStamp(iso: string | null, date: string | null): string | null {
  if (iso) {
    const start = new Date(iso)
    if (Number.isFinite(start.getTime())) {
      return start.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
    }
  }
  if (date && /^\d{4}-\d{2}-\d{2}/.test(date)) {
    return `${date.slice(0, 10).replace(/-/g, '')}T210000Z`
  }
  return null
}

export function buildEventIcs(
  event: CatalogEvent,
  venueName?: string | null,
): string | null {
  const title = event.title.trim()
  if (!title) return null
  const dtstart = icsStamp(event.startsAt, event.date)
  if (!dtstart) return null
  const uid = `${event.id}@pulse`
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Pulse//Events tonight//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtstart}`,
    `DTSTART:${dtstart}`,
    `SUMMARY:${icsEscape(title)}`,
  ]
  if (venueName?.trim()) {
    lines.push(`LOCATION:${icsEscape(venueName.trim())}`)
  }
  lines.push('END:VEVENT', 'END:VCALENDAR')
  return `${lines.join('\r\n')}\r\n`
}

export function eventIcsFilename(event: CatalogEvent): string {
  const slug = event.title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return `${slug || 'pulse-event'}.ics`
}

export function downloadEventIcs(
  event: CatalogEvent,
  venueName?: string | null,
  createObjectUrl: (blob: Blob) => string = (blob) => URL.createObjectURL(blob),
): boolean {
  const body = buildEventIcs(event, venueName)
  if (!body || typeof document === 'undefined') return false
  const blob = new Blob([body], { type: 'text/calendar;charset=utf-8' })
  const href = createObjectUrl(blob)
  const a = document.createElement('a')
  a.href = href
  a.download = eventIcsFilename(event)
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  return true
}
