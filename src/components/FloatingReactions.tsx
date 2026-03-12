"use client"

import { useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"

interface Reaction {
  id: string
  emoji: string
  timestamp: number
}

interface FloatingReactionsProps {
  reactions: Reaction[]
  onComplete: (id: string) => void
}

const MAX_VISIBLE = 5

export default function FloatingReactions({
  reactions,
  onComplete,
}: FloatingReactionsProps) {
  const visibleReactions = useMemo(() => {
    const sorted = [...reactions].sort((a, b) => a.timestamp - b.timestamp)
    return sorted.slice(-MAX_VISIBLE)
  }, [reactions])

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      <AnimatePresence>
        {visibleReactions.map((reaction) => {
          // Deterministic random offset based on id
          const hash = reaction.id
            .split("")
            .reduce((acc, char) => acc + char.charCodeAt(0), 0)
          const xOffset = (hash % 100) - 50 // -50 to 49
          const wobbleDirection = hash % 2 === 0 ? 1 : -1

          return (
            <motion.div
              key={reaction.id}
              initial={{
                opacity: 0,
                scale: 0.5,
                x: `calc(100vw - 80px + ${xOffset}px)`,
                y: "100vh",
              }}
              animate={{
                opacity: [0, 1, 1, 0],
                scale: [0.5, 1.2, 1.0, 0.8],
                x: [
                  `calc(100vw - 80px + ${xOffset}px)`,
                  `calc(100vw - 80px + ${xOffset + wobbleDirection * 20}px)`,
                  `calc(100vw - 80px + ${xOffset - wobbleDirection * 15}px)`,
                  `calc(100vw - 80px + ${xOffset + wobbleDirection * 10}px)`,
                ],
                y: ["100vh", "66vh", "33vh", "0vh"],
              }}
              exit={{ opacity: 0, scale: 0.3 }}
              transition={{
                duration: 2,
                ease: "easeOut",
                times: [0, 0.3, 0.7, 1],
              }}
              onAnimationComplete={() => onComplete(reaction.id)}
              className="absolute text-3xl"
              style={{
                filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))",
              }}
            >
              {reaction.emoji}
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
