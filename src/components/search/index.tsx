import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { motion, AnimatePresence, type Variants } from 'framer-motion'
import { Venue } from '@/lib/types'
import { SearchInput } from './SearchInput'
import { useSearchFilter } from './SearchFilters'
import { SearchResults, NoResults, type SearchResult } from './SearchResults'
import { SearchSuggestions } from './SearchSuggestions'

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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_RECENT = 5
const DEBOUNCE_MS = 150
const TRENDING_COUNT = 6

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
      const raf = requestAnimationFrame(() => inputRef.current?.focus())
      return () => cancelAnimationFrame(raf)
    }
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

  // ---- Search logic (delegated to SearchFilters hook) ----
  const sections = useSearchFilter(venues, debouncedQuery)

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

  const handleClear = useCallback(() => {
    setQuery('')
    inputRef.current?.focus()
  }, [])

  const showEmpty = debouncedQuery.trim().length === 0
  const showNoResults =
    debouncedQuery.trim().length > 0 && sections.length === 0

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
            <SearchInput
              ref={inputRef}
              query={query}
              onQueryChange={setQuery}
              onKeyDown={handleKeyDown}
              onClose={onClose}
              onClear={handleClear}
            />

            {/* Scrollable results area */}
            <div
              ref={listRef}
              className="flex-1 overflow-y-auto px-4 pb-8 overscroll-contain"
            >
              {/* ---- Empty state: recent + trending ---- */}
              {showEmpty && (
                <SearchSuggestions
                  recentSearches={recentSearches}
                  trendingVenues={trendingVenues}
                  onSelectRecent={handleRecentSelect}
                  onSelectTrending={handleTrendingSelect}
                />
              )}

              {/* ---- Search results ---- */}
              {!showEmpty && sections.length > 0 && (
                <SearchResults
                  sections={sections}
                  activeIndex={activeIndex}
                  onSelect={handleSelect}
                  onHover={setActiveIndex}
                />
              )}

              {/* ---- No results ---- */}
              {showNoResults && (
                <NoResults query={debouncedQuery} />
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
