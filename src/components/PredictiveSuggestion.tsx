'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Lightbulb, X, ArrowRight } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import type { Venue, User, Pulse } from '@/lib/types'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PredictiveSuggestionProps {
  venues: Venue[]
  user: User
  currentTime: Date
  onVenueClick: (venue: Venue) => void
}

// ---------------------------------------------------------------------------
// Suggestion types
// ---------------------------------------------------------------------------

interface Suggestion {
  id: string
  text: string
  actionLabel: string
  venue?: Venue
  type: 'time' | 'weather' | 'pattern' | 'social'
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const

function formatHour(hour: number): string {
  if (hour === 0 || hour === 24) return '12am'
  if (hour === 12) return '12pm'
  return hour < 12 ? `${hour}am` : `${hour - 12}pm`
}

// ---------------------------------------------------------------------------
// Suggestion generators
// ---------------------------------------------------------------------------

function generateTimeSuggestions(
  venues: Venue[],
  currentTime: Date,
): Suggestion[] {
  const hour = currentTime.getHours()
  const dayName = DAY_NAMES[currentTime.getDay()]
  const suggestions: Suggestion[] = []

  // Find venues that peak later tonight
  if (hour >= 18 && hour <= 22) {
    const peakVenues = venues
      .filter((v) => {
        const cat = v.category?.toLowerCase() ?? ''
        return (
          (cat.includes('bar') ||
            cat.includes('club') ||
            cat.includes('lounge')) &&
          v.pulseScore > 30 &&
          (v.scoreVelocity ?? 0) > 0
        )
      })
      .sort((a, b) => (b.scoreVelocity ?? 0) - (a.scoreVelocity ?? 0))

    if (peakVenues.length > 0) {
      const top = peakVenues[0]
      const peakHour = Math.min(hour + 2, 23)
      suggestions.push({
        id: `time-peak-${top.id}`,
        text: `It's ${dayName} ${formatHour(hour)} — ${top.name} usually peaks at ${formatHour(peakHour)}, head early?`,
        actionLabel: 'Check it out',
        venue: top,
        type: 'time',
      })
    }
  }

  // Morning/afternoon cafe suggestion
  if (hour >= 8 && hour <= 14) {
    const cafes = venues
      .filter((v) => {
        const cat = v.category?.toLowerCase() ?? ''
        return cat.includes('cafe') || cat.includes('coffee')
      })
      .sort((a, b) => b.pulseScore - a.pulseScore)

    if (cafes.length > 0) {
      suggestions.push({
        id: `time-cafe-${cafes[0].id}`,
        text: `Good ${hour < 12 ? 'morning' : 'afternoon'}! ${cafes[0].name} is buzzing right now.`,
        actionLabel: 'See details',
        venue: cafes[0],
        type: 'time',
      })
    }
  }

  return suggestions
}

function generateWeatherSuggestions(
  venues: Venue[],
  currentTime: Date,
): Suggestion[] {
  const hour = currentTime.getHours()
  const suggestions: Suggestion[] = []

  // Simulated weather — evening hours get rooftop suggestion
  if (hour >= 17 && hour <= 23) {
    const rooftops = venues.filter((v) => {
      const cat = v.category?.toLowerCase() ?? ''
      const name = v.name.toLowerCase()
      return cat.includes('rooftop') || name.includes('rooftop') || name.includes('terrace')
    })

    if (rooftops.length > 0) {
      suggestions.push({
        id: `weather-rooftop-${rooftops[0].id}`,
        text: 'Great night for rooftop bars!',
        actionLabel: 'See venues',
        venue: rooftops[0],
        type: 'weather',
      })
    }
  }

  // Rainy day / cozy suggestion (simulated for weekdays)
  const day = currentTime.getDay()
  if (day >= 1 && day <= 3 && hour >= 16) {
    const cozy = venues
      .filter((v) => {
        const cat = v.category?.toLowerCase() ?? ''
        return cat.includes('lounge') || cat.includes('wine') || cat.includes('jazz')
      })
      .sort((a, b) => b.pulseScore - a.pulseScore)

    if (cozy.length > 0) {
      suggestions.push({
        id: `weather-cozy-${cozy[0].id}`,
        text: `Perfect evening for a cozy spot like ${cozy[0].name}.`,
        actionLabel: 'Check it out',
        venue: cozy[0],
        type: 'weather',
      })
    }
  }

  return suggestions
}

function generatePatternSuggestions(
  user: User,
  currentTime: Date,
): Suggestion[] {
  const dayName = DAY_NAMES[currentTime.getDay()]
  const hour = currentTime.getHours()
  const suggestions: Suggestion[] = []

  // If the user has check-in history, assume a pattern
  const totalCheckins = user.venueCheckInHistory
    ? Object.values(user.venueCheckInHistory).reduce((a, b) => a + b, 0)
    : 0

  if (totalCheckins > 3) {
    // Weekend pattern
    const isWeekend = currentTime.getDay() === 5 || currentTime.getDay() === 6
    if (isWeekend && hour >= 18 && hour <= 22) {
      suggestions.push({
        id: `pattern-weekend-${currentTime.getDay()}`,
        text: `You usually go out around this time on ${dayName}s.`,
        actionLabel: 'See venues',
        type: 'pattern',
      })
    }
  }

  return suggestions
}

function generateSocialSuggestions(
  _venues: Venue[],
  _user: User,
): Suggestion[] {
  // Social suggestions require real presence data — no simulated counts
  return []
}

// ---------------------------------------------------------------------------
// PredictiveSuggestion
// ---------------------------------------------------------------------------

export default function PredictiveSuggestion({
  venues,
  user,
  currentTime,
  onVenueClick,
}: PredictiveSuggestionProps) {
  const [dismissed, setDismissed] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)

