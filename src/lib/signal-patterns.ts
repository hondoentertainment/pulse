import { compareMorningEvening, getSevenDayAverage, getStreakCount, resolveEntryWindow, type SignalEntry } from '@/lib/signal-insights'
import { localDayKey } from '@/lib/signal-windows'

export interface WeeklySummary {
  weekStart: string
  weekEnd: string
  checkInCount: number
  averageScore: number | null
  streakCount: number
  morningAvg: number | null
  eveningAvg: number | null
  topTags: string[]
  highlight: string
}

export interface TagPattern {
  tag: string
  count: number
  averageScore: number
  vsOverall: number
}

function startOfLocalDay(date: Date): Date {
  const cursor = new Date(date)
  cursor.setHours(0, 0, 0, 0)
  return cursor
}

export function entriesInLastSevenDays(entries: SignalEntry[], now: Date = new Date()): SignalEntry[] {
  const sinceKey = localDayKey(startOfLocalDay(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000)))
  return entries.filter((entry) => {
    const key = entry.dayKey ?? localDayKey(new Date(entry.createdAt))
    return key >= sinceKey
  })
}

export function buildWeeklySummary(entries: SignalEntry[], now: Date = new Date()): WeeklySummary {
  const week = entriesInLastSevenDays(entries, now)
  const weekEnd = localDayKey(now)
  const weekStart = localDayKey(startOfLocalDay(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000)))
  const averageScore = week.length === 0 ? null : getSevenDayAverage(week, now)
  const amPm = compareMorningEvening(week)
  const counts = new Map<string, number>()
  for (const entry of week) {
    for (const tag of entry.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
  }
  const topTags = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([tag]) => tag)

  return {
    weekStart,
    weekEnd,
    checkInCount: week.length,
    averageScore,
    streakCount: getStreakCount(entries, now),
    morningAvg: amPm.morning,
    eveningAvg: amPm.evening,
    topTags,
    highlight: weeklyHighlight(week, averageScore, amPm.delta),
  }
}

function weeklyHighlight(
  week: SignalEntry[],
  averageScore: number | null,
  delta: number | null,
): string {
  if (week.length === 0) {
    return 'Log a few days to unlock your weekly summary.'
  }
  if (week.length === 1) {
    return 'One check-in this week. A second window will start the comparison.'
  }
  if (delta !== null && Math.abs(delta) >= 6) {
    return delta > 0
      ? 'Evenings recovered more than mornings this week.'
      : 'Mornings landed stronger than evenings this week.'
  }
  if (averageScore !== null && averageScore >= 75) {
    return 'Your week stayed in a strong range. Repeat the conditions that held.'
  }
  if (averageScore !== null && averageScore <= 45) {
    return 'This week ran low. Pick one recovery action and compare the next two days.'
  }
  return 'Your week is forming a baseline. Keep both windows when you can.'
}

export function analyzeTagPatterns(entries: SignalEntry[]): TagPattern[] {
  if (entries.length === 0) return []
  const overall = entries.reduce((sum, entry) => sum + entry.score, 0) / entries.length
  const buckets = new Map<string, { total: number; count: number }>()

  for (const entry of entries) {
    const unique = new Set(entry.tags.map((tag) => tag.trim()).filter(Boolean))
    for (const tag of unique) {
      const current = buckets.get(tag) ?? { total: 0, count: 0 }
      current.total += entry.score
      current.count += 1
      buckets.set(tag, current)
    }
  }

  return [...buckets.entries()]
    .map(([tag, bucket]) => {
      const averageScore = Math.round(bucket.total / bucket.count)
      return {
        tag,
        count: bucket.count,
        averageScore,
        vsOverall: averageScore - Math.round(overall),
      }
    })
    .sort((a, b) => Math.abs(b.vsOverall) - Math.abs(a.vsOverall) || b.vsOverall - a.vsOverall || b.count - a.count || a.tag.localeCompare(b.tag))
}

export function tagPatternCopy(pattern: TagPattern): string {
  if (pattern.vsOverall >= 4) {
    return `${pattern.tag} days average ${pattern.averageScore}, ${pattern.vsOverall} above your overall.`
  }
  if (pattern.vsOverall <= -4) {
    return `${pattern.tag} days average ${pattern.averageScore}, ${Math.abs(pattern.vsOverall)} below your overall.`
  }
  return `${pattern.tag} shows up ${pattern.count} times near your usual range.`
}

export function windowCounts(entries: SignalEntry[]): { morning: number; evening: number } {
  return entries.reduce(
    (counts, entry) => {
      counts[resolveEntryWindow(entry)] += 1
      return counts
    },
    { morning: 0, evening: 0 },
  )
}

// ── Monthly summary ─────────────────────────────────────────────────────────

/** Show the month card once this many distinct days are logged in the month. */
export const MIN_DAYS_FOR_MONTHLY = 5

