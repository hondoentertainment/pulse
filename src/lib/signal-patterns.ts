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
