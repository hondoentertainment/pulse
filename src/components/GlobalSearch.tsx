import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { motion, AnimatePresence, type Variants } from 'framer-motion'
import {
  MagnifyingGlass,
  X,
  Clock,
  TrendUp,
  MapPin,
  Buildings,
} from '@phosphor-icons/react'
import { Venue } from '@/lib/types'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GlobalSearchProps {
  open: boolean
  onClose: () => void
  venues: Venue[]
  onSelectVenue: (venueId: string) => void
  onSelectCity: (cityKey: string) => void
}

interface SearchResult {
  id: string
  type: 'venue' | 'city' | 'category'
  label: string
  sublabel?: string
  venueId?: string
  cityKey?: string
  /** Indices of matched characters inside `label` (for highlighting). */
  matchRanges: [number, number][]
}

type ResultSection = {
  key: string
  title: string
  icon: React.ReactNode
  results: SearchResult[]
}

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
// Constants
// ---------------------------------------------------------------------------

const MAX_RECENT = 5
const DEBOUNCE_MS = 150
const TRENDING_COUNT = 6

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function HighlightedText({
  text,
  ranges,
}: {
  text: string
  ranges: [number, number][]
}) {
  if (ranges.length === 0) return <>{text}</>

  const parts: React.ReactNode[] = []
  let cursor = 0

  for (const [start, end] of ranges) {
    if (start > cursor) {
      parts.push(
        <span key={`t-${cursor}`}>{text.slice(cursor, start)}</span>,
      )
    }
    parts.push(
      <span
        key={`h-${start}`}
        className="text-accent font-bold"
      >
        {text.slice(start, end)}
      </span>,
    )
    cursor = end
  }

  if (cursor < text.length) {
    parts.push(<span key={`t-${cursor}`}>{text.slice(cursor)}</span>)
  }

  return <>{parts}</>
}

// ---------------------------------------------------------------------------
// Motion variants
// ---------------------------------------------------------------------------

const overlayVariants: Variants = {
  hidden: { opacity: 0, y: '-8%' },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] },
  },
  exit: {
    opacity: 0,
    y: '-8%',
    transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] },
  },
}

