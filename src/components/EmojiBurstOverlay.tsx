import { motion, AnimatePresence } from 'framer-motion'
import { type ReactionBurst, REACTION_EMOJIS } from '@/lib/emoji-reactions'

interface EmojiBurstOverlayProps {
  particles: ReactionBurst[]
}

export function EmojiBurstOverlay({ particles }: EmojiBurstOverlayProps) {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
      aria-hidden="true"
    >
      <AnimatePresence>
        {particles.map((particle) => {
          const config = REACTION_EMOJIS[particle.type]

          // Cull off-screen particles
          if (
            particle.x < -50 ||
            particle.x > window.innerWidth + 50 ||
            particle.y < -50 ||
            particle.y > window.innerHeight + 50
          ) {
            return null
          }

          return (
            <motion.div
              key={particle.id}
              initial={{
                x: particle.x,
                y: particle.y,
                scale: 0.5,
                opacity: 1,
                rotate: 0,
              }}
              animate={{
                x: particle.x,
                y: particle.y,
                scale: particle.scale,
                opacity: particle.opacity,
                rotate: particle.rotation,
              }}
              exit={{
                opacity: 0,
                scale: 0,
              }}
              transition={{
                duration: 0.05,
                ease: 'linear',
              }}
              className="absolute text-2xl"
              style={{
                left: 0,
                top: 0,
                transform: `translate(${particle.x}px, ${particle.y}px) scale(${particle.scale}) rotate(${particle.rotation}deg)`,
                opacity: particle.opacity,
                filter: `drop-shadow(0 0 6px ${config.color})`,
                willChange: 'transform, opacity',
              }}
            >
              {config.emoji}
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
