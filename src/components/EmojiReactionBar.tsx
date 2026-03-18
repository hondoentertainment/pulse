import { useRef, useState, memo } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  type ReactionType,
  REACTION_EMOJIS,
  formatReactionCount,
} from '@/lib/emoji-reactions'

interface EmojiReactionBarProps {
  onReaction: (type: ReactionType, x: number, y: number) => void
  reactionCounts: Record<ReactionType, number>
  activeType?: ReactionType | null
}

const REACTION_TYPES: ReactionType[] = [
  'fire', 'music', 'dancing', 'drinks', 'electric', 'love', 'chill', 'vip',
]

export const EmojiReactionBar = memo(function EmojiReactionBar({
  onReaction,
  reactionCounts,
  activeType,
}: EmojiReactionBarProps) {
  const [tooltipType, setTooltipType] = useState<ReactionType | null>(null)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prefersReducedMotion = useReducedMotion()

  function handleTap(type: ReactionType, event: React.MouseEvent | React.TouchEvent) {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    const x = rect.left + rect.width / 2
    const y = rect.top
    onReaction(type, x, y)
  }

  function handlePointerDown(type: ReactionType) {
    longPressTimerRef.current = setTimeout(() => {
      setTooltipType(type)
    }, 500)
  }

  function handlePointerUp() {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
    setTooltipType(null)
  }

  return (
    <div className="flex items-center justify-center gap-1 px-3 py-2" role="group" aria-label="Emoji reactions">
      {REACTION_TYPES.map((type) => {
        const config = REACTION_EMOJIS[type]
        const count = reactionCounts[type]
        const isActive = activeType === type

        return (
          <div key={type} className="relative flex flex-col items-center">
            <AnimatePresence>
              {tooltipType === type && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.5, y: 4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.5, y: 4 }}
                  className="absolute -top-12 z-10 rounded-lg px-2 py-1 text-xs font-medium whitespace-nowrap"
                  style={{
                    backgroundColor: config.color,
                    color: 'white',
                  }}
                >
                  <span className="mr-1 text-base">{config.emoji}</span>
                  {config.label}
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button
              type="button"
              whileTap={prefersReducedMotion ? undefined : { scale: 1.3 }}
              onClick={(e) => handleTap(type, e)}
              onPointerDown={() => handlePointerDown(type)}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              className={`relative flex h-10 w-10 items-center justify-center rounded-full text-xl transition-shadow ${
                isActive ? 'ring-2' : ''
              }`}
              style={
                isActive
                  ? {
                      boxShadow: `0 0 12px ${config.color}`,
                      ringColor: config.color,
                    }
                  : undefined
              }
              aria-label={`${config.label} reaction${count > 0 ? `, ${count} total` : ''}`}
              aria-pressed={isActive}
              data-testid={`reaction-btn-${type}`}
            >
              {config.emoji}
            </motion.button>

            <AnimatePresence mode="popLayout">
              {count > 0 && (
                <motion.span
                  key={count}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="mt-0.5 text-[10px] font-medium text-muted-foreground"
                  data-testid={`reaction-count-${type}`}
                >
                  {formatReactionCount(count)}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
})
