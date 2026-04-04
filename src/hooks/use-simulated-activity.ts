import { useState, useEffect, useRef, useCallback } from "react"
import type { Venue } from "@/lib/types"

export interface Activity {
  id: string
  type: "checkin" | "trending" | "friend_nearby" | "energy_change"
  message: string
  venueId?: string
  venueName?: string
  timestamp: number
}

const _FRIEND_NAMES = [
  "Sarah",
  "Mike",
  "Alex",
  "Jordan",
  "Taylor",
  "Casey",
  "Riley",
  "Morgan",
  "Jamie",
  "Sam",
]

const ENERGY_LEVELS = ["Buzzing", "Electric"] as const

const MAX_ACTIVITIES = 10
const MIN_INTERVAL = 15000
const MAX_INTERVAL = 30000

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function generateId(): string {
  return `act_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

function generateActivity(venues: Venue[]): Activity | null {
  if (venues.length === 0) return null

  const venue = venues[randomInt(0, venues.length - 1)]
  const type = (
    ["checkin", "trending", "friend_nearby", "energy_change"] as const
  )[randomInt(0, 3)]

  let message: string

  switch (type) {
    case "checkin": {
      // Skip — don't fabricate check-in counts
      return null
    }
    case "trending": {
      message = `${venue.name} is now trending!`
      break
    }
    case "friend_nearby": {
      // Skip — don't fabricate friend proximity
      return null
    }
    case "energy_change": {
      const energy = ENERGY_LEVELS[randomInt(0, ENERGY_LEVELS.length - 1)]
      message = `Energy surge at ${venue.name} - now ${energy}!`
      break
    }
  }

  return {
    id: generateId(),
    type,
    message,
    venueId: venue.id,
    venueName: venue.name,
    timestamp: Date.now(),
  }
}

interface UseSimulatedActivityOptions {
  venues: Venue[]
  enabled?: boolean
}

interface UseSimulatedActivityReturn {
  activities: Activity[]
  addActivity: (activity: Activity) => void
  clearActivity: (id: string) => void
  pause: () => void
  resume: () => void
}

export function useSimulatedActivity({
  venues,
  enabled = true,
}: UseSimulatedActivityOptions): UseSimulatedActivityReturn {
  const [activities, setActivities] = useState<Activity[]>([])
  const [paused, setPaused] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const venuesRef = useRef(venues)

  // Keep venues ref up to date
  useEffect(() => {
    venuesRef.current = venues
  }, [venues])

  const addActivity = useCallback((activity: Activity) => {
    setActivities((prev) => {
      const next = [...prev, activity]
      return next.slice(-MAX_ACTIVITIES)
    })
  }, [])

  const clearActivity = useCallback((id: string) => {
    setActivities((prev) => prev.filter((a) => a.id !== id))
  }, [])

  const pause = useCallback(() => {
    setPaused(true)
  }, [])

  const resume = useCallback(() => {
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
        const activity = generateActivity(venuesRef.current)
        if (activity) {
          addActivity(activity)
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
  }, [enabled, paused, addActivity])

  return {
    activities,
    addActivity,
    clearActivity,
    pause,
    resume,
  }
}
