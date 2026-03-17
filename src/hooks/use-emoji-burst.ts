import { useState, useCallback, useRef, useEffect } from 'react'
import {
  type ReactionType,
  type ReactionBurst,
  type ReactionCount,
  createBurstParticles,
  updateParticle,
  isParticleExpired,
  getReactionVelocity,
} from '@/lib/emoji-reactions'

const MAX_PARTICLES = 30
const RAPID_TAP_WINDOW_MS = 300

export function useEmojiBurst() {
  const [particles, setParticles] = useState<ReactionBurst[]>([])
  const [reactionCounts, setReactionCounts] = useState<Record<ReactionType, number>>({
    fire: 0,
    music: 0,
    dancing: 0,
    drinks: 0,
    electric: 0,
    love: 0,
    chill: 0,
    vip: 0,
  })

  const animFrameRef = useRef<number>(0)
  const lastTimeRef = useRef<number>(0)
  const tapTimestampsRef = useRef<number[]>([])
  const particlesRef = useRef<ReactionBurst[]>([])

  // Keep ref in sync for animation loop
  particlesRef.current = particles

  const animate = useCallback((time: number) => {
    if (lastTimeRef.current === 0) {
      lastTimeRef.current = time
    }

    const deltaTime = Math.min((time - lastTimeRef.current) / 1000, 0.05)
    lastTimeRef.current = time

    const currentParticles = particlesRef.current
    if (currentParticles.length === 0) {
      animFrameRef.current = 0
      lastTimeRef.current = 0
      return
    }

    const updated = currentParticles
      .map((p) => updateParticle(p, deltaTime))
      .filter((p) => !isParticleExpired(p))

    setParticles(updated)
    animFrameRef.current = requestAnimationFrame(animate)
  }, [])

  const startAnimation = useCallback(() => {
    if (animFrameRef.current === 0) {
      lastTimeRef.current = 0
      animFrameRef.current = requestAnimationFrame(animate)
    }
  }, [animate])

  useEffect(() => {
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
      }
    }
  }, [])

  const triggerBurst = useCallback(
    (type: ReactionType, x: number, y: number) => {
      const now = Date.now()

      // Track rapid taps
      tapTimestampsRef.current = tapTimestampsRef.current.filter(
        (t) => now - t < RAPID_TAP_WINDOW_MS
      )
      tapTimestampsRef.current.push(now)

      const tapCount = tapTimestampsRef.current.length
      const burstCount = getReactionVelocity(tapCount)

      const currentCount = particlesRef.current.length
      const allowedCount = Math.min(burstCount, MAX_PARTICLES - currentCount)

      if (allowedCount <= 0) return

      const newParticles = createBurstParticles(type, x, y, allowedCount)

      setParticles((prev) => [...prev, ...newParticles].slice(-MAX_PARTICLES))
      setReactionCounts((prev) => ({
        ...prev,
        [type]: prev[type] + 1,
      }))

      startAnimation()
    },
    [startAnimation]
  )

  const aggregatedReactions: ReactionCount[] = Object.entries(reactionCounts)
    .filter(([, count]) => count > 0)
    .map(([type, count]) => ({ type: type as ReactionType, count }))
    .sort((a, b) => b.count - a.count)

  return {
    particles,
    reactionCounts,
    aggregatedReactions,
    triggerBurst,
  }
}
