import type { Venue } from '@/lib/types'
import { getTimeContextualLabel } from '@/lib/contextual-intelligence'
import { getTimeOfDay, getDayType } from '@/lib/time-contextual-scoring'
import { ClockAfternoon } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'

interface TimeContextualLabelProps {
  venue: Venue
  /** Override the current date for testing / storybook */
  date?: Date
}

/**
 * A compact badge/pill that shows a time-contextual label for a venue.
 * Fades + slides in with Framer Motion. Uses golden color for peak-hour
 * labels and a muted style for off-peak.
 */
export function TimeContextualLabel({ venue, date }: TimeContextualLabelProps) {
  const now = date ?? new Date()
  const timeOfDay = getTimeOfDay(now)
  const dayType = getDayType(now)
  const label = getTimeContextualLabel(venue, timeOfDay, dayType)

  if (!label) return null

  // Peak labels get a warm golden treatment; others get a muted style
  const isPeak = label.toLowerCase().includes('peak') || label.toLowerCase().includes('happy hour')

  return (
    <AnimatePresence>
      <motion.span
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -8 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className={`
          inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium
          ${
            isPeak
              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
              : 'bg-muted/60 text-muted-foreground border border-border/50'
          }
        `}
      >
        <ClockAfternoon
          size={11}
          weight="fill"
          className={isPeak ? 'text-amber-400' : 'text-muted-foreground'}
        />
        {label}
      </motion.span>
    </AnimatePresence>
  )
}
