import { resolveEntryWindow, type CheckInWindow, type SignalEntry, type TrackingFocus } from '@/lib/signal-insights'
import { isValidDayKey, localDayKey } from '@/lib/signal-windows'

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

/** Split a CSV line into cells, respecting double-quoted fields. */
export function splitCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        current += char
      }
      continue
    }
    if (char === '"') {
      inQuotes = true
      continue
    }
    if (char === ',') {
      cells.push(current)
      current = ''
      continue
    }
    current += char
  }
  cells.push(current)
  return cells
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

export function signalJsonExportFilename(now: Date = new Date()): string {
  return `pulse-signal-${localDayKey(now)}.json`
}

export function entriesToJson(entries: SignalEntry[]): string {
  const payload = [...entries]
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map((entry) => ({
      day_key: entry.dayKey ?? localDayKey(new Date(entry.createdAt)),
      window: resolveEntryWindow(entry),
      score: entry.score,
      energy: entry.energy,
      mood: entry.mood,
      stress: entry.stress,
      sleep_quality: entry.sleepQuality,
      tags: entry.tags,
      created_at: entry.createdAt,
    }))
  return `${JSON.stringify(payload, null, 2)}\n`
}

const clampMetric = (value: number) => Math.max(1, Math.min(10, Math.round(value)))
const clampScore = (value: number) => Math.max(1, Math.min(100, Math.round(value)))

function parseWindow(value: string): CheckInWindow | null {
  if (value === 'morning' || value === 'evening') return value
  return null
}

function parseTags(value: string): string[] {
  return value
    .split('|')
    .map((tag) => tag.trim())
    .filter(Boolean)
}

export interface CsvImportResult {
  entries: SignalEntry[]
  imported: number
  skipped: number
}

export function entriesFromCsv(
  csv: string,
  input: { userId: string; focus?: TrackingFocus },
): CsvImportResult {
  const lines = csv
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length === 0) return { entries: [], imported: 0, skipped: 0 }

  const headerCells = splitCsvLine(lines[0]).map((cell) => cell.trim().toLowerCase())
  const expected = CSV_HEADERS.join(',')
  if (headerCells.join(',') !== expected) {
    return { entries: [], imported: 0, skipped: Math.max(0, lines.length - 1) }
  }

  const focus = input.focus ?? 'energy'
  const entries: SignalEntry[] = []
  let skipped = 0

  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line)
    if (cells.length < CSV_HEADERS.length) {
      skipped += 1
      continue
    }

    const [
      dayKeyRaw,
      windowRaw,
      scoreRaw,
      energyRaw,
      moodRaw,
      stressRaw,
      sleepRaw,
      tagsRaw,
      createdAtRaw,
    ] = cells

    const dayKey = dayKeyRaw.trim()
    const window = parseWindow(windowRaw.trim())
    const score = Number(scoreRaw)
    const energy = Number(energyRaw)
    const mood = Number(moodRaw)
    const stress = Number(stressRaw)
    const sleepQuality = Number(sleepRaw)
    const createdAt = createdAtRaw.trim()

    if (!isValidDayKey(dayKey) || !window) {
      skipped += 1
      continue
    }
    if (![score, energy, mood, stress, sleepQuality].every((value) => Number.isFinite(value))) {
      skipped += 1
      continue
    }
    if (!createdAt || Number.isNaN(new Date(createdAt).getTime())) {
      skipped += 1
      continue
    }

    entries.push({
      id: `import_${dayKey}_${window}_${entries.length}`,
      userId: input.userId,
      createdAt,
      focus,
      score: clampScore(score),
      energy: clampMetric(energy),
      mood: clampMetric(mood),
      stress: clampMetric(stress),
      sleepQuality: clampMetric(sleepQuality),
      tags: parseTags(tagsRaw),
      window,
      dayKey,
    })
  }

  return { entries, imported: entries.length, skipped }
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
