import { type ReactNode, useRef, useState, useCallback } from 'react'
import { motion, useSpring, useTransform } from 'framer-motion'
import { cn } from '@/lib/utils'

interface PullToRefreshProps {
  onRefresh: () => Promise<void>
  children: ReactNode
  threshold?: number
  maxPull?: number
  className?: string
}

type RefreshState = 'idle' | 'pulling' | 'threshold-reached' | 'refreshing'

export function PullToRefresh({
  onRefresh,
  children,
  threshold = 80,
  maxPull = 130,
  className,
}: PullToRefreshProps) {
  const [refreshState, setRefreshState] = useState<RefreshState>('idle')
  const containerRef = useRef<HTMLDivElement>(null)
  const startY = useRef(0)
  const currentPull = useRef(0)
  const isTracking = useRef(false)

  const pullDistance = useSpring(0, {
    stiffness: 300,
    damping: 30,
  })

  const indicatorOpacity = useTransform(pullDistance, [0, 30, threshold], [0, 0.5, 1])
  const indicatorScale = useTransform(pullDistance, [0, threshold], [0.5, 1])
  const fillProgress = useTransform(pullDistance, [0, threshold], [0, 1])
  const strokeOffset = useTransform(
    fillProgress,
    (v: number) => Math.PI * 34 * (1 - v)
  )

  const isScrolledToTop = useCallback((): boolean => {
    if (!containerRef.current) return true
    const scrollableParent = containerRef.current.closest('[data-scroll-container]')
    if (scrollableParent) {
      return scrollableParent.scrollTop <= 0
    }
    return window.scrollY <= 0
  }, [])

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (refreshState === 'refreshing') return
      if (!isScrolledToTop()) return

      startY.current = e.touches[0].clientY
      currentPull.current = 0
      isTracking.current = true
    },
    [refreshState, isScrolledToTop]
  )

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isTracking.current || refreshState === 'refreshing') return

      const deltaY = e.touches[0].clientY - startY.current

      if (deltaY < 0) {
        isTracking.current = false
        pullDistance.set(0)
        setRefreshState('idle')
        return
      }

      // Apply resistance curve for natural feel
      const resistance = 0.5
      const pull = Math.min(deltaY * resistance, maxPull)
      currentPull.current = pull
      pullDistance.set(pull)

      if (pull >= threshold) {
        setRefreshState('threshold-reached')
      } else if (pull > 0) {
        setRefreshState('pulling')
      }
    },
    [refreshState, threshold, maxPull, pullDistance]
  )

  const handleTouchEnd = useCallback(async () => {
    if (!isTracking.current) return
    isTracking.current = false

    if (currentPull.current >= threshold) {
      setRefreshState('refreshing')
      pullDistance.set(threshold * 0.6)

      try {
        await onRefresh()
      } finally {
        pullDistance.set(0)
        setRefreshState('idle')
      }
    } else {
      pullDistance.set(0)
      setRefreshState('idle')
    }
  }, [threshold, onRefresh, pullDistance])

  return (
    <div
      ref={containerRef}
      className={cn('relative', className)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      <motion.div
        className="absolute left-0 right-0 flex items-center justify-center overflow-hidden pointer-events-none z-10"
        style={{
          height: pullDistance,
          top: 0,
        }}
      >
        <motion.div
          className="relative flex items-center justify-center"
          style={{
            opacity: indicatorOpacity,
            scale: indicatorScale,
          }}
        >
          {/* Outer ring */}
          <div className="w-10 h-10 rounded-full border-2 border-primary/30 flex items-center justify-center">
            {/* Fill circle */}
            <svg
              width="40"
              height="40"
              viewBox="0 0 40 40"
              className="absolute"
            >
              <motion.circle
                cx="20"
                cy="20"
                r="17"
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray={Math.PI * 34}
                style={{
                  strokeDashoffset: strokeOffset,
                }}
                transform="rotate(-90 20 20)"
              />
            </svg>

            {/* Inner pulse / spinner */}
            {refreshState === 'refreshing' ? (
              <motion.div
                className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent"
                animate={{ rotate: 360 }}
                transition={{
                  duration: 0.8,
                  repeat: Infinity,
                  ease: 'linear',
                }}
              />
            ) : (
              <motion.div
                className="w-3 h-3 rounded-full bg-primary"
                animate={
                  refreshState === 'threshold-reached'
                    ? {
                        scale: [1, 1.3, 1],
                        opacity: [1, 0.7, 1],
                      }
                    : {}
                }
                transition={
                  refreshState === 'threshold-reached'
                    ? {
                        duration: 0.6,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      }
                    : {}
                }
              />
            )}
          </div>
        </motion.div>
      </motion.div>

      {/* Content pushed down by pull */}
      <motion.div style={{ y: pullDistance }}>{children}</motion.div>
    </div>
  )
}
