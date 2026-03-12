import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Trophy, UsersThree, MapTrifold, Lightning, Fire } from '@phosphor-icons/react'
import type { MilestoneType } from '@/lib/retention-engine'
import { MILESTONE_CONFIGS } from '@/lib/retention-engine'

interface MilestoneAnimationProps {
  milestone: MilestoneType
  onDismiss: () => void
}

const MILESTONE_ICONS: Record<string, React.ReactNode> = {
  trophy: <Trophy size={64} weight="fill" className="text-yellow-400" />,
  users: <UsersThree size={64} weight="fill" className="text-purple-400" />,
  map: <MapTrifold size={64} weight="fill" className="text-cyan-400" />,
  lightning: <Lightning size={64} weight="fill" className="text-amber-400" />,
  fire: <Fire size={64} weight="fill" className="text-orange-500" />,
}

const CONFETTI_COLORS = [
  '#a855f7', '#06b6d4', '#f59e0b', '#ec4899', '#22c55e',
  '#8b5cf6', '#14b8a6', '#f97316', '#e879f9', '#34d399',
]

export function MilestoneAnimation({ milestone, onDismiss }: MilestoneAnimationProps) {
  const config = MILESTONE_CONFIGS[milestone]

  // Auto-dismiss after 4 seconds
  useEffect(() => {
    const timer = setTimeout(onDismiss, 4000)
    return () => clearTimeout(timer)
  }, [onDismiss])

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
        onClick={onDismiss}
      >
        {/* Confetti particles */}
        <ConfettiBurst />

        {/* Center content */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 18, delay: 0.1 }}
          className="relative z-10 flex flex-col items-center text-center px-8 py-10 max-w-xs"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Glow ring behind icon */}
          <div className="relative mb-6">
            <motion.div
              animate={{
                scale: [1, 1.3, 1],
                opacity: [0.4, 0.15, 0.4],
              }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute inset-0 w-28 h-28 -translate-x-1/2 -translate-y-1/2 top-1/2 left-1/2 rounded-full bg-purple-500/20 blur-xl"
            />
            <motion.div
              animate={{
                rotate: [0, -8, 8, -8, 8, 0],
                scale: [1, 1.1, 1],
              }}
              transition={{ duration: 0.8, delay: 0.3 }}
            >
              {MILESTONE_ICONS[config.icon] ?? MILESTONE_ICONS.trophy}
            </motion.div>
          </div>

          {/* Title */}
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="text-2xl font-bold text-white mb-2"
          >
            {config.title}
          </motion.h2>

          {/* Description */}
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.4 }}
            className="text-sm text-zinc-400 leading-relaxed mb-8"
          >
            {config.description}
          </motion.p>

          {/* Dismiss button */}
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.3 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onDismiss}
            className="px-8 py-2.5 rounded-full bg-white/10 hover:bg-white/15 border border-white/20 text-white text-sm font-semibold transition-colors"
          >
            Amazing!
          </motion.button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

/** CSS-based confetti burst — no external libraries */
function ConfettiBurst() {
  const particles = Array.from({ length: 40 }, (_, i) => {
    const angle = (i / 40) * 360
    const distance = 150 + Math.random() * 250
    const rad = (angle * Math.PI) / 180
    return {
      id: i,
      targetX: Math.cos(rad) * distance,
      targetY: Math.sin(rad) * distance - 100, // bias upward
      rotation: Math.random() * 720 - 360,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      size: 5 + Math.random() * 6,
      delay: Math.random() * 0.2,
      duration: 0.8 + Math.random() * 0.5,
      isRect: Math.random() > 0.5,
    }
  })

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {particles.map(p => (
        <motion.div
          key={p.id}
          initial={{
            x: '50%',
            y: '50%',
            scale: 0,
            opacity: 1,
          }}
          animate={{
            x: `calc(50% + ${p.targetX}px)`,
            y: `calc(50% + ${p.targetY}px)`,
            scale: [0, 1, 0.6],
            opacity: [1, 1, 0],
            rotate: p.rotation,
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            ease: 'easeOut',
          }}
          className="absolute"
          style={{
            width: p.size,
            height: p.isRect ? p.size * 0.5 : p.size,
            backgroundColor: p.color,
            borderRadius: p.isRect ? 1 : '50%',
          }}
        />
      ))}
    </div>
  )
}
