import { useState, memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Fire, Warning } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import type { Streak } from '@/lib/streak-rewards'
import {
  getNextMilestone,
  getProgressToNextMilestone,
  isAtRisk,
  STREAK_DEFINITIONS,
} from '@/lib/streak-rewards'

interface StreakCounterProps {
  streak: Streak
  onExpand?: (streak: Streak) => void
  size?: 'small' | 'medium' | 'large'
}

/** Get the ring color based on streak length */
function getStreakColor(count: number): { ring: string; text: string; bg: string } {
  if (count >= 25) return { ring: 'stroke-yellow-400', text: 'text-yellow-400', bg: 'bg-yellow-500/10' }
  if (count >= 10) return { ring: 'stroke-purple-400', text: 'text-purple-400', bg: 'bg-purple-500/10' }
  if (count >= 5) return { ring: 'stroke-blue-400', text: 'text-blue-400', bg: 'bg-blue-500/10' }
  if (count >= 1) return { ring: 'stroke-slate-400', text: 'text-slate-400', bg: 'bg-slate-500/10' }
  return { ring: 'stroke-muted-foreground/30', text: 'text-muted-foreground', bg: 'bg-muted' }
}

function getTimeRemaining(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now()
  if (diff <= 0) return 'Expired'
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  if (hours > 24) return `${Math.floor(hours / 24)}d left`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

const SIZE_CONFIG = {
  small: { dimension: 48, strokeWidth: 3, radius: 19, fontSize: 'text-sm', iconSize: 10 },
  medium: { dimension: 64, strokeWidth: 4, radius: 26, fontSize: 'text-lg', iconSize: 14 },
  large: { dimension: 80, strokeWidth: 5, radius: 33, fontSize: 'text-xl', iconSize: 18 },
} as const

export const StreakCounter = memo(function StreakCounter({ streak, onExpand, size = 'medium' }: StreakCounterProps) {
  const [isHovered, setIsHovered] = useState(false)
  const progress = getProgressToNextMilestone(streak)
  const nextMilestone = getNextMilestone(streak)
  const colors = getStreakColor(streak.currentCount)
  const atRisk = isAtRisk(streak)
  const def = STREAK_DEFINITIONS.find(d => d.type === streak.type)
  const isHot = streak.currentCount >= 5

  const { dimension, strokeWidth, radius, fontSize, iconSize } = SIZE_CONFIG[size]
  const circumference = 2 * Math.PI * radius

  return (
    <motion.button
      onClick={() => onExpand?.(streak)}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={cn(
        'relative flex flex-col items-center gap-1',
        !streak.isActive && 'opacity-40'
      )}
      aria-label={`${def?.label ?? streak.type}: ${streak.currentCount} streak${nextMilestone ? `, next milestone at ${nextMilestone}` : ''}${atRisk ? ', at risk of expiring!' : ''}`}
    >
      {/* Progress Ring */}
      <div className="relative" style={{ width: dimension, height: dimension }}>
        <svg
          width={dimension}
          height={dimension}
          className="transform -rotate-90"
        >
          {/* Background circle */}
          <circle
            cx={dimension / 2}
            cy={dimension / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-muted/30"
          />
          {/* Progress arc */}
          <motion.circle
            cx={dimension / 2}
            cy={dimension / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            className={colors.ring}
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference * (1 - progress) }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </svg>

        {/* Count in center */}
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.span
            key={streak.currentCount}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={cn('font-bold', fontSize, colors.text)}
          >
            {streak.currentCount}
          </motion.span>
        </div>

        {/* Flame icon for hot streaks */}
        <AnimatePresence>
          {isHot && streak.isActive && (
            <motion.div
              initial={{ scale: 0, y: 4 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0 }}
              className="absolute -top-1 -right-1"
            >
              <motion.div
                animate={{
                  scale: [1, 1.2, 1],
                  rotate: [0, -5, 5, 0],
                }}
                transition={{
                  duration: 0.8,
                  repeat: Infinity,
                  repeatType: 'mirror',
                }}
              >
                <Fire
                  size={iconSize}
                  weight="fill"
                  className="text-orange-500 drop-shadow-[0_0_4px_rgba(249,115,22,0.6)]"
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* At-risk warning badge */}
        <AnimatePresence>
          {atRisk && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -bottom-1 -right-1 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-red-500/90 text-white text-[9px] font-bold whitespace-nowrap"
            >
              <Warning size={8} weight="fill" />
              {getTimeRemaining(streak.expiresAt)}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Label */}
      {size !== 'small' && (
        <p className="text-[10px] font-medium text-muted-foreground leading-tight max-w-[72px] text-center truncate">
          {def?.label ?? streak.type}
        </p>
      )}

      {/* Hover tooltip with next milestone */}
      <AnimatePresence>
        {isHovered && nextMilestone && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded bg-popover border border-border text-[10px] text-popover-foreground whitespace-nowrap z-10 shadow-lg"
          >
            Next: {nextMilestone}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  )
})
