import { resolveEntryWindow, type SignalEntry } from '@/lib/signal-insights'
import { localDayKey } from '@/lib/signal-windows'

const CSV_HEADERS = [
  'day_key',
  'window',
  'score',
  'energy',
  'mood',
  'stress',
  'sleep_quality',
  'tags',
  'created_at',
] as const

function csvCell(value: string | number): string {
  const text = String(value)
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

export function entriesToCsv(entries: SignalEntry[]): string {
  const rows = [...entries]
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map((entry) => [
      entry.dayKey ?? localDayKey(new Date(entry.createdAt)),
      resolveEntryWindow(entry),
      entry.score,
      entry.energy,
      entry.mood,
      entry.stress,
      entry.sleepQuality,
      entry.tags.join('|'),
      entry.createdAt,
    ].map(csvCell).join(','))

  return [CSV_HEADERS.join(','), ...rows].join('\n')
}

export function signalExportFilename(now: Date = new Date()): string {
  return `pulse-signal-${localDayKey(now)}.csv`
}

export function downloadTextFile(
  filename: string,
  contents: string,
  mime = 'text/csv;charset=utf-8',
): void {
  if (typeof document === 'undefined') return
  const blob = new Blob([contents], { type: mime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
