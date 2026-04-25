import { useRef } from 'react'
import { motion } from 'framer-motion'
import { Users, User as UserIcon } from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'
import type { VenueTimelapse, CrowdLevel } from '@/lib/venue-storytelling'

interface VenueTimelapseGalleryProps {
  timelapse: VenueTimelapse[]
  currentTimeOfDay?: string
}

const CROWD_DOT_COUNTS: Record<CrowdLevel, number> = {
  empty: 1,
  sparse: 4,
  moderate: 9,
  packed: 16,
}

function CrowdGrid({ crowdLevel, color }: { crowdLevel: CrowdLevel; color: string }) {
  const total = 16
  const filled = CROWD_DOT_COUNTS[crowdLevel]

  return (
    <div className="grid grid-cols-4 gap-1 w-10 h-10">
      {Array.from({ length: total }, (_, i) => (
        <motion.div
          key={i}
          className="rounded-full"
          initial={{ scale: 0, opacity: 0 }}
          animate={
            i < filled
              ? { scale: 1, opacity: 1, backgroundColor: color }
              : { scale: 0.5, opacity: 0.15, backgroundColor: 'oklch(0.4 0 0)' }
          }
          transition={{ delay: i * 0.03, type: 'spring', stiffness: 300, damping: 20 }}
          style={{ width: 6, height: 6 }}
        />
      ))}
    </div>
  )
}

function CrowdLabel({ crowdLevel }: { crowdLevel: CrowdLevel }) {
  const labels: Record<CrowdLevel, string> = {
    empty: 'Empty',
    sparse: 'Sparse',
    moderate: 'Moderate',
    packed: 'Packed',
  }
  const Icon = crowdLevel === 'packed' ? Users : UserIcon
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
      <Icon size={10} weight="fill" />
      {labels[crowdLevel]}
    </span>
  )
}

export function VenueTimelapseGallery({
  timelapse,
  currentTimeOfDay,
}: VenueTimelapseGalleryProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  return (
    <div className="relative">
      {/* Horizontal scrollable container */}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {timelapse.map((slot, index) => {
          const isCurrent = currentTimeOfDay
            ? slot.timeOfDay.toLowerCase() === currentTimeOfDay.toLowerCase()
            : false

          return (
            <motion.div
              key={slot.timeOfDay}
              className="snap-center shrink-0"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08 }}
            >
              <div
                className={[
                  'relative w-48 rounded-xl border p-3 flex flex-col gap-2.5',
                  'bg-card/60 backdrop-blur-sm',
                  isCurrent
                    ? 'border-accent shadow-[0_0_16px_rgba(255,255,255,0.08)]'
                    : 'border-border/50',
                ].join(' ')}
                style={
                  isCurrent
                    ? { boxShadow: `0 0 20px ${slot.color}30, 0 0 4px ${slot.color}20` }
                    : undefined
                }
              >
                {/* Current indicator */}
                {isCurrent && (
                  <motion.div
                    className="absolute -top-1.5 left-1/2 -translate-x-1/2 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: slot.color, color: 'oklch(0.15 0 0)' }}
                    layoutId="current-time-indicator"
                  >
                    Now
                  </motion.div>
                )}

                {/* Time + Energy badge row */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">
                    {slot.timeOfDay}
                  </span>
                  <Badge
                    variant="outline"
                    className="text-[9px] border-0 font-bold px-1.5 py-0"
                    style={{
                      color: slot.color,
                      backgroundColor: `${slot.color}18`,
                    }}
                  >
                    {slot.energyLabel}
                  </Badge>
                </div>

                {/* Crowd visualization */}
                <div className="flex items-center gap-2.5">
                  <CrowdGrid crowdLevel={slot.crowdLevel} color={slot.color} />
                  <CrowdLabel crowdLevel={slot.crowdLevel} />
                </div>

                {/* Description */}
                <p className="text-[11px] leading-relaxed text-muted-foreground line-clamp-3">
                  {slot.description}
                </p>
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Fade edges */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-4 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-4 bg-gradient-to-l from-background to-transparent" />
    </div>
  )
}
