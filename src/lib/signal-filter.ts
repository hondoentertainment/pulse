import { resolveEntryWindow, type CheckInWindow, type SignalEntry } from '@/lib/signal-insights'
import { localDayKey } from '@/lib/signal-windows'

/**
 * Client-side filtering for the History page. Pure so the chip row can be
 * tested without rendering.
 */

export interface EntryFilter {
  /** Every listed tag must be present on the entry. */
  tags?: string[]
  /** Restrict to one check-in window; null/undefined means both. */
  window?: CheckInWindow | null
  /** Case-insensitive match against tags and the day key (e.g. "2026-08"). */
  query?: string
}

export interface TagCount {
  tag: string
  count: number
}

const dayKeyOf = (entry: SignalEntry): string => entry.dayKey ?? localDayKey(new Date(entry.createdAt))

export function isFilterActive(filter: EntryFilter): boolean {
  return Boolean((filter.tags && filter.tags.length > 0) || filter.window || (filter.query && filter.query.trim()))
}

export function filterEntries(entries: SignalEntry[], filter: EntryFilter): SignalEntry[] {
  const wantedTags = (filter.tags ?? []).map((tag) => tag.trim().toLowerCase()).filter(Boolean)
  const query = (filter.query ?? '').trim().toLowerCase()

  return entries.filter((entry) => {
    if (filter.window && resolveEntryWindow(entry) !== filter.window) return false

    const entryTags = entry.tags.map((tag) => tag.trim().toLowerCase())
    if (wantedTags.some((tag) => !entryTags.includes(tag))) return false

    if (query) {
      const haystack = [...entryTags, dayKeyOf(entry)]
      if (!haystack.some((value) => value.includes(query))) return false
    }

    return true
  })
}

/** Tags in use, most frequent first, then alphabetical. */
export function availableTags(entries: SignalEntry[]): TagCount[] {
  const counts = new Map<string, number>()
  for (const entry of entries) {
    for (const raw of new Set(entry.tags.map((tag) => tag.trim()).filter(Boolean))) {
      counts.set(raw, (counts.get(raw) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
}

export function toggleTag(selected: string[], tag: string): string[] {
  return selected.includes(tag) ? selected.filter((item) => item !== tag) : [...selected, tag]
}

export function filterSummary(shown: number, total: number, filter: EntryFilter): string {
  if (!isFilterActive(filter)) return `${total} ${total === 1 ? 'check-in' : 'check-ins'}`
  if (shown === 0) return 'No check-ins match. Clear a filter to see more.'
  return `${shown} of ${total} ${total === 1 ? 'check-in' : 'check-ins'}`
}
