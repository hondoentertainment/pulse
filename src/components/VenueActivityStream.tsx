import { useState, useEffect, useCallback, useRef } from 'react'
import { cn } from '@/lib/utils'
import { MapPin, Lightning, Users, TrendUp } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'

interface VenueActivityStreamProps {
  venueId: string
  venueName: string
}

interface ActivityItem {
  id: string
  text: string
  timestamp: string
  type: 'checkin' | 'rating' | 'arrival' | 'energy'
  avatarColor: string
  avatarInitial: string
}

const FIRST_NAMES = [
  'Sarah', 'Mike', 'Emma', 'Jake', 'Olivia', 'Liam', 'Ava', 'Noah',
  'Mia', 'Alex', 'Chloe', 'Ryan', 'Zoe', 'Tyler', 'Luna', 'Kai',
]

const RATING_WORDS = ['Electric', 'Buzzing', 'Vibing', 'Chill', 'Fire']

const AVATAR_COLORS = [
  'bg-gradient-to-br from-violet-400 to-purple-600',
  'bg-gradient-to-br from-pink-400 to-rose-600',
  'bg-gradient-to-br from-blue-400 to-indigo-600',
  'bg-gradient-to-br from-emerald-400 to-teal-600',
  'bg-gradient-to-br from-amber-400 to-orange-600',
  'bg-gradient-to-br from-cyan-400 to-blue-600',
  'bg-gradient-to-br from-fuchsia-400 to-pink-600',
]

function getActivityIcon(type: ActivityItem['type']) {
  switch (type) {
    case 'checkin':
      return <MapPin size={12} weight="fill" className="text-green-400" />
    case 'rating':
      return <Lightning size={12} weight="fill" className="text-yellow-400" />
    case 'arrival':
      return <Users size={12} weight="fill" className="text-blue-400" />
    case 'energy':
      return <TrendUp size={12} weight="fill" className="text-orange-400" />
  }
}

function createSeededRandom(seed: string) {
  let s = 0
  for (let i = 0; i < seed.length; i++) {
    s = ((s << 5) - s + seed.charCodeAt(i)) | 0
  }
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s & 0x7fffffff) / 2147483647
  }
}

function generateActivity(venueId: string, index: number): ActivityItem {
  const random = createSeededRandom(venueId + index.toString())
  const types: ActivityItem['type'][] = ['checkin', 'rating', 'arrival', 'energy']
  const type = types[Math.floor(random() * types.length)]
  const name = FIRST_NAMES[Math.floor(random() * FIRST_NAMES.length)]
  const color = AVATAR_COLORS[Math.floor(random() * AVATAR_COLORS.length)]

  const minutesAgo = Math.floor(random() * 10) + 1

  let text: string
  switch (type) {
    case 'checkin':
      // Skip — don't fabricate check-in activity
      text = `${name} rated it ${RATING_WORDS[Math.floor(random() * RATING_WORDS.length)]} ${String.fromCodePoint(0x26A1)}`
      break
    case 'rating':
      text = `${name} rated it ${RATING_WORDS[Math.floor(random() * RATING_WORDS.length)]} ${String.fromCodePoint(0x26A1)}`
      break
    case 'arrival':
      // Skip — don't fabricate arrival counts
      text = 'Energy just went up!'
      break
    case 'energy':
      text = 'Energy just went up!'
      break
  }

  return {
    id: `${venueId}-activity-${index}-${Date.now()}`,
    text,
    timestamp: `${minutesAgo}m`,
    type,
    avatarColor: color,
    avatarInitial: type === 'arrival' || type === 'energy' ? '' : name[0],
  }
}

export function VenueActivityStream({ venueId, venueName: _venueName }: VenueActivityStreamProps) {
  const maxVisible = 4
  const activityCounter = useRef(0)

  const [activities, setActivities] = useState<ActivityItem[]>(() => {
    const initial: ActivityItem[] = []
    for (let i = 0; i < maxVisible; i++) {
      initial.push(generateActivity(venueId, activityCounter.current++))
    }
    return initial
  })

  const addActivity = useCallback(() => {
    const newItem = generateActivity(venueId, activityCounter.current++)
    setActivities((prev) => {
      const updated = [newItem, ...prev]
      return updated.slice(0, maxVisible)
    })
  }, [venueId])

  useEffect(() => {
    const interval = setInterval(addActivity, 8000)
    return () => clearInterval(interval)
  }, [addActivity])

  // Reset when venue changes
  useEffect(() => {
    activityCounter.current = 0
    const initial: ActivityItem[] = []
    for (let i = 0; i < maxVisible; i++) {
      initial.push(generateActivity(venueId, activityCounter.current++))
    }
    setActivities(initial)
  }, [venueId])

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 mb-2">
        <motion.div
          className="w-1.5 h-1.5 rounded-full bg-green-400"
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
        />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Live Activity
        </span>
      </div>

      <div className="space-y-0.5 overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false}>
          {activities.map((item, index) => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, x: 40, height: 0 }}
              animate={{ opacity: 1, x: 0, height: 'auto' }}
              exit={{ opacity: 0, x: -20, height: 0 }}
              transition={{
                layout: { type: 'spring', stiffness: 300, damping: 30 },
                opacity: { duration: 0.25 },
                x: { type: 'spring', stiffness: 300, damping: 30 },
                height: { duration: 0.2 },
                delay: index * 0.05,
              }}
              className="flex items-center gap-2.5 py-1.5 px-2 rounded-lg"
            >
              {/* Avatar / icon */}
              {item.avatarInitial ? (
                <div
                  className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0',
                    item.avatarColor
                  )}
                >
                  {item.avatarInitial}
                </div>
              ) : (
                <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                  {getActivityIcon(item.type)}
                </div>
              )}

              {/* Text */}
              <span className="text-xs text-foreground/80 flex-1 truncate">
                {item.text}
              </span>

              {/* Timestamp + type icon */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {getActivityIcon(item.type)}
                <span className="text-[10px] text-muted-foreground font-mono">
                  {item.timestamp}
                </span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
