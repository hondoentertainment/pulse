"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Users, TrendUp, MapPin, Lightning } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"

interface Activity {
  id: string
  type: "checkin" | "trending" | "friend_nearby" | "energy_change"
  message: string
  venueId?: string
  timestamp: number
}

interface LiveActivityToastProps {
  activities: Activity[]
  onActivityClick?: (activity: Activity) => void
}

const MAX_TOASTS = 3
const TOAST_DURATION = 4000

const TYPE_CONFIG: Record<
  Activity["type"],
  {
    icon: typeof Users
    borderColor: string
    iconColor: string
  }
> = {
  checkin: {
    icon: Users,
    borderColor: "from-blue-500 to-blue-400",
    iconColor: "text-blue-400",
  },
  trending: {
    icon: TrendUp,
    borderColor: "from-amber-500 to-amber-400",
    iconColor: "text-amber-400",
  },
  friend_nearby: {
    icon: MapPin,
    borderColor: "from-green-500 to-green-400",
    iconColor: "text-green-400",
  },
  energy_change: {
    icon: Lightning,
    borderColor: "from-purple-500 to-purple-400",
    iconColor: "text-purple-400",
  },
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 5) return "just now"
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  return `${minutes}m ago`
}

function ToastItem({
  activity,
  onDismiss,
  onClick,
}: {
  activity: Activity
  onDismiss: (id: string) => void
  onClick?: (activity: Activity) => void
}) {
  const config = TYPE_CONFIG[activity.type]
  const Icon = config.icon
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      onDismiss(activity.id)
    }, TOAST_DURATION)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [activity.id, onDismiss])

  return (
    <motion.div
      layout
      initial={{ x: 320, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 320, opacity: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      onClick={() => onClick?.(activity)}
      className={cn(
        "relative overflow-hidden rounded-lg w-72",
        "bg-card/95 backdrop-blur-md shadow-lg",
        "border border-white/10",
        onClick && "cursor-pointer hover:bg-card/100"
      )}
    >
      {/* Gradient left border */}
      <div
        className={cn(
          "absolute left-0 top-0 bottom-0 w-1",
          "bg-gradient-to-b",
          config.borderColor
        )}
      />

      <div className="flex items-start gap-2.5 p-3 pl-4">
        <div className={cn("shrink-0 mt-0.5", config.iconColor)}>
          <Icon size={18} weight="fill" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-foreground leading-snug line-clamp-2">
            {activity.message}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {formatTimeAgo(activity.timestamp)}
          </p>
        </div>
      </div>

      {/* Timer bar */}
      <motion.div
        initial={{ scaleX: 1 }}
        animate={{ scaleX: 0 }}
        transition={{ duration: TOAST_DURATION / 1000, ease: "linear" }}
        className={cn(
          "absolute bottom-0 left-0 right-0 h-0.5 origin-left",
          "bg-gradient-to-r",
          config.borderColor
        )}
      />
    </motion.div>
  )
}

export default function LiveActivityToast({
  activities,
  onActivityClick,
}: LiveActivityToastProps) {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(
    () => new Set()
  )

  const visibleActivities = activities
    .filter((a) => !dismissedIds.has(a.id))
    .slice(-MAX_TOASTS)

  const handleDismiss = useCallback((id: string) => {
    setDismissedIds((prev) => {
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }, [])

  // Clean up old dismissed IDs when activities change
  useEffect(() => {
    const activeIds = new Set(activities.map((a) => a.id))
    setDismissedIds((prev) => {
      const next = new Set<string>()
      prev.forEach((id) => {
        if (activeIds.has(id)) next.add(id)
      })
      return next
    })
  }, [activities])

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 items-end">
      <AnimatePresence mode="popLayout">
        {visibleActivities.map((activity) => (
          <ToastItem
            key={activity.id}
            activity={activity}
            onDismiss={handleDismiss}
            onClick={onActivityClick}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}
