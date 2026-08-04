/**
 * Signal pattern discovery.
 *
 * The check-in flow already collects a `tags[]` array on every entry, but until
 * now nothing analysed it — even though "reveal your best patterns" is the whole
 * product promise. These pure helpers correlate tags with signal scores and
 * surface lifetime records, turning raw history into "what lifts you / what
 * drains you" insight.
 *
 * Everything here is deterministic and side-effect free so it can be unit-tested
 * and memoised in the UI.
 */
import type { SignalEntry } from '@/lib/signal-insights'

export interface TagCorrelation {
  tag: string
  /** Mean signal score across entries that carry this tag. */
  averageWith: number
  /** Mean signal score across entries that do NOT carry this tag. */
  averageWithout: number
  /** averageWith − averageWithout, rounded. Positive ⇒ the tag lifts you. */
  delta: number
  /** How many entries carry this tag. */
  occurrences: number
}

export interface SignalPatterns {
  lifts: TagCorrelation[]
  drains: TagCorrelation[]
}

export interface PersonalRecords {
  totalCheckIns: number
  bestScore: number
  bestScoreDate: string | null
  longestStreak: number
  mostFrequentTag: string | null
  bestDayOfWeek: string | null
}

const mean = (values: number[]): number =>
  values.length === 0 ? 0 : values.reduce((sum, v) => sum + v, 0) / values.length

// Local calendar day, matching signal-streak.ts. A UTC key would collapse an
// 11pm and a 1am check-in (consecutive local days, west of UTC) into one day
// and understate the longest-streak record.
const dayKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

/**
 * Correlate each distinct tag with signal score. A tag is only scored when it
 * appears at least `minOccurrences` times AND there is at least one entry
 * without it — otherwise there is no baseline to contrast against.
 *
 * Returns every qualifying tag sorted by `delta` descending (biggest lift
 * first). Callers split into lifts/drains via {@link getSignalPatterns}.
 */
export function getTagCorrelations(entries: SignalEntry[], minOccurrences = 2): TagCorrelation[] {
  if (entries.length < 2) return []

  const tags = new Set<string>()
  for (const entry of entries) {
    for (const tag of entry.tags) tags.add(tag)
  }

  const correlations: TagCorrelation[] = []
  for (const tag of tags) {
    const withTag = entries.filter((entry) => entry.tags.includes(tag))
    const withoutTag = entries.filter((entry) => !entry.tags.includes(tag))
    if (withTag.length < minOccurrences || withoutTag.length === 0) continue

    const averageWith = Math.round(mean(withTag.map((e) => e.score)))
    const averageWithout = Math.round(mean(withoutTag.map((e) => e.score)))
    correlations.push({
      tag,
      averageWith,
      averageWithout,
      delta: averageWith - averageWithout,
      occurrences: withTag.length,
    })
  }

  return correlations.sort((a, b) => b.delta - a.delta)
}

/**
 * Split tag correlations into `lifts` (delta > 0) and `drains` (delta < 0),
 * each capped to `limit` and ordered by magnitude. Tags with no measurable
 * effect (delta === 0) are omitted from both.
 */
export function getSignalPatterns(entries: SignalEntry[], limit = 3): SignalPatterns {
  const correlations = getTagCorrelations(entries)
  const lifts = correlations.filter((c) => c.delta > 0).slice(0, limit)
  const drains = correlations
    .filter((c) => c.delta < 0)
    .sort((a, b) => a.delta - b.delta)
    .slice(0, limit)
  return { lifts, drains }
}

/** Longest run of consecutive calendar days with at least one entry. */
export function getLongestStreak(entries: SignalEntry[]): number {
  if (entries.length === 0) return 0

  const days = Array.from(new Set(entries.map((entry) => dayKey(new Date(entry.createdAt))))).sort()

  let longest = 1
  let current = 1
  for (let i = 1; i < days.length; i += 1) {
    const prev = new Date(`${days[i - 1]}T00:00:00Z`)
    const curr = new Date(`${days[i]}T00:00:00Z`)
    const diffDays = Math.round((curr.getTime() - prev.getTime()) / 86_400_000)
    if (diffDays === 1) {
      current += 1
      longest = Math.max(longest, current)
    } else {
      current = 1
    }
  }
  return longest
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** Weekday whose entries average the highest score (min one entry). */
export function getBestDayOfWeek(entries: SignalEntry[]): string | null {
  if (entries.length === 0) return null
  const buckets = new Map<number, number[]>()
  for (const entry of entries) {
    const dow = new Date(entry.createdAt).getDay()
    const list = buckets.get(dow) ?? []
    list.push(entry.score)
    buckets.set(dow, list)
  }

  let bestDow: number | null = null
  let bestAvg = -Infinity
  for (const [dow, scores] of buckets) {
    const avg = mean(scores)
    if (avg > bestAvg) {
      bestAvg = avg
      bestDow = dow
    }
  }
  return bestDow === null ? null : WEEKDAYS[bestDow]
}

/** Most frequently applied tag across all entries. */
export function getMostFrequentTag(entries: SignalEntry[]): string | null {
  const counts = new Map<string, number>()
  for (const entry of entries) {
    for (const tag of entry.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1)
  }
  let best: string | null = null
  let bestCount = 0
  for (const [tag, count] of counts) {
    if (count > bestCount) {
      bestCount = count
      best = tag
    }
  }
  return best
}

/** Lifetime records for the "personal bests" surface. */
export function getPersonalRecords(entries: SignalEntry[]): PersonalRecords {
  if (entries.length === 0) {
    return {
      totalCheckIns: 0,
      bestScore: 0,
      bestScoreDate: null,
      longestStreak: 0,
      mostFrequentTag: null,
      bestDayOfWeek: null,
    }
  }

  const best = entries.reduce((top, entry) => (entry.score > top.score ? entry : top), entries[0])

  return {
    totalCheckIns: entries.length,
    bestScore: best.score,
    bestScoreDate: best.createdAt,
    longestStreak: getLongestStreak(entries),
    mostFrequentTag: getMostFrequentTag(entries),
    bestDayOfWeek: getBestDayOfWeek(entries),
  }
}
