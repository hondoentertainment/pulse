import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, useSpring, useTransform, useMotionValue } from 'framer-motion'
import type { Venue } from '@/lib/types'

interface ParallaxVenueHeroProps {
  venue: Venue
  pulseScore: number
  category?: string
}

const HEADER_HEIGHT = 56
const HERO_HEIGHT = 360
const COLLAPSED_HEIGHT = 56
const SCORE_RING_RADIUS = 44
const SCORE_RING_CIRCUMFERENCE = 2 * Math.PI * SCORE_RING_RADIUS

function getScoreColor(score: number): string {
  if (score >= 75) return 'oklch(0.65 0.28 340)'
  if (score >= 50) return 'oklch(0.70 0.22 60)'
  if (score >= 25) return 'oklch(0.60 0.15 150)'
  return 'oklch(0.35 0.05 240)'
}

export function ParallaxVenueHero({
  venue,
  pulseScore,
  category,
}: ParallaxVenueHeroProps) {
  const heroRef = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)

  const scrollY = useMotionValue(0)
  const springScore = useSpring(0, { stiffness: 80, damping: 20 })

  // Parallax offset for the gradient background (0.5x scroll speed)
  const backgroundY = useTransform(scrollY, [0, HERO_HEIGHT], [0, HERO_HEIGHT * 0.5])

  // Hero scale-down progress: 0 = fully expanded, 1 = fully collapsed
  const collapseProgress = useTransform(
    scrollY,
    [0, HERO_HEIGHT - COLLAPSED_HEIGHT],
    [0, 1]
  )

  // Derived animated values
  const heroHeight = useTransform(collapseProgress, [0, 1], [HERO_HEIGHT, COLLAPSED_HEIGHT])
  const titleScale = useTransform(collapseProgress, [0, 1], [1, 0.6])
  const titleY = useTransform(collapseProgress, [0, 1], [0, -20])
  const subtitleOpacity = useTransform(collapseProgress, [0, 0.4], [1, 0])
  const ringScale = useTransform(collapseProgress, [0, 1], [1, 0.45])
  const ringX = useTransform(collapseProgress, [0, 1], [0, 80])

  const scoreColor = getScoreColor(pulseScore)

  // Intersection Observer to trigger mount animations
  useEffect(() => {
    const node = heroRef.current
    if (!node) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.15 }
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  // Animate pulse score ring on visibility
  useEffect(() => {
    if (isVisible) {
      springScore.set(pulseScore)
    }
  }, [isVisible, pulseScore, springScore])

  // Scroll listener
  const handleScroll = useCallback(() => {
    const y = window.scrollY
    scrollY.set(y)
    setIsCollapsed(y > HERO_HEIGHT - COLLAPSED_HEIGHT - 20)
  }, [scrollY])

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  // Animated stroke dashoffset for the score ring
  const dashOffset = useTransform(
    springScore,
    [0, 100],
    [SCORE_RING_CIRCUMFERENCE, 0]
  )

  return (
    <>
      {/* Sticky collapsed header */}
      <motion.div
        className="fixed left-0 right-0 z-40 bg-card/95 backdrop-blur-sm border-b border-border"
        style={{ top: HEADER_HEIGHT }}
        initial={{ opacity: 0, y: -COLLAPSED_HEIGHT }}
        animate={{
          opacity: isCollapsed ? 1 : 0,
          y: isCollapsed ? 0 : -COLLAPSED_HEIGHT,
          pointerEvents: isCollapsed ? 'auto' : 'none',
        }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
      >
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          {/* Compact score ring */}
          <svg width={32} height={32} viewBox="0 0 100 100" className="shrink-0">
            <circle
              cx="50"
              cy="50"
              r={SCORE_RING_RADIUS}
              fill="none"
              stroke="currentColor"
              strokeWidth="6"
              className="text-muted/20"
            />
            <motion.circle
              cx="50"
              cy="50"
              r={SCORE_RING_RADIUS}
              fill="none"
              stroke={scoreColor}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={SCORE_RING_CIRCUMFERENCE}
              style={{ strokeDashoffset: dashOffset }}
              transform="rotate(-90 50 50)"
            />
            <text
              x="50"
              y="55"
              textAnchor="middle"
              fill={scoreColor}
              fontSize="28"
              fontWeight="bold"
              fontFamily="monospace"
            >
              {Math.round(pulseScore)}
            </text>
          </svg>
          <span className="text-base font-bold truncate">{venue.name}</span>
          {category && (
            <span className="ml-auto text-xs font-mono uppercase tracking-wide text-muted-foreground bg-muted/30 px-2 py-0.5 rounded-md shrink-0">
              {category}
            </span>
          )}
        </div>
      </motion.div>

      {/* Full parallax hero */}
      <motion.section
        ref={heroRef}
        className="relative overflow-hidden"
        style={{ height: heroHeight }}
      >
        {/* Parallax gradient background */}
        <motion.div
          className="absolute inset-0 will-change-transform"
          style={{ translateY: backgroundY }}
        >
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(ellipse at 50% 30%, ${scoreColor}33 0%, transparent 60%),
                           linear-gradient(to bottom, hsl(var(--card)) 0%, hsl(var(--background)) 100%)`,
            }}
          />
          {/* Ambient animated glow */}
          <motion.div
            className="absolute top-1/4 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full blur-3xl"
            style={{ backgroundColor: scoreColor }}
            animate={
              isVisible
                ? { opacity: [0.08, 0.18, 0.08], scale: [0.9, 1.1, 0.9] }
                : {}
            }
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          />
        </motion.div>

        {/* Content container */}
        <div className="relative h-full max-w-2xl mx-auto px-4 flex flex-col items-center justify-center gap-5">
          {/* Animated score ring */}
          <motion.div
            style={{ scale: ringScale, x: ringX }}
            className="origin-center"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.6 }}
              animate={isVisible ? { opacity: 1, scale: 1 } : {}}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            >
              <svg
                width={120}
                height={120}
                viewBox="0 0 100 100"
                className="drop-shadow-lg"
              >
                {/* Track */}
                <circle
                  cx="50"
                  cy="50"
                  r={SCORE_RING_RADIUS}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="5"
                  className="text-muted/20"
                />
                {/* Score arc */}
                <motion.circle
                  cx="50"
                  cy="50"
                  r={SCORE_RING_RADIUS}
                  fill="none"
                  stroke={scoreColor}
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeDasharray={SCORE_RING_CIRCUMFERENCE}
                  style={{
                    strokeDashoffset: dashOffset,
                    filter: `drop-shadow(0 0 6px ${scoreColor})`,
                  }}
                  transform="rotate(-90 50 50)"
                />
                {/* Score number */}
                <motion.text
                  x="50"
                  y="55"
                  textAnchor="middle"
                  fill={scoreColor}
                  fontSize="26"
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  {Math.round(pulseScore)}
                </motion.text>
              </svg>
            </motion.div>
          </motion.div>

          {/* Venue name */}
          <motion.h1
            className="text-3xl sm:text-4xl font-bold text-center leading-tight"
            style={{
              scale: titleScale,
              y: titleY,
              textShadow: `0 0 30px ${scoreColor}66, 0 2px 12px rgba(0,0,0,0.4)`,
            }}
          >
            <motion.span
              initial={{ opacity: 0, y: 20 }}
              animate={isVisible ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              {venue.name}
            </motion.span>
          </motion.h1>

          {/* Category badge with glassmorphism */}
          {category && (
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={isVisible ? { opacity: 1, scale: 1 } : {}}
              transition={{ duration: 0.4, delay: 0.35 }}
              className="px-4 py-1.5 rounded-full text-xs font-mono uppercase tracking-wider border border-white/10 backdrop-blur-md"
              style={{
                background: 'rgba(255,255,255,0.08)',
                boxShadow: '0 4px 30px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.06)',
              }}
            >
              {category}
            </motion.span>
          )}

          {/* City / state with scroll fade */}
          {(venue.city || venue.state) && (
            <motion.p
              className="text-sm text-muted-foreground font-mono tracking-wide"
              style={{ opacity: subtitleOpacity }}
              initial={{ opacity: 0 }}
              animate={isVisible ? { opacity: 1 } : {}}
              transition={{ duration: 0.4, delay: 0.45 }}
            >
              {[venue.city, venue.state].filter(Boolean).join(', ')}
            </motion.p>
          )}
        </div>
      </motion.section>
    </>
  )
}
