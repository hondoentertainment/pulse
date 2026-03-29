'use client'

import { useMemo, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MapPin,
  Lightning,
  TrendUp,
  Heart,
  Star,
  Question,
  ArrowDown,
  MagnifyingGlass,
} from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip'
import {
  getPersonalizedVenues,
  getVenueRecommendationReason,
} from '@/lib/personalization-engine'
import type { Venue, User, Pulse, EnergyRating } from '@/lib/types'
import type { ScoredVenue } from '@/lib/personalization-engine'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ForYouFeedProps {
  venues: Venue[]
  user: User
  pulses: Pulse[]
  userLocation: { lat: number; lng: number } | null
  onVenueClick: (venue: Venue) => void
  /** When set, only render this many venue cards (including the featured card). */
  limit?: number
}

// ---------------------------------------------------------------------------
// Energy helpers
// ---------------------------------------------------------------------------

const ENERGY_COLORS: Record<EnergyRating, string> = {
  dead: 'bg-zinc-600',
  chill: 'bg-emerald-500',
  buzzing: 'bg-amber-500',
  electric: 'bg-fuchsia-500',
}

const ENERGY_LABELS: Record<EnergyRating, string> = {
  dead: 'Dead',
  chill: 'Chill',
  buzzing: 'Buzzing',
  electric: 'Electric',
}

function pulseScoreToEnergy(score: number): EnergyRating {
  if (score >= 75) return 'electric'
  if (score >= 50) return 'buzzing'
  if (score >= 25) return 'chill'
  return 'dead'
}

// ---------------------------------------------------------------------------
// Stagger animation variants
// ---------------------------------------------------------------------------

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
    },
  },
}

const cardVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.97 } as const,
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring' as const, stiffness: 300, damping: 28 },
  },
}

// ---------------------------------------------------------------------------
// VenueCard
// ---------------------------------------------------------------------------

function VenueCard({
  scored,
  featured,
  onVenueClick,
}: {
  scored: ScoredVenue
  featured?: boolean
  onVenueClick: (venue: Venue) => void
}) {
  const { venue, personalScore, reasons, distance } = scored
  const energy = pulseScoreToEnergy(venue.pulseScore)
  const mainReason = getVenueRecommendationReason(scored)

  return (
    <motion.button
      variants={cardVariants}
      whileTap={{ scale: 0.98 }}
      onClick={() => onVenueClick(venue)}
      className={cn(
        'w-full text-left rounded-2xl border border-white/10 overflow-hidden transition-shadow',
        'hover:shadow-lg hover:shadow-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-500/50',
        featured
          ? 'bg-gradient-to-br from-fuchsia-950/60 via-violet-950/50 to-zinc-950/80 p-5'
          : 'bg-zinc-900/70 p-4',
      )}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3
            className={cn(
              'font-bold text-white truncate',
              featured ? 'text-xl' : 'text-base',
            )}
          >
            {venue.name}
          </h3>
          {venue.category && (
            <span className="text-xs text-zinc-400 capitalize">
              {venue.category}
            </span>
          )}
        </div>

        {/* Pulse score */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          <div className="flex items-center gap-1.5">
            <Lightning weight="fill" className="size-4 text-amber-400" />
            <span className="text-sm font-semibold text-white tabular-nums">
              {venue.pulseScore}
            </span>
          </div>
          {/* Energy indicator */}
          <div className="flex items-center gap-1.5">
            <span
              className={cn('size-2 rounded-full', ENERGY_COLORS[energy])}
            />
            <span className="text-[11px] text-zinc-400">
              {ENERGY_LABELS[energy]}
            </span>
          </div>
        </div>
      </div>

      {/* Reason badge + distance */}
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <Badge
          variant="secondary"
          className="bg-white/10 text-white/80 text-[11px] border-0"
        >
          <Star weight="fill" className="size-3 text-amber-400 mr-1" />
          {mainReason}
        </Badge>

        {distance !== undefined && (
          <span className="inline-flex items-center gap-1 text-[11px] text-zinc-500">
            <MapPin weight="bold" className="size-3" />
            {distance < 0.1 ? 'Here' : `${distance} mi`}
          </span>
        )}

        {/* "Why this?" tooltip */}
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="ml-auto inline-flex items-center gap-0.5 text-[11px] text-zinc-500 hover:text-zinc-300 cursor-help transition-colors">
              <Question weight="bold" className="size-3.5" />
              Why this?
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-64">
            <ul className="space-y-0.5 text-xs">
              {reasons.map((r, i) => (
                <li key={i} className="flex items-start gap-1">
                  <span className="text-fuchsia-400 mt-0.5">&#8226;</span>
                  {r}
                </li>
              ))}
              <li className="text-zinc-400 pt-1 border-t border-white/10">
                Personal score: {(personalScore * 100).toFixed(0)}%
              </li>
            </ul>
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Featured card extra content */}
      {featured && (
        <div className="mt-4 flex items-center gap-2 text-xs text-zinc-400">
          <TrendUp weight="bold" className="size-4 text-fuchsia-400" />
          <span>Top pick for you right now</span>
        </div>
      )}
    </motion.button>
  )
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 px-6 text-center"
    >
      <div className="size-16 rounded-full bg-zinc-800 flex items-center justify-center mb-4">
        <MagnifyingGlass weight="bold" className="size-7 text-zinc-500" />
      </div>
      <h3 className="text-lg font-semibold text-white mb-1">
        No recommendations yet
      </h3>
      <p className="text-sm text-zinc-400 max-w-xs">
        Tell us your preferences to get better recommendations. Check in at
        venues and follow your favorite categories.
      </p>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// ForYouFeed
// ---------------------------------------------------------------------------

export default function ForYouFeed({
  venues,
  user,
  pulses,
  userLocation,
  onVenueClick,
  limit,
}: ForYouFeedProps) {
  const [isRefreshing, setIsRefreshing] = useState(false)

  const scoredVenues = useMemo<ScoredVenue[]>(
    () =>
      getPersonalizedVenues({
        user,
        venues,
        pulses,
        userLocation,
        currentTime: new Date(),
      }),
    [user, venues, pulses, userLocation],
  )

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true)
    // Simulate refresh delay
    setTimeout(() => setIsRefreshing(false), 800)
  }, [])

  if (scoredVenues.length === 0) {
    return <EmptyState />
  }

  const limited = limit != null ? scoredVenues.slice(0, limit) : scoredVenues
  const [featured, ...rest] = limited

  return (
    <div className="flex flex-col gap-3">
      {/* Pull to refresh indicator */}
      <AnimatePresence>
        {isRefreshing && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 40, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex items-center justify-center"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
            >
              <ArrowDown weight="bold" className="size-5 text-fuchsia-400" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-lg font-bold text-white">For You</h2>
          <p className="text-xs text-zinc-500">
            {scoredVenues.length} venues curated for you
          </p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          className="text-xs text-fuchsia-400 hover:text-fuchsia-300 transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Venue list */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="flex flex-col gap-3"
      >
        {/* Featured card */}
        <VenueCard
          scored={featured}
          featured
          onVenueClick={onVenueClick}
        />

        {/* Remaining cards */}
        {rest.map((sv) => (
          <VenueCard
            key={sv.venue.id}
            scored={sv}
            onVenueClick={onVenueClick}
          />
        ))}
      </motion.div>
    </div>
  )
}
