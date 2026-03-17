import { useState, useRef, useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { MapPin, Lightning, MusicNote, TrendUp, Beer } from '@phosphor-icons/react'
import type { Venue, Pulse } from '@/lib/types'
import type { ActivityEvent, ActivityEventType } from '@/lib/live-activity-feed'
import { useLiveActivityFeed } from '@/hooks/use-live-activity-feed'

function getRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diffMs = now - timestamp
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)

  if (diffSeconds < 10) return 'just now'
  if (diffSeconds < 60) return `${diffSeconds}s ago`
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  return `${diffHours}h ago`
}

function getEventIcon(type: ActivityEventType) {
  switch (type) {
    case 'checkin':
      return <MapPin size={16} weight="fill" />
    case 'surge':
      return <Lightning size={16} weight="fill" />
    case 'event_starting':
      return <MusicNote size={16} weight="fill" />
    case 'trending':
      return <TrendUp size={16} weight="fill" />
    case 'happy_hour':
      return <Beer size={16} weight="fill" />
  }
}

function getEnergyDotColor(event: ActivityEvent): string {
  if (event.energyRating === 'electric') return 'bg-purple-500'
  if (event.energyRating === 'buzzing') return 'bg-amber-500'
  if (event.type === 'surge') return 'bg-red-500'
  if (event.priority >= 3) return 'bg-orange-500'
  return 'bg-green-500'
}

interface LiveActivityFeedProps {
  venues: Venue[]
  events?: Record<string, string>[]
  pulses?: Pulse[]
  onVenueTap?: (venueId: string) => void
  compact?: boolean
}

export function LiveActivityFeed({
  venues,
  pulses,
  onVenueTap,
  compact = true,
}: LiveActivityFeedProps) {
  const { events, isLive, pauseFeed, resumeFeed } =
    useLiveActivityFeed({ venues, pulses, enabled: true })

  const [userScrolled, setUserScrolled] = useState(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current
    if (!el) return
    const isAtTop = el.scrollTop < 50
    setUserScrolled(!isAtTop)
  }, [])

  // Auto-scroll to top when new events arrive (unless user has scrolled)
  useEffect(() => {
    if (!userScrolled && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo?.({ top: 0, behavior: 'smooth' })
    }
  }, [events.length, userScrolled])

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
          <Lightning size={24} className="text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground text-center">
          No activity nearby — check back soon
        </p>
      </div>
    )
  }

  return (
    <div className="w-full">
      {/* Header with live indicator */}
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-2">
          <span
            data-testid="live-indicator"
            className={`inline-block w-2 h-2 rounded-full ${
              isLive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
            }`}
          />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {isLive ? 'Live' : 'Paused'}
          </span>
        </div>
        <button
          onClick={isLive ? pauseFeed : resumeFeed}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {isLive ? 'Pause' : 'Resume'}
        </button>
      </div>

      {/* Scrolling feed */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="overflow-y-auto max-h-96 px-2"
      >
        <AnimatePresence initial={false}>
          {events.map((event) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: -20, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              <button
                onClick={() => onVenueTap?.(event.venueId)}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors flex items-start gap-3"
              >
                {/* Icon */}
                <div className="flex-shrink-0 mt-0.5 text-muted-foreground">
                  {getEventIcon(event.type)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {compact ? (
                    <p className="text-sm truncate">{event.message}</p>
                  ) : (
                    <div>
                      <p className="text-sm font-medium">{event.venueName}</p>
                      <p className="text-sm text-muted-foreground">
                        {event.message}
                      </p>
                    </div>
                  )}
                </div>

                {/* Right side: time + energy dot */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {getRelativeTime(event.timestamp)}
                  </span>
                  <span
                    className={`inline-block w-1.5 h-1.5 rounded-full ${getEnergyDotColor(event)}`}
                  />
                </div>
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