const sectionVariants: Variants = {
  hidden: { opacity: 0, x: -24 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.06, duration: 0.3, ease: 'easeOut' },
  }),
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.03, duration: 0.2, ease: 'easeOut' },
  }),
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function GlobalSearch({
  open,
  onClose,
  venues,
  onSelectVenue,
  onSelectCity,
}: GlobalSearchProps) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [recentSearches, setRecentSearches] = useState<
    { label: string; type: 'venue' | 'city' | 'category'; id: string }[]
  >([])
  const [activeIndex, setActiveIndex] = useState(-1)

  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // ---- Debounce ----
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query])

  // ---- Focus input on open ----
  useEffect(() => {
    if (open) {
      // Small delay to let the animation start so the element is mounted
      const raf = requestAnimationFrame(() => inputRef.current?.focus())
      return () => cancelAnimationFrame(raf)
    }
    // Reset state on close
    setQuery('')
    setDebouncedQuery('')
    setActiveIndex(-1)
  }, [open])

  // ---- Trending venues (top by pulse score) ----
  const trendingVenues = useMemo(
    () =>
      [...venues]
        .sort((a, b) => b.pulseScore - a.pulseScore)
        .slice(0, TRENDING_COUNT),
    [venues],
  )

  // ---- Search logic ----
  const sections: ResultSection[] = useMemo(() => {
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
        // Determine which field matched best for highlighting
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

  // Flat list of all results for keyboard navigation
  const flatResults = useMemo(
    () => sections.flatMap((s) => s.results),
    [sections],
  )

  // Reset active index when results change
  useEffect(() => {
    setActiveIndex(-1)
  }, [debouncedQuery])

  // ---- Scroll active item into view ----
  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return
    const el = listRef.current.querySelector(`[data-result-index="${activeIndex}"]`)
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [activeIndex])

  // ---- Handlers ----
  const addRecent = useCallback(
    (label: string, type: 'venue' | 'city' | 'category', id: string) => {
      setRecentSearches((prev) => {
        const next = [{ label, type, id }, ...prev.filter((r) => r.id !== id)]
        return next.slice(0, MAX_RECENT)
      })
    },
    [],
  )

  const handleSelect = useCallback(
    (result: SearchResult) => {
      addRecent(result.label, result.type, result.id)

      if (result.type === 'venue' && result.venueId) {
        onSelectVenue(result.venueId)
      } else if (result.type === 'city' && result.cityKey) {
        onSelectCity(result.cityKey)
      } else if (result.type === 'category') {
        // For categories, select the top venue in that category
        const firstMatch = venues.find(
          (v) => v.category?.toLowerCase() === result.label.toLowerCase(),
        )
        if (firstMatch) onSelectVenue(firstMatch.id)
      }

      onClose()
    },
    [addRecent, onClose, onSelectVenue, onSelectCity, venues],
  )

  const handleTrendingSelect = useCallback(
    (venue: Venue) => {
      addRecent(venue.name, 'venue', `venue-${venue.id}`)
      onSelectVenue(venue.id)
      onClose()
    },
    [addRecent, onSelectVenue, onClose],
  )

  const handleRecentSelect = useCallback(
    (recent: { label: string; type: 'venue' | 'city' | 'category'; id: string }) => {
      if (recent.type === 'venue') {
        const venueId = recent.id.replace('venue-', '')
        onSelectVenue(venueId)
      } else if (recent.type === 'city') {
        const cityKey = recent.id.replace('city-', '')
        onSelectCity(cityKey)
      }
      onClose()
    },
    [onSelectVenue, onSelectCity, onClose],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const hasResults = flatResults.length > 0

      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault()
          if (hasResults) {
            setActiveIndex((prev) =>
              prev < flatResults.length - 1 ? prev + 1 : 0,
            )
          }
          break
        }
        case 'ArrowUp': {
          e.preventDefault()
          if (hasResults) {
            setActiveIndex((prev) =>
              prev > 0 ? prev - 1 : flatResults.length - 1,
            )
          }
          break
        }
        case 'Enter': {
          e.preventDefault()
          if (activeIndex >= 0 && flatResults[activeIndex]) {
            handleSelect(flatResults[activeIndex])
          }
          break
        }
        case 'Escape': {
          e.preventDefault()
          onClose()
          break
        }
      }
    },
    [flatResults, activeIndex, handleSelect, onClose],
  )

  const showEmpty = debouncedQuery.trim().length === 0
  const showNoResults =
    debouncedQuery.trim().length > 0 && sections.length === 0

  // Track the global index offset for each result
  let globalIndex = 0

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex flex-col"
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-background/95 backdrop-blur-xl"
            onClick={onClose}
          />

          {/* Content */}
          <div className="relative z-10 flex flex-col w-full max-w-2xl mx-auto h-full">
            {/* Search header */}
            <div className="flex-shrink-0 px-4 pt-safe-top">
              <div className="flex items-center gap-3 py-4">
                <motion.div
                  className="relative flex-1"
                  initial={{ scaleX: 0.85, opacity: 0 }}
                  animate={{ scaleX: 1, opacity: 1 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  style={{ transformOrigin: 'left center' }}
                >
                  <MagnifyingGlass
                    size={22}
                    weight="bold"
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                  />
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Search venues, cities, categories..."
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    className={cn(
                      'w-full h-13 pl-12 pr-12 rounded-2xl',
                      'bg-card/80 border border-border',
                      'text-foreground placeholder:text-muted-foreground',
                      'text-base font-medium',
                      'outline-none transition-all duration-200',
                      'focus:ring-2 focus:ring-accent/50 focus:border-accent/40',
                      'backdrop-blur-sm',
                    )}
                  />
                  {query && (
                    <button
                      onClick={() => {
                        setQuery('')
                        inputRef.current?.focus()
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-muted/60 hover:bg-muted transition-colors"
                    >
                      <X size={14} weight="bold" className="text-muted-foreground" />
                    </button>
                  )}
                </motion.div>

                <motion.button
                  onClick={onClose}
                  className="flex-shrink-0 px-3 py-2 text-sm font-semibold text-accent hover:text-accent/80 transition-colors"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1, duration: 0.2 }}
                >
                  Cancel
                </motion.button>
              </div>
            </div>

            {/* Scrollable results area */}
            <div
              ref={listRef}
              className="flex-1 overflow-y-auto px-4 pb-8 overscroll-contain"
            >
              {/* ---- Empty state: recent + trending ---- */}
              {showEmpty && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1, duration: 0.25 }}
                >
                  {/* Recent searches */}
                  {recentSearches.length > 0 && (
                    <motion.div
                      className="mb-6"
                      variants={sectionVariants}
                      initial="hidden"
                      animate="visible"
                      custom={0}
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <Clock
                          size={16}
                          weight="fill"
                          className="text-muted-foreground"
                        />
                        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                          Recent Searches
                        </h3>
                      </div>
                      <div className="space-y-1">
                        {recentSearches.map((recent, i) => (
                          <motion.button
                            key={recent.id}
                            variants={itemVariants}
                            initial="hidden"
                            animate="visible"
                            custom={i}
                            onClick={() => handleRecentSelect(recent)}
                            className={cn(
                              'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl',
                              'text-left transition-colors',
                              'hover:bg-card/80',
                            )}
                          >
                            <Clock
                              size={18}
                              weight="regular"
                              className="text-muted-foreground flex-shrink-0"
                            />
                            <span className="text-sm font-medium text-foreground truncate">
                              {recent.label}
                            </span>
                            <span className="text-xs text-muted-foreground capitalize ml-auto flex-shrink-0">
                              {recent.type}
                            </span>
                          </motion.button>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* Trending */}
                  <motion.div
                    variants={sectionVariants}
                    initial="hidden"
                    animate="visible"
                    custom={recentSearches.length > 0 ? 1 : 0}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <TrendUp
                        size={16}
                        weight="fill"
                        className="text-accent"
                      />
                      <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                        Trending Now
                      </h3>
                    </div>
                    <div className="space-y-1">
                      {trendingVenues.map((venue, i) => (
                        <motion.button
                          key={venue.id}
                          variants={itemVariants}
                          initial="hidden"
                          animate="visible"
                          custom={i}
                          onClick={() => handleTrendingSelect(venue)}
                          className={cn(
                            'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl',
                            'text-left transition-colors',
                            'hover:bg-card/80',
                          )}
                        >
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center flex-shrink-0">
                            <TrendUp
                              size={16}
                              weight="fill"
                              className="text-accent"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">
                              {venue.name}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {[venue.category, venue.city]
                                .filter(Boolean)
                                .join(' \u00B7 ')}
                            </p>
                          </div>
                          <div className="flex-shrink-0 text-xs font-bold text-accent tabular-nums">
                            {venue.pulseScore}
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                </motion.div>
              )}

              {/* ---- Search results ---- */}
              {!showEmpty && sections.length > 0 && (
                <div className="space-y-5">
                  {sections.map((section, sectionIdx) => {
                    const sectionStartIndex = globalIndex
                    const sectionElement = (
                      <motion.div
                        key={section.key}
                        variants={sectionVariants}
                        initial="hidden"
                        animate="visible"
                        custom={sectionIdx}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          {section.icon}
                          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                            {section.title}
                          </h3>
                          <span className="text-xs text-muted-foreground/60 ml-1">
                            {section.results.length}
                          </span>
                        </div>
                        <div className="space-y-0.5">
                          {section.results.map((result, i) => {
                            const resultGlobalIndex = sectionStartIndex + i
                            const isActive = resultGlobalIndex === activeIndex

                            return (
                              <motion.button
                                key={result.id}
                                data-result-index={resultGlobalIndex}
                                variants={itemVariants}
                                initial="hidden"
                                animate="visible"
                                custom={i}
                                onClick={() => handleSelect(result)}
                                onMouseEnter={() =>
                                  setActiveIndex(resultGlobalIndex)
                                }
                                className={cn(
                                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl',
                                  'text-left transition-colors duration-100',
                                  isActive
                                    ? 'bg-accent/10 ring-1 ring-accent/20'
                                    : 'hover:bg-card/80',
                                )}
                              >
                                <div
                                  className={cn(
                                    'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                                    result.type === 'venue' &&
                                      'bg-gradient-to-br from-primary/20 to-accent/20',
                                    result.type === 'city' &&
                                      'bg-gradient-to-br from-blue-500/20 to-cyan-500/20',
                                    result.type === 'category' &&
                                      'bg-gradient-to-br from-purple-500/20 to-pink-500/20',
                                  )}
                                >
                                  {result.type === 'venue' && (
                                    <MapPin
                                      size={16}
                                      weight="fill"
                                      className="text-accent"
                                    />
                                  )}
                                  {result.type === 'city' && (
                                    <Buildings
                                      size={16}
                                      weight="fill"
                                      className="text-blue-400"
                                    />
                                  )}
                                  {result.type === 'category' && (
                                    <TrendUp
                                      size={16}
                                      weight="fill"
                                      className="text-purple-400"
                                    />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-foreground truncate">
                                    <HighlightedText
                                      text={result.label}
                                      ranges={result.matchRanges}
                                    />
                                  </p>
                                  {result.sublabel && (
                                    <p className="text-xs text-muted-foreground truncate">
                                      {result.sublabel}
                                    </p>
                                  )}
                                </div>
                                {result.type === 'venue' && (
                                  <div className="flex-shrink-0">
                                    <span className="text-xs text-muted-foreground font-mono">
                                      Venue
                                    </span>
                                  </div>
                                )}
                              </motion.button>
                            )
                          })}
                        </div>
                      </motion.div>
                    )

                    globalIndex += section.results.length
                    return sectionElement
                  })}
                </div>
              )}

              {/* ---- No results ---- */}
              {showNoResults && (
                <motion.div
                  className="flex flex-col items-center justify-center py-16 text-center"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.25 }}
                >
                  <div className="w-16 h-16 rounded-2xl bg-card/80 flex items-center justify-center mb-4">
                    <MagnifyingGlass
                      size={32}
                      weight="duotone"
                      className="text-muted-foreground"
                    />
                  </div>
                  <p className="text-base font-semibold text-foreground mb-1">
                    No results for &ldquo;{debouncedQuery}&rdquo;
                  </p>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    Try a different spelling, or search for a city or category
                    like &ldquo;rooftop&rdquo; or &ldquo;Brooklyn&rdquo;
                  </p>
                </motion.div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
