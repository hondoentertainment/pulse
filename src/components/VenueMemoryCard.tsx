'use client'

import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Clock, CalendarBlank, Lightning, ArrowCounterClockwise, X } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { ENERGY_CONFIG } from '@/lib/types'
import type { Venue, User, Pulse, EnergyRating } from '@/lib/types'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface VenueMemoryCardProps {
  venue: Venue
  user: User
  pulses: Pulse[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then

  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`

  const weeks = Math.floor(days / 7)
  if (weeks < 4) return `${weeks}w ago`

  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`

  const years = Math.floor(days / 365)
  return `${years}y ago`
}

const DAY_NAMES = [
  'Sundays',
  'Mondays',
  'Tuesdays',
  'Wednesdays',
  'Thursdays',
  'Fridays',
  'Saturdays',
] as const

function getEnergyAccentColor(energy: EnergyRating): string {
  switch (energy) {
    case 'dead':
      return 'border-l-zinc-600'
    case 'chill':
      return 'border-l-emerald-500'
    case 'buzzing':
      return 'border-l-amber-500'
    case 'electric':
      return 'border-l-fuchsia-500'
  }
}

// ---------------------------------------------------------------------------
// Sparkline component
// ---------------------------------------------------------------------------

function Sparkline({ data, className }: { data: number[]; className?: string }) {
  if (data.length < 2) return null

  const max = Math.max(...data, 1)
  const width = 80
  const height = 24
  const step = width / (data.length - 1)

  const points = data
    .map((v, i) => `${i * step},${height - (v / max) * height}`)
    .join(' ')

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={cn('overflow-visible', className)}
      fill="none"
    >
      <polyline
        points={points}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// VenueMemoryCard
// ---------------------------------------------------------------------------

export default function VenueMemoryCard({
  venue,
  user,
  pulses,
}: VenueMemoryCardProps) {
  const [dismissed, setDismissed] = useState(false)

  // Compute memory data from pulses
  const memoryData = useMemo(() => {
    const visitCount = user.venueCheckInHistory?.[venue.id] ?? 0
    if (visitCount === 0) return null

    // User's pulses at this venue
    const userPulses = pulses
      .filter((p) => p.venueId === venue.id && p.userId === user.id)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )

    if (userPulses.length === 0) return null

    const lastPulse = userPulses[0]
    const lastEnergy = lastPulse.energyRating

    // Favorite day of the week
    const dayCounts = new Array(7).fill(0)
    for (const p of userPulses) {
      const day = new Date(p.createdAt).getDay()
      dayCounts[day]++
    }
    const favDayIndex = dayCounts.indexOf(Math.max(...dayCounts))
    const favoriteDay = DAY_NAMES[favDayIndex]

    // Visit frequency sparkline: last 8 weeks, count pulses per week
    const eightWeeksAgo = Date.now() - 8 * 7 * 24 * 60 * 60 * 1000
    const recentPulses = userPulses.filter(
      (p) => new Date(p.createdAt).getTime() > eightWeeksAgo,
    )
    const weekBuckets = new Array(8).fill(0)
    for (const p of recentPulses) {
      const weekIndex = Math.min(
        7,
        Math.floor(
          (Date.now() - new Date(p.createdAt).getTime()) /
            (7 * 24 * 60 * 60 * 1000),
        ),
      )
      weekBuckets[7 - weekIndex]++
    }

    return {
      visitCount,
      lastVisit: lastPulse.createdAt,
      lastEnergy,
      favoriteDay,
      sparklineData: weekBuckets,
    }
  }, [venue.id, user.id, user.venueCheckInHistory, pulses])

  // Don't render if user hasn't visited
  if (!memoryData) return null

  const accentClass = getEnergyAccentColor(memoryData.lastEnergy)
  const energyConfig = ENERGY_CONFIG[memoryData.lastEnergy]

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.div
          initial={{ opacity: 0, x: -32 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -32, height: 0, marginBottom: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          className={cn(
            'relative rounded-xl border border-white/10 bg-zinc-900/70 backdrop-blur-sm',
            'border-l-[3px] p-4',
            accentClass,
          )}
        >
          {/* Dismiss button */}
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="absolute top-3 right-3 text-zinc-600 hover:text-zinc-400 transition-colors"
            aria-label="Dismiss"
          >
            <X weight="bold" className="size-4" />
          </button>

          {/* Header */}
          <div className="flex items-center gap-2 mb-3">
            <Clock weight="bold" className="size-4 text-zinc-400" />
            <span className="text-sm font-medium text-white">
              You were here {timeAgo(memoryData.lastVisit)}
            </span>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-3">
            {/* Last energy */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500">
                Last energy
              </span>
              <div className="flex items-center gap-1.5">
                <Lightning weight="fill" className="size-3.5" style={{ color: energyConfig.color }} />
                <span className="text-xs text-zinc-300">
                  {energyConfig.label}
                </span>
              </div>
            </div>

            {/* Total visits */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500">
                Visits
              </span>
              <div className="flex items-center gap-1.5">
                <ArrowCounterClockwise weight="bold" className="size-3.5 text-zinc-400" />
                <span className="text-xs text-zinc-300">
                  {memoryData.visitCount} times
                </span>
              </div>
            </div>

            {/* Favorite day */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500">
                Fav day
              </span>
              <div className="flex items-center gap-1.5">
                <CalendarBlank weight="bold" className="size-3.5 text-zinc-400" />
                <span className="text-xs text-zinc-300">
                  {memoryData.favoriteDay}
                </span>
              </div>
            </div>
          </div>

          {/* Sparkline */}
          {memoryData.sparklineData.some((v) => v > 0) && (
            <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-2">
              <span className="text-[10px] text-zinc-500 shrink-0">
                8-week activity
              </span>
              <Sparkline
                data={memoryData.sparklineData}
                className="w-20 h-6 text-fuchsia-400"
              />
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
