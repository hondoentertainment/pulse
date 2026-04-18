import { useState, useEffect, useRef, useCallback } from 'react'
import type { Venue, Pulse, EnergyRating } from '@/lib/types'
import {
  type ActivityEvent,
  type ActivityEventType,
  formatActivityMessage,
  filterDecayedEvents,
  deduplicateEvents,
  prioritizeEvents,
  enforceMaxEvents,
} from '@/lib/live-activity-feed'

const MAX_EVENTS = 50
const MIN_INTERVAL = 5000
const MAX_INTERVAL = 15000

const EVENT_TYPES: ActivityEventType[] = [
  'checkin',
  'surge',
  'event_starting',
  'trending',
  'happy_hour',
]

const EVENT_NAMES = [
  'DJ set',
  'Live music',
  'Open mic night',
  'Trivia night',
  'Ladies night',
]

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function generateId(): string {
  return `laf_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

function pickRandom<T>(arr: readonly T[]): T {
  return arr[randomInt(0, arr.length - 1)]
}

function generateSimulatedEvent(venues: Venue[]): ActivityEvent | null {
  if (venues.length === 0) return null

  const venue = pickRandom(venues)
  const type = pickRandom(EVENT_TYPES)
  const now = Date.now()

  const base: ActivityEvent = {
    id: generateId(),
    type,
    venueId: venue.id,
    venueName: venue.name,
    timestamp: now,
    message: '',
    priority: 2,
  }

  switch (type) {
    case 'checkin': {
      const count = randomInt(2, 8)
      base.count = count
      base.priority = 2
      break
    }
    case 'surge': {
      const energyOptions: EnergyRating[] = ['buzzing', 'electric']
      base.energyRating = pickRandom(energyOptions)
      base.priority = 3
      break
    }
    case 'event_starting': {
      const eventName = pickRandom(EVENT_NAMES)
      const minutes = pickRandom([15, 30, 45])
      base.priority = 3
      base.message = `${eventName} starting at ${venue.name} in ${minutes} min`
      break
    }
    case 'trending': {
      base.priority = 2
      break
    }
    case 'happy_hour': {
      base.priority = 1
      break
    }
  }

  if (!base.message) {
    base.message = formatActivityMessage(base)
  }

  return base
}

interface UseLiveActivityFeedOptions {
  venues: Venue[]
  pulses?: Pulse[]
  enabled?: boolean
}

interface UseLiveActivityFeedReturn {
  events: ActivityEvent[]
  latestEvent: ActivityEvent | null
  isLive: boolean
  pauseFeed: () => void
  resumeFeed: () => void
}

export function useLiveActivityFeed({
  venues,
  enabled = true,
}: UseLiveActivityFeedOptions): UseLiveActivityFeedReturn {
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [paused, setPaused] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const venuesRef = useRef(venues)

  useEffect(() => {
    venuesRef.current = venues
  }, [venues])

  const addEvent = useCallback((event: ActivityEvent) => {
    setEvents((prev) => {
      const next = [...prev, event]
      const deduped = deduplicateEvents(next)
      const decayed = filterDecayedEvents(deduped)
      const prioritized = prioritizeEvents(decayed)
      return enforceMaxEvents(prioritized, MAX_EVENTS)
    })
  }, [])

  const pauseFeed = useCallback(() => {
    setPaused(true)
  }, [])

  const resumeFeed = useCallback(() => {
    setPaused(false)
  }, [])

  useEffect(() => {
    if (!enabled || paused || venuesRef.current.length === 0) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      return
    }

    const scheduleNext = () => {
      const delay = randomInt(MIN_INTERVAL, MAX_INTERVAL)
      timeoutRef.current = setTimeout(() => {
        const event = generateSimulatedEvent(venuesRef.current)
        if (event) {
          addEvent(event)
        }
        scheduleNext()
      }, delay)
    }

    scheduleNext()

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [enabled, paused, addEvent])

  const latestEvent = events.length > 0 ? events[events.length - 1] : null
  const isLive = enabled && !paused

  return {
    events,
    latestEvent,
    isLive,
    pauseFeed,
    resumeFeed,
  }
}