  // Generate all suggestions
  const suggestions = useMemo<Suggestion[]>(() => {
    const all = [
      ...generateTimeSuggestions(venues, currentTime),
      ...generateWeatherSuggestions(venues, currentTime),
      ...generatePatternSuggestions(user, currentTime),
      ...generateSocialSuggestions(venues, user),
    ]
    // De-dup by id
    const seen = new Set<string>()
    return all.filter((s) => {
      if (seen.has(s.id)) return false
      seen.add(s.id)
      return true
    })
  }, [venues, currentTime, user])

  // Cycle through suggestions
  useEffect(() => {
    if (suggestions.length <= 1) return
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % suggestions.length)
    }, 10_000)
    return () => clearInterval(interval)
  }, [suggestions.length])

  // Auto-dismiss after 30 seconds of no interaction
  useEffect(() => {
    if (dismissed || suggestions.length === 0) return
    const timer = setTimeout(() => setDismissed(true), 30_000)
    return () => clearTimeout(timer)
  }, [dismissed, suggestions.length, currentIndex])

  const handleAction = useCallback(() => {
    const current = suggestions[currentIndex]
    if (current?.venue) {
      onVenueClick(current.venue)
    }
  }, [suggestions, currentIndex, onVenueClick])

  const handleDismiss = useCallback(() => {
    setDismissed(true)
  }, [])

  // Nothing to show
  if (suggestions.length === 0 || dismissed) return null

  const current = suggestions[currentIndex % suggestions.length]
  if (!current) return null

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={current.id}
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ type: 'spring', stiffness: 360, damping: 30 }}
        className="relative rounded-xl overflow-hidden"
      >
        {/* Animated gradient border */}
        <div
          className="absolute inset-0 rounded-xl p-px"
          style={{
            background:
              'linear-gradient(120deg, rgba(168,85,247,0.4), rgba(236,72,153,0.4), rgba(251,191,36,0.3), rgba(168,85,247,0.4))',
            backgroundSize: '300% 300%',
            animation: 'suggestion-border-shift 4s ease infinite',
          }}
        >
          <div className="w-full h-full rounded-[11px] bg-zinc-950" />
        </div>

        {/* Content */}
        <div className="relative z-10 flex items-start gap-3 p-4">
          {/* Lightbulb icon */}
          <div className="shrink-0 mt-0.5">
            <div className="size-8 rounded-full bg-amber-500/10 flex items-center justify-center">
              <Lightbulb
                weight="fill"
                className="size-4.5 text-amber-400"
              />
            </div>
          </div>

          {/* Text + action */}
          <div className="flex-1 min-w-0">
            <p className="text-sm text-zinc-200 leading-snug">
              {current.text}
            </p>
            <button
              type="button"
              onClick={handleAction}
              className={cn(
                'mt-2 inline-flex items-center gap-1 text-xs font-medium',
                'text-fuchsia-400 hover:text-fuchsia-300 transition-colors',
              )}
            >
              {current.actionLabel}
              <ArrowRight weight="bold" className="size-3" />
            </button>
          </div>

          {/* Dismiss */}
          <button
            type="button"
            onClick={handleDismiss}
            className="shrink-0 text-zinc-600 hover:text-zinc-400 transition-colors mt-0.5"
            aria-label="Dismiss suggestion"
          >
            <X weight="bold" className="size-4" />
          </button>
        </div>

        {/* Suggestion count indicator */}
        {suggestions.length > 1 && (
          <div className="relative z-10 flex items-center justify-center gap-1 pb-3">
            {suggestions.map((_, i) => (
              <span
                key={i}
                className={cn(
                  'size-1 rounded-full transition-colors',
                  i === currentIndex % suggestions.length
                    ? 'bg-fuchsia-400'
                    : 'bg-zinc-700',
                )}
              />
            ))}
          </div>
        )}

        {/* Keyframes for animated gradient border */}
        <style>{`
          @keyframes suggestion-border-shift {
            0%, 100% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
          }
        `}</style>
      </motion.div>
    </AnimatePresence>
  )
}
