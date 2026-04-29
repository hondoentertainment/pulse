import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { ArrowUp, ArrowDown, Minus, Users } from '@phosphor-icons/react'
import { motion, useSpring, useTransform, AnimatePresence } from 'framer-motion'

interface LiveCrowdIndicatorProps {
  count: number
  trend: 'rising' | 'falling' | 'steady'
  friendCount?: number
  avatars?: string[]
  isEstimated?: boolean
}

function AnimatedCounter({ value }: { value: number }) {
  const spring = useSpring(0, { stiffness: 100, damping: 20 })
  const display = useTransform(spring, (v) => Math.round(v))
  const [displayValue, setDisplayValue] = useState(value)

  useEffect(() => {
    spring.set(value)
  }, [spring, value])

  useEffect(() => {
    const unsubscribe = display.on('change', (v) => {
      setDisplayValue(v)
    })
    return unsubscribe
  }, [display])

  return <span>{displayValue}</span>
}

function getGlowIntensity(count: number): string {
  if (count >= 100) return 'shadow-[0_0_30px_rgba(239,68,68,0.3)]'
  if (count >= 50) return 'shadow-[0_0_20px_rgba(249,115,22,0.25)]'
  if (count >= 20) return 'shadow-[0_0_15px_rgba(234,179,8,0.2)]'
  return 'shadow-[0_0_10px_rgba(59,130,246,0.15)]'
}

function getTrendIcon(trend: 'rising' | 'falling' | 'steady') {
  switch (trend) {
    case 'rising':
      return <ArrowUp size={14} weight="bold" className="text-green-400" />
    case 'falling':
      return <ArrowDown size={14} weight="bold" className="text-red-400" />
    case 'steady':
      return <Minus size={14} weight="bold" className="text-yellow-400" />
  }
}

function getTrendColor(trend: 'rising' | 'falling' | 'steady') {
  switch (trend) {
    case 'rising':
      return 'text-green-400'
    case 'falling':
      return 'text-red-400'
    case 'steady':
      return 'text-yellow-400'
  }
}

function getTrendLabel(trend: 'rising' | 'falling' | 'steady') {
  switch (trend) {
    case 'rising':
      return 'Rising'
    case 'falling':
      return 'Thinning'
    case 'steady':
      return 'Steady'
  }
}

const PLACEHOLDER_COLORS = [
  'bg-gradient-to-br from-violet-400 to-purple-600',
  'bg-gradient-to-br from-pink-400 to-rose-600',
  'bg-gradient-to-br from-blue-400 to-indigo-600',
  'bg-gradient-to-br from-emerald-400 to-teal-600',
  'bg-gradient-to-br from-amber-400 to-orange-600',
]

export function LiveCrowdIndicator({ count, trend, friendCount, avatars = [], isEstimated = false }: LiveCrowdIndicatorProps) {
  const maxVisible = 4
  const visibleAvatars = avatars.slice(0, maxVisible)
  const extraCount = Math.max(0, avatars.length - maxVisible)
  const prevCountRef = useRef(count)

  useEffect(() => {
    prevCountRef.current = count
  }, [count])

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={cn(
        'flex items-center gap-4 p-3.5 rounded-2xl bg-card/80 backdrop-blur-sm border border-border',
        getGlowIntensity(count)
      )}
    >
      {/* Avatar stack */}
      <div className="flex items-center -space-x-2.5 flex-shrink-0">
        {visibleAvatars.length > 0 ? (
          visibleAvatars.map((avatar, i) => (
            <motion.div
              key={`avatar-${i}`}
              className="relative"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{
                repeat: Infinity,
                duration: 3,
                delay: i * 0.4,
                ease: 'easeInOut',
              }}
            >
              {avatar ? (
                <img
                  src={avatar}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="w-8 h-8 rounded-full border-2 border-card object-cover"
                />
              ) : (
                <div
                  className={cn(
                    'w-8 h-8 rounded-full border-2 border-card flex items-center justify-center text-xs font-bold text-white',
                    PLACEHOLDER_COLORS[i % PLACEHOLDER_COLORS.length]
                  )}
                >
                  <Users size={14} weight="fill" />
                </div>
              )}
            </motion.div>
          ))
        ) : (
          // Show placeholder avatars when no avatars provided
          Array.from({ length: Math.min(count, maxVisible) }).map((_, i) => (
            <motion.div
              key={`placeholder-${i}`}
              className="relative"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{
                repeat: Infinity,
                duration: 3,
                delay: i * 0.4,
                ease: 'easeInOut',
              }}
            >
              <div
                className={cn(
                  'w-8 h-8 rounded-full border-2 border-card flex items-center justify-center text-xs font-bold text-white',
                  PLACEHOLDER_COLORS[i % PLACEHOLDER_COLORS.length]
                )}
              >
                <Users size={14} weight="fill" />
              </div>
            </motion.div>
          ))
        )}
        {extraCount > 0 && (
          <div className="w-8 h-8 rounded-full border-2 border-card bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
            +{extraCount}
          </div>
        )}
      </div>

      {/* Count and info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {/* Live pulse dot */}
          <motion.div
            className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
          />
          <span className="text-sm font-medium">
            {isEstimated ? '~' : ''}<AnimatedCounter value={count} /> {isEstimated ? 'estimated here' : 'people here now'}
          </span>
        </div>

        <div className="flex items-center gap-2 mt-0.5">
          {/* Trend */}
          <div className={cn('flex items-center gap-1 text-xs', getTrendColor(trend))}>
            {getTrendIcon(trend)}
            <span>{getTrendLabel(trend)}</span>
          </div>

          {/* Friend count */}
          <AnimatePresence>
            {friendCount !== undefined && friendCount > 0 && (
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="text-xs text-primary font-medium"
              >
                &middot; Including {friendCount} friend{friendCount !== 1 ? 's' : ''}
              </motion.span>
            )}
          </AnimatePresence>
          {isEstimated && (
            <span className="text-xs text-muted-foreground">&middot; based on pulse activity</span>
          )}
        </div>
      </div>
    </motion.div>
  )
}
