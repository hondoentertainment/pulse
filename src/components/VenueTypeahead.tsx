import { useEffect, useMemo, useRef, useState } from 'react'
import type { Venue } from '@/lib/types'
import { MagnifyingGlass, MapPin, X } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import {
  searchVenueCatalog,
  VENUE_SEARCH_PLACEHOLDER,
} from '@/lib/venue-search'

interface VenueTypeaheadProps {
  venues: readonly Venue[]
  onVenueSelect: (venue: Venue) => void
  placeholder?: string
}

export function VenueTypeahead({
  venues,
  onVenueSelect,
  placeholder = VENUE_SEARCH_PLACEHOLDER,
}: VenueTypeaheadProps) {
  const [query, setQuery] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const hits = useMemo(() => searchVenueCatalog(venues, query), [venues, query])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  const showResults = isFocused && query.trim().length > 0

  const handleSelect = (venue: Venue) => {
    onVenueSelect(venue)
    setQuery('')
    setIsFocused(false)
    inputRef.current?.blur()
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (hits.length === 0) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setSelectedIndex((prev) => Math.min(prev + 1, hits.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setSelectedIndex((prev) => Math.max(prev - 1, 0))
    } else if (event.key === 'Enter' && hits[selectedIndex]) {
      event.preventDefault()
      handleSelect(hits[selectedIndex].venue)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setIsFocused(false)
      inputRef.current?.blur()
    }
  }

  return (
    <div className="relative w-full">
      <div className="relative">
        <MagnifyingGlass
          size={18}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          weight="bold"
        />
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={showResults}
          aria-controls="venue-typeahead-results"
          aria-autocomplete="list"
          aria-label={placeholder}
          placeholder={placeholder}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            window.setTimeout(() => setIsFocused(false), 160)
          }}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className={cn(
            'h-11 w-full rounded-full border border-border bg-card pl-10 text-[15px] text-foreground outline-none',
            'placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/40',
            query ? 'pr-12' : 'pr-4',
          )}
        />
        {query && (
          <button
            type="button"
            aria-label="Clear search"
            className="absolute right-1 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center text-muted-foreground"
            onClick={() => {
              setQuery('')
              inputRef.current?.focus()
            }}
          >
            <X size={16} weight="bold" />
          </button>
        )}
      </div>

      <AnimatePresence>
        {showResults && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.12 }}
            className="absolute left-0 right-0 top-full z-50 mt-2"
          >
            <ul
              id="venue-typeahead-results"
              role="listbox"
              className="overflow-hidden rounded-2xl border border-border bg-card shadow-none"
            >
              {hits.length === 0 ? (
                <li className="px-4 py-5 text-center text-[13px] text-muted-foreground">
                  No venues match “{query.trim()}”
                </li>
              ) : (
                hits.map((hit, index) => (
                  <li key={hit.venue.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selectedIndex === index}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => handleSelect(hit.venue)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={cn(
                        'flex w-full items-center gap-3 px-3 py-3 text-left',
                        selectedIndex === index ? 'bg-muted' : 'hover:bg-muted/60',
                      )}
                    >
                      <MapPin size={18} weight="fill" className="shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-bold text-foreground">
                          {hit.venue.name}
                        </span>
                        <span className="block truncate text-[13px] text-muted-foreground">
                          {[hit.venue.neighborhood, hit.matched === 'neighborhood' ? 'Neighborhood' : hit.venue.category]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