export interface MonthlySummary {
  /** First day of the calendar month, `YYYY-MM-DD`. */
  monthStart: string
  /** Last day counted (today when the month is in progress), `YYYY-MM-DD`. */
  monthEnd: string
  /** e.g. "August 2026" */
  label: string
  checkInCount: number
  daysLogged: number
  averageScore: number | null
  morningCount: number
  eveningCount: number
  morningAvg: number | null
  eveningAvg: number | null
  topTags: string[]
  bestDay: { dayKey: string; score: number } | null
  /** This month's average minus last month's, or null if last month is empty. */
  vsPreviousMonth: number | null
  ready: boolean
  highlight: string
}

const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const

const entryDayKey = (entry: SignalEntry): string => entry.dayKey ?? localDayKey(new Date(entry.createdAt))

const monthPrefix = (year: number, monthIndex: number): string => `${year}-${String(monthIndex + 1).padStart(2, '0')}`

export function entriesInMonth(entries: SignalEntry[], year: number, monthIndex: number): SignalEntry[] {
  const prefix = monthPrefix(year, monthIndex)
  return entries.filter((entry) => entryDayKey(entry).startsWith(prefix))
}

function averageOf(entries: SignalEntry[]): number | null {
  if (entries.length === 0) return null
  return Math.round(entries.reduce((sum, entry) => sum + entry.score, 0) / entries.length)
}

function topTagsOf(entries: SignalEntry[], limit = 3): string[] {
  const counts = new Map<string, number>()
  for (const entry of entries) {
    for (const tag of new Set(entry.tags.map((item) => item.trim()).filter(Boolean))) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([tag]) => tag)
}

export function buildMonthlySummary(entries: SignalEntry[], now: Date = new Date()): MonthlySummary {
  const year = now.getFullYear()
  const monthIndex = now.getMonth()
  const month = entriesInMonth(entries, year, monthIndex)

  const previousDate = new Date(year, monthIndex - 1, 1)
  const previous = entriesInMonth(entries, previousDate.getFullYear(), previousDate.getMonth())

  const averageScore = averageOf(month)
  const previousAverage = averageOf(previous)
  const amPm = compareMorningEvening(month)
  const counts = windowCounts(month)
  const daysLogged = new Set(month.map(entryDayKey)).size

  let bestDay: MonthlySummary['bestDay'] = null
  for (const entry of month) {
    const key = entryDayKey(entry)
    if (bestDay === null || entry.score > bestDay.score || (entry.score === bestDay.score && key > bestDay.dayKey)) {
      bestDay = { dayKey: key, score: entry.score }
    }
  }

  const vsPreviousMonth = averageScore === null || previousAverage === null ? null : averageScore - previousAverage
  const ready = daysLogged >= MIN_DAYS_FOR_MONTHLY

  return {
    monthStart: `${monthPrefix(year, monthIndex)}-01`,
    monthEnd: localDayKey(now),
    label: `${MONTH_LABELS[monthIndex]} ${year}`,
    checkInCount: month.length,
    daysLogged,
    averageScore,
    morningCount: counts.morning,
    eveningCount: counts.evening,
    morningAvg: amPm.morning,
    eveningAvg: amPm.evening,
    topTags: topTagsOf(month),
    bestDay,
    vsPreviousMonth,
    ready,
    highlight: monthlyHighlight({ daysLogged, averageScore, vsPreviousMonth, ready, counts }),
  }
}

function monthlyHighlight(input: {
  daysLogged: number
  averageScore: number | null
  vsPreviousMonth: number | null
  ready: boolean
  counts: { morning: number; evening: number }
}): string {
  if (!input.ready) {
    const remaining = MIN_DAYS_FOR_MONTHLY - input.daysLogged
    return `Log ${remaining} more ${remaining === 1 ? 'day' : 'days'} this month to unlock the monthly read.`
  }
  if (input.vsPreviousMonth !== null && Math.abs(input.vsPreviousMonth) >= 5) {
    return input.vsPreviousMonth > 0
      ? `Up ${input.vsPreviousMonth} on last month. Whatever changed, it is working.`
      : `Down ${Math.abs(input.vsPreviousMonth)} on last month. Compare the tags that dropped off.`
  }
  const total = input.counts.morning + input.counts.evening
  if (total > 0 && input.counts.evening === 0) {
    return 'All mornings this month. An evening window would show how your days end.'
  }
  if (total > 0 && input.counts.morning === 0) {
    return 'All evenings this month. A morning window would show where your days start.'
  }
  if (input.averageScore !== null && input.averageScore >= 75) {
    return 'A strong month across both windows. Keep the conditions that held.'
  }
  if (input.averageScore !== null && input.averageScore <= 45) {
    return 'A low month. Pick one recovery habit and watch the next two weeks.'
  }
  return 'A steady month. Tag patterns will show what moved the needle.'
}
