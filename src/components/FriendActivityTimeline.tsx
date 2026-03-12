import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { MapPin, Pulse, HeartStraight, UsersFour } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { ENERGY_CONFIG } from '@/lib/types'
import { formatTimeAgo } from '@/lib/pulse-engine'
import type { FriendActivityEntry } from '@/lib/social-coordination'

interface FriendActivityTimelineProps {
  entries: FriendActivityEntry[]
  onVenueTap: (venueId: string) => void
}

type DayGroup = 'Today' | 'Yesterday' | 'This Week'

function getDayGroup(timestamp: string): DayGroup {
  const now = new Date()
  const date = new Date(timestamp)

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000)

  if (date >= todayStart) return 'Today'
  if (date >= yesterdayStart) return 'Yesterday'
  return 'This Week'
}

const ACTION_CONFIG = {
  check_in: {
    icon: MapPin,
    color: 'text-green-400',
    dotColor: 'bg-green-400',
    label: 'checked in at',
  },
  pulse: {
    icon: Pulse,
    color: 'text-purple-400',
    dotColor: 'bg-purple-400',
    label: 'pulsed at',
  },
  reaction: {
    icon: HeartStraight,
    color: 'text-pink-400',
    dotColor: 'bg-pink-400',
    label: 'reacted to a pulse at',
  },
} as const

export function FriendActivityTimeline({
  entries,
  onVenueTap,
}: FriendActivityTimelineProps) {
  const grouped = useMemo(() => {
    const groups: Record<DayGroup, FriendActivityEntry[]> = {
      Today: [],
      Yesterday: [],
      'This Week': [],
    }

    for (const entry of entries) {
      const group = getDayGroup(entry.timestamp)
      groups[group].push(entry)
    }

    return groups
  }, [entries])

  const dayOrder: DayGroup[] = ['Today', 'Yesterday', 'This Week']
  const hasEntries = entries.length > 0

  if (!hasEntries) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
        <UsersFour size={48} weight="thin" className="text-muted-foreground/40 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">
          Your friends haven't been out yet this week
        </p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          Activity from your friends will show up here
        </p>
      </div>
    )
  }

  let globalIndex = 0

  return (
    <div className="space-y-5">
      {dayOrder.map(day => {
        const dayEntries = grouped[day]
        if (dayEntries.length === 0) return null

        return (
          <div key={day} className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1 mb-2">
              {day}
            </p>

            <div className="relative">
              {/* Vertical timeline line */}
              <div className="absolute left-[19px] top-3 bottom-3 w-px bg-border/50" />

              <div className="space-y-0.5">
                {dayEntries.map(entry => {
                  const config = ACTION_CONFIG[entry.action]
                  const Icon = config.icon
                  const idx = globalIndex++

                  return (
                    <motion.div
                      key={`${entry.userId}-${entry.venueId}-${entry.timestamp}`}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        delay: idx * 0.04,
                        type: 'spring',
                        stiffness: 300,
                        damping: 25,
                      }}
                      className="relative flex items-start gap-3 py-2 px-1"
                    >
                      {/* Timeline dot */}
                      <div className="relative z-10 shrink-0">
                        <Avatar className="h-9 w-9 border-2 border-card">
                          <AvatarImage src={entry.profilePhoto} />
                          <AvatarFallback className="bg-muted text-[10px]">
                            {entry.username.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span
                          className={cn(
                            'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card',
                            config.dotColor
                          )}
                        />
                      </div>

                      {/* Entry content */}
                      <div className="flex-1 min-w-0 pt-0.5">
                        <p className="text-xs leading-snug">
                          <span className="font-semibold text-foreground">
                            {entry.username}
                          </span>{' '}
                          <span className="text-muted-foreground">{config.label}</span>{' '}
                          <button
                            onClick={() => onVenueTap(entry.venueId)}
                            className="font-medium text-foreground hover:text-accent transition-colors"
                          >
                            {entry.venueName}
                          </button>
                        </p>

                        <div className="flex items-center gap-2 mt-0.5">
                          <Icon size={11} weight="fill" className={config.color} />
                          {entry.energyRating && (
                            <span
                              className="text-[10px] font-medium"
                              style={{ color: ENERGY_CONFIG[entry.energyRating].color }}
                            >
                              {ENERGY_CONFIG[entry.energyRating].emoji}{' '}
                              {ENERGY_CONFIG[entry.energyRating].label}
                            </span>
                          )}
                          <span className="text-[10px] text-muted-foreground/60">
                            {formatTimeAgo(entry.timestamp)}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
