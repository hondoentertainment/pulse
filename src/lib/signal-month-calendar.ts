import type { SignalEntry } from '@/lib/signal-insights'
import { scoreBucket, scoreBucketColor } from '@/lib/signal-score'
import { localDayKey, parseDayKey, shiftDayKey } from '@/lib/signal-windows'

export interface CalendarDayCell {
  dayKey: string
  dayOfMonth: number
  inMonth: boolean
  score: number | null
  color: string | null
}

export interface MonthCalendar {
  year: number
  monthIndex: number
  label: string
  /** Sunday-first grid covering the visible month. */
  cells: CalendarDayCell[]
}

const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const

const entryDayKey = (entry: SignalEntry): string => entry.dayKey ?? localDayKey(new Date(entry.createdAt))

/** Mean score for a calendar day, or null when nothing was logged. */
export function dayAverageScore(entries: SignalEntry[], dayKey: string): number | null {
  const dayEntries = entries.filter((entry) => entryDayKey(entry) === dayKey)
  if (dayEntries.length === 0) return null
  return Math.round(dayEntries.reduce((sum, entry) => sum + entry.score, 0) / dayEntries.length)
}

export function buildMonthCalendar(
  entries: SignalEntry[],
  year: number,
  monthIndex: number,
): MonthCalendar {
  const monthStart = new Date(year, monthIndex, 1, 12, 0, 0, 0)
  const monthStartKey = localDayKey(monthStart)
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const startWeekday = monthStart.getDay() // 0 = Sunday

  const gridStart = shiftDayKey(monthStartKey, -startWeekday)
  const cells: CalendarDayCell[] = []

  for (let offset = 0; offset < 42; offset += 1) {
    const dayKey = shiftDayKey(gridStart, offset)
    const date = parseDayKey(dayKey)
    const inMonth = date.getMonth() === monthIndex && date.getFullYear() === year
    const score = inMonth ? dayAverageScore(entries, dayKey) : null
    cells.push({
      dayKey,
      dayOfMonth: date.getDate(),
      inMonth,
      score,
      color: score === null ? null : scoreBucketColor(scoreBucket(score)),
    })
    if (inMonth && date.getDate() === daysInMonth && (startWeekday + daysInMonth) <= 35 && offset >= 34) {
      break
    }
  }

  // Trim trailing empty week if the month fits in 5 rows.
  while (cells.length > 35 && cells.slice(-7).every((cell) => !cell.inMonth)) {
    cells.splice(-7, 7)
  }

  return {
    year,
    monthIndex,
    label: `${MONTH_LABELS[monthIndex]} ${year}`,
    cells,
  }
}
