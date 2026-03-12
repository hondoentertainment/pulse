import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Eye, MapPin, ArrowRight, Sparkle } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import type { DailyDrop } from '@/lib/retention-engine'

interface DailyDiscoveryDropProps {
  drop: DailyDrop
  onReveal?: () => void
  onNavigate?: (venueId: string) => void
}

function useCountdown(targetDate: string) {
  const [timeLeft, setTimeLeft] = useState(() => getTimeLeft(targetDate))

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(getTimeLeft(targetDate))
    }, 1000)
    return () => clearInterval(interval)
  }, [targetDate])

  return timeLeft
}

function getTimeLeft(targetDate: string) {
  const diff = new Date(targetDate).getTime() - Date.now()
  if (diff <= 0) return { hours: 0, minutes: 0, seconds: 0, expired: true }
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((diff % (1000 * 60)) / 1000)
  return { hours, minutes, seconds, expired: false }
}

export function DailyDiscoveryDrop({ drop, onReveal, onNavigate }: DailyDiscoveryDropProps) {
  const [revealed, setRevealed] = useState(drop.isRevealed)
  const countdown = useCountdown(drop.revealAt)

  const handleReveal = useCallback(() => {
    if (countdown.expired && !revealed) {
      setRevealed(true)
      onReveal?.()
    }
  }, [countdown.expired, revealed, onReveal])

  // Auto-reveal when countdown expires
  useEffect(() => {
    if (countdown.expired && !revealed) {
      handleReveal()
    }
  }, [countdown.expired, revealed, handleReveal])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/80 backdrop-blur-sm"
    >
      {/* Background blur layer */}
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-br from-purple-900/30 via-zinc-900/50 to-cyan-900/20",
          !revealed && "backdrop-blur-md"
        )}
      />

      {/* Confetti particles on reveal */}
      <AnimatePresence>
        {revealed && (
          <RevealConfetti />
        )}
      </AnimatePresence>

      <div className="relative z-10 p-5">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-500/20">
            <Sparkle size={18} weight="fill" className="text-purple-400" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-purple-400">
              Daily Discovery
            </p>
            <p className="text-[10px] text-zinc-500">
              Curated just for you
            </p>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {!revealed ? (
            /* Unrevealed state */
            <motion.div
              key="teaser"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.95, filter: 'blur(8px)' }}
              transition={{ duration: 0.3 }}
            >
              {/* Teaser text */}
              <p className="text-base text-zinc-300 leading-relaxed mb-4">
                {drop.teaser}
              </p>

              {/* Blurred venue placeholder */}
              <div className="relative h-24 rounded-xl bg-zinc-800/60 flex items-center justify-center mb-4 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-600/10 to-cyan-600/10 blur-xl" />
                <div className="relative flex items-center gap-2 text-zinc-500">
                  <Eye size={20} weight="duotone" />
                  <span className="text-sm font-medium">Hidden until reveal</span>
                </div>
              </div>

              {/* Countdown */}
              {!countdown.expired ? (
                <div className="flex items-center justify-center gap-1 text-sm">
                  <span className="text-zinc-500">Reveals in</span>
                  <span className="font-mono font-bold text-purple-400">
                    {countdown.hours}h {String(countdown.minutes).padStart(2, '0')}m
                  </span>
                </div>
              ) : (
                <motion.button
                  onClick={handleReveal}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold transition-colors"
                >
                  Reveal Now
                </motion.button>
              )}
            </motion.div>
          ) : (
            /* Revealed state */
            <motion.div
              key="revealed"
              initial={{ opacity: 0, scale: 0.9, filter: 'blur(12px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            >
              {/* Venue info */}
              <div className="mb-4">
                <motion.h3
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-xl font-bold text-white mb-1"
                >
                  {drop.venueName}
                </motion.h3>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="flex items-center gap-2"
                >
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-800 text-xs text-zinc-400">
                    <MapPin size={12} weight="fill" />
                    {drop.category}
                  </span>
                </motion.div>
              </div>

              {/* CTA button */}
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onNavigate?.(drop.venueId)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white text-sm font-semibold transition-colors"
              >
                Check it out
                <ArrowRight size={16} weight="bold" />
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

/** CSS-based confetti burst on reveal */
function RevealConfetti() {
  const particles = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    delay: Math.random() * 0.3,
    duration: 0.8 + Math.random() * 0.6,
    color: ['#a855f7', '#06b6d4', '#f59e0b', '#ec4899', '#22c55e'][i % 5],
    size: 4 + Math.random() * 4,
  }))

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
      {particles.map(p => (
        <motion.div
          key={p.id}
          initial={{
            opacity: 1,
            x: `${p.x}%`,
            y: '60%',
            scale: 0,
          }}
          animate={{
            opacity: [1, 1, 0],
            y: `${-20 + Math.random() * 40}%`,
            x: `${p.x + (Math.random() - 0.5) * 30}%`,
            scale: [0, 1.2, 0.8],
            rotate: Math.random() * 360,
          }}
          exit={{ opacity: 0 }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            ease: 'easeOut',
          }}
          className="absolute rounded-full"
          style={{
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
          }}
        />
      ))}
    </div>
  )
}
