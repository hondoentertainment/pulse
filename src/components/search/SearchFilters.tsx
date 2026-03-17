import { useMemo } from 'react'
import { MapPin, Buildings, TrendUp } from '@phosphor-icons/react'
import type { Venue } from '@/lib/types'
import type { SearchResult, ResultSection } from './SearchResults'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Lightweight fuzzy matcher.  Returns match ranges (start, end) inside `text`
 * for every contiguous run of characters that matches `query`.  The algorithm
 * works case-insensitively and greedily finds the best contiguous substrings.
 */
function fuzzyMatch(
  text: string,
  query: string,
): { score: number; ranges: [number, number][] } | null {
  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase()

  // Fast-path: exact substring
  const idx = lowerText.indexOf(lowerQuery)
  if (idx !== -1) {
    return { score: 100 - idx, ranges: [[idx, idx + lowerQuery.length]] }
  }

  // Character-by-character fuzzy walk
  let qi = 0
  let score = 0
  const ranges: [number, number][] = []
  let runStart = -1

  for (let ti = 0; ti < lowerText.length && qi < lowerQuery.length; ti++) {
    if (lowerText[ti] === lowerQuery[qi]) {
      if (runStart === -1) runStart = ti
      qi++
      score += 1
      // Bonus for consecutive
      if (ranges.length > 0 && ranges[ranges.length - 1][1] === ti) {
        score += 2
      }
    } else if (runStart !== -1) {
      ranges.push([runStart, ti])
      runStart = -1
    }
  }

  if (qi < lowerQuery.length) return null // not all chars matched

  // Close last run
  if (runStart !== -1) {
    let lastTi = 0
    let tmpQi = 0
    for (let ti = 0; ti < lowerText.length && tmpQi < lowerQuery.length; ti++) {
      if (lowerText[ti] === lowerQuery[tmpQi]) {
        lastTi = ti
        tmpQi++
      }
    }
    ranges.push([runStart, lastTi + 1])
  }

  // Merge overlapping ranges
  const merged: [number, number][] = []
  for (const r of ranges) {
    if (merged.length > 0 && r[0] <= merged[merged.length - 1][1]) {
      merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], r[1])
    } else {
      merged.push([...r])
    }
  }

  return { score, ranges: merged }
}

// ---------------------------------------------------------------------------
// Hook: useSearchFilter
// ---------------------------------------------------------------------------

export function useSearchFilter(venues: Venue[], debouncedQuery: string): ResultSection[] {
  return useMemo(() => {
    const q = debouncedQuery.trim()
    if (!q) return []

    // --- Venues ---
    const venueResults: (SearchResult & { _score: number })[] = []
    for (const v of venues) {
      const nameMatch = fuzzyMatch(v.name, q)
      const catMatch = v.category ? fuzzyMatch(v.category, q) : null
      const cityMatch = v.city ? fuzzyMatch(v.city, q) : null

      const best = [nameMatch, catMatch, cityMatch]
        .filter(Boolean)
        .sort((a, b) => b!.score - a!.score)[0]

      if (best) {
        const matchedName = nameMatch && nameMatch.score === best.score
        venueResults.push({
          id: `venue-${v.id}`,
          type: 'venue',
          label: v.name,
          sublabel: [v.category, v.city].filter(Boolean).join(' \u00B7 '),
          venueId: v.id,
          matchRanges: matchedName ? best.ranges : [],
          _score: best.score + v.pulseScore * 0.1,
        })
      }
    }
    venueResults.sort((a, b) => b._score - a._score)

    // --- Cities ---
    const cityMap = new Map<string, { count: number; match: ReturnType<typeof fuzzyMatch> }>()
    for (const v of venues) {
      if (!v.city) continue
      const m = fuzzyMatch(v.city, q)
      if (!m) continue
      const existing = cityMap.get(v.city)
      if (!existing || m.score > existing.match!.score) {
        cityMap.set(v.city, {
          count: (existing?.count ?? 0) + 1,
          match: m,
        })
      } else {
        cityMap.set(v.city, { ...existing, count: existing.count + 1 })
      }
    }
    const cityResults: SearchResult[] = [...cityMap.entries()]
      .sort((a, b) => b[1].match!.score - a[1].match!.score)
      .slice(0, 8)
      .map(([city, data]) => ({
        id: `city-${city}`,
        type: 'city' as const,
        label: city,
        sublabel: `${data.count} venue${data.count !== 1 ? 's' : ''}`,
        cityKey: city,
        matchRanges: data.match!.ranges,
      }))

    // --- Categories ---
    const catMap = new Map<string, { count: number; match: ReturnType<typeof fuzzyMatch> }>()
    for (const v of venues) {
      if (!v.category) continue
      const m = fuzzyMatch(v.category, q)
      if (!m) continue
      const existing = catMap.get(v.category)
      if (!existing || m.score > existing.match!.score) {
        catMap.set(v.category, {
          count: (existing?.count ?? 0) + 1,
          match: m,
        })
      } else {
        catMap.set(v.category, { ...existing, count: existing.count + 1 })
      }
    }
    const catResults: SearchResult[] = [...catMap.entries()]
      .sort((a, b) => b[1].match!.score - a[1].match!.score)
      .slice(0, 6)
      .map(([cat, data]) => ({
        id: `cat-${cat}`,
        type: 'category' as const,
        label: cat,
        sublabel: `${data.count} venue${data.count !== 1 ? 's' : ''}`,
        matchRanges: data.match!.ranges,
      }))

    const result: ResultSection[] = []

    if (venueResults.length > 0) {
      result.push({
        key: 'venues',
        title: 'Venues',
        icon: <MapPin size={16} weight="fill" className="text-accent" />,
        results: venueResults.slice(0, 10),
      })
    }

    if (cityResults.length > 0) {
      result.push({
        key: 'cities',
        title: 'Cities',
        icon: <Buildings size={16} weight="fill" className="text-accent" />,
        results: cityResults,
      })
    }

    if (catResults.length > 0) {
      result.push({
        key: 'categories',
        title: 'Categories',
        icon: <TrendUp size={16} weight="fill" className="text-accent" />,
        results: catResults,
      })
    }

    return result
  }, [debouncedQuery, venues])
}
