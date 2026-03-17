import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Lightning } from '@phosphor-icons/react'
import type { ActiveBoost, BoostAnalytics } from '@/lib/venue-quick-boost'
import {
  BOOST_CONFIGS,
  getBoostTimeRemaining,
  simulateBoostAnalytics,
} from '@/lib/venue-quick-boost'

interface BoostStatusBadgeProps {
  boost: ActiveBoost
  venuePulseScore: number
  onTap?: (boost: ActiveBoost, analytics: BoostAnalytics) => void
}

/**
 * Inline badge showing active boost type + time remaining.
 * Features a pulsing glow animation matching the boost color.
 * Tap to reveal boost analytics.
 */
export function BoostStatusBadge({ boost, venuePulseScore, onTap }: BoostStatusBadgeProps) {
  const [timeRemaining, setTimeRemaining] = useState(() => getBoostTimeRemaining(boost))

  const config = BOOST_CONFIGS[boost.type]

  const analytics = useMemo(
    () => simulateBoostAnalytics(boost, venuePulseScore),
    [boost, venuePulseScore]
  )

  // Countdown timer
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeRemaining(getBoostTimeRemaining(boost))
    }, 1000)
    return () => clearInterval(interval)
  }, [boost])

  const formatTime = (ms: number): string => {
    if (ms <= 0) return 'Ended'
    const totalSeconds = Math.floor(ms / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    if (hours > 0) return `${hours}h ${minutes}m`
    if (minutes > 0) return `${minutes}m ${seconds}s`
    return `${seconds}s`
  }

  const isExpired = timeRemaining <= 0

  const handleTap = () => {
    onTap?.(boost, analytics)
  }

  return (
    <motion.button
      onClick={handleTap}
      whileTap={{ scale: 0.95 }}
      className="relative inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium transition-colors"
      style={{
        backgroundColor: `color-mix(in oklch, ${config.pinColor} 20%, transparent)`,
        color: config.pinColor,
      }}
    >
      {/* Pulsing glow */}
      {!isExpired && (
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            backgroundColor: `color-mix(in oklch, ${config.pinColor} 15%, transparent)`,
          }}
          animate={{
            scale: [1, 1.15, 1],
            opacity: [0.6, 0, 0.6],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      )}

      <Lightning size={10} weight="fill" />
      <span className="relative z-10">{config.badgeText}</span>
      <span className="relative z-10 opacity-70">{formatTime(timeRemaining)}</span>
    </motion.button>
  )
}
