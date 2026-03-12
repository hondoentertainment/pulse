import { useState, useEffect, useCallback } from 'react'
import type { Venue } from '@/lib/types'
import { getContextualSearchSuggestions, type ContextualSearchSuggestion } from '@/lib/contextual-intelligence'
import { getTimeOfDay } from '@/lib/time-contextual-scoring'
import {
  Coffee,
  ForkKnife,
  Martini,
  MusicNotes,
  BeerBottle,
  PaintBrush,
  MagnifyingGlass,
} from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ContextualSearchSuggestionsProps {
  venues: Venue[]
  userLocation: { lat: number; lng: number } | null
  onSelectSuggestion: (query: string) => void
  /** Override date for testing */
  date?: Date
}

// ---------------------------------------------------------------------------
// Category icon mapping
// ---------------------------------------------------------------------------

const CATEGORY_ICONS: Record<string, typeof Coffee> = {
  cafe: Coffee,
  restaurant: ForkKnife,
  bar: Martini,
  nightclub: Martini,
  music_venue: MusicNotes,
  brewery: BeerBottle,
  gallery: PaintBrush,
  all: MagnifyingGlass,
}

// ---------------------------------------------------------------------------
// Typing animation hook
// ---------------------------------------------------------------------------

function useTypingAnimation(text: string, speed: number = 40) {
  const [displayed, setDisplayed] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    setDisplayed('')
    setDone(false)
    if (!text) return

    let i = 0
    const interval = setInterval(() => {
      i++
      setDisplayed(text.slice(0, i))
      if (i >= text.length) {
        setDone(true)
        clearInterval(interval)
      }
    }, speed)

    return () => clearInterval(interval)
  }, [text, speed])

  return { displayed, done }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Displays 3-5 rotating contextual search suggestions below the search bar.
 * Each suggestion shows a category icon, typing-animated text, and a buzzing
 * venue count. Tapping a suggestion fires onSelectSuggestion with the query.
 */
export function ContextualSearchSuggestions({
  venues,
  userLocation,
  onSelectSuggestion,
  date,
}: ContextualSearchSuggestionsProps) {
  const now = date ?? new Date()
  const timeOfDay = getTimeOfDay(now)
  const suggestions = getContextualSearchSuggestions(venues, userLocation, timeOfDay)

  const [activeIndex, setActiveIndex] = useState(0)

  // Rotate through suggestions every 4 seconds
  useEffect(() => {
    if (suggestions.length <= 1) return
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % suggestions.length)
    }, 4000)
    return () => clearInterval(timer)
  }, [suggestions.length])

  const activeSuggestion = suggestions[activeIndex]
  const { displayed } = useTypingAnimation(
    activeSuggestion?.label ?? '',
    35,
  )

  const handleClick = useCallback(
    (suggestion: ContextualSearchSuggestion) => {
      onSelectSuggestion(suggestion.query)
    },
    [onSelectSuggestion],
  )

  if (suggestions.length === 0) return null

  const Icon = CATEGORY_ICONS[activeSuggestion?.categoryKey ?? 'all'] ?? MagnifyingGlass

  return (
    <div className="space-y-2">
      {/* Active suggestion with typing animation */}
      <AnimatePresence mode="wait">
        <motion.button
          key={activeIndex}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          onClick={() => activeSuggestion && handleClick(activeSuggestion)}
          className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg
            bg-muted/30 hover:bg-muted/50 border border-border/40
            transition-colors cursor-pointer group"
        >
          <Icon
            size={14}
            weight="duotone"
            className="text-accent shrink-0"
          />
          <span className="text-sm text-muted-foreground truncate">
            {displayed}
            <span className="inline-block w-px h-3.5 bg-accent/60 ml-0.5 animate-pulse align-middle" />
          </span>
        </motion.button>
      </AnimatePresence>

      {/* Dot indicators */}
      {suggestions.length > 1 && (
        <div className="flex items-center justify-center gap-1">
          {suggestions.map((_, i) => (
            <button
              key={i}
              onClick={() => setActiveIndex(i)}
              className={`
                w-1.5 h-1.5 rounded-full transition-all duration-300
                ${i === activeIndex ? 'bg-accent w-3' : 'bg-muted-foreground/30'}
              `}
            />
          ))}
        </div>
      )}

      {/* Quick-tap pills for all suggestions */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {suggestions.map((suggestion, i) => {
          const SuggIcon = CATEGORY_ICONS[suggestion.categoryKey] ?? MagnifyingGlass
          return (
            <motion.button
              key={suggestion.query}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleClick(suggestion)}
              className={`
                shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px]
                border transition-colors
                ${
                  i === activeIndex
                    ? 'bg-accent/15 text-accent border-accent/30'
                    : 'bg-muted/20 text-muted-foreground border-border/30 hover:bg-muted/40'
                }
              `}
            >
              <SuggIcon size={11} weight="fill" />
              <span className="whitespace-nowrap">{suggestion.query}</span>
              {suggestion.buzzingCount > 0 && (
                <span className="text-[9px] font-bold text-accent/80">
                  {suggestion.buzzingCount}
                </span>
              )}
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
