/**
 * Signal data export.
 *
 * Lets a user download their full check-in history as CSV — table stakes for a
 * personal-data product (portability + trust) and a prerequisite for any
 * "own your data" positioning. Pure serialisation lives here so it can be
 * tested; the DOM download is a thin, guarded wrapper.
 */
import type { SignalEntry } from '@/lib/signal-insights'

const CSV_COLUMNS = [
  'date',
  'time',
  'focus',
  'score',
  'energy',
  'mood',
  'stress',
  'sleep_quality',
  'tags',
] as const

/** RFC-4180-ish field escaping: quote when the value contains a comma, quote or newline. */
function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

const pad2 = (n: number): string => String(n).padStart(2, '0')

/**
 * Local `YYYY-MM-DD` / `HH:MM` for a check-in. The app treats entries as local
 * daily records everywhere else (History renders with `toLocaleDateString`), so
 * the export must use the viewer's timezone too — otherwise an evening check-in
 * west of UTC exports under the following day.
 */
function localDate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function localTime(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

/**
 * Serialise entries to a CSV string (newest first). Tags are joined with a
 * space inside a single quoted column so the row width stays fixed.
 */
export function toSignalCsv(entries: SignalEntry[]): string {
  const header = CSV_COLUMNS.join(',')
  const sorted = [...entries].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )

  const rows = sorted.map((entry) => {
    const date = new Date(entry.createdAt)
    const fields = [
      localDate(date),
      localTime(date),
      entry.focus,
      String(entry.score),
      String(entry.energy),
      String(entry.mood),
      String(entry.stress),
      String(entry.sleepQuality),
      entry.tags.join(' '),
    ]
    return fields.map(escapeCsvField).join(',')
  })

  return [header, ...rows].join('\n')
}

/** Deterministic, date-stamped filename, e.g. `pulse-signal-2026-07-05.csv`. */
export function buildExportFilename(now: Date = new Date()): string {
  return `pulse-signal-${now.toISOString().slice(0, 10)}.csv`
}

/**
 * Trigger a browser download of the CSV. No-op (returns false) in non-DOM
 * environments so it's safe to call from anywhere. Returns true when a
 * download was initiated.
 */
export function downloadSignalCsv(entries: SignalEntry[], now: Date = new Date()): boolean {
  if (typeof document === 'undefined' || typeof URL === 'undefined' || typeof Blob === 'undefined') {
    return false
  }

  const csv = toSignalCsv(entries)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = buildExportFilename(now)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
  return true
}
