import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { PulseStory } from '@/lib/stories'
import { ENERGY_CONFIG } from '@/lib/types'
import { X, PaperPlaneRight } from '@phosphor-icons/react'
import { motion, AnimatePresence, type PanInfo, useMotionValue, useTransform } from 'framer-motion'
import { STORY_REACTIONS } from '@/lib/stories'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StoryViewerProps {
  stories: PulseStory[]
  initialIndex?: number
  currentUserId: string
  onClose: () => void
  onReact: (storyId: string, emoji: string) => void
}

interface FloatingReaction {
  id: string
  emoji: string
  x: number
  y: number
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORY_DURATION_MS = 5000
const TICK_INTERVAL_MS = 50
const TICK_INCREMENT = (TICK_INTERVAL_MS / STORY_DURATION_MS) * 100

const SWIPE_X_THRESHOLD = 60
const SWIPE_DOWN_THRESHOLD = 120
const DOUBLE_TAP_DELAY = 300
const LONG_PRESS_DELAY = 200

/** Gradient backgrounds keyed by energy value (0-3). */
const ENERGY_GRADIENTS: Record<number, string> = {
  0: 'radial-gradient(ellipse at 50% 80%, oklch(0.18 0.04 240), oklch(0.08 0.02 260))',
  1: 'radial-gradient(ellipse at 50% 80%, oklch(0.22 0.08 150), oklch(0.08 0.03 180))',
  2: 'radial-gradient(ellipse at 50% 80%, oklch(0.25 0.12 50), oklch(0.08 0.04 30))',
  3: 'radial-gradient(ellipse at 50% 80%, oklch(0.25 0.15 330), oklch(0.08 0.05 300))',
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** A single segment of the progress bar strip. */
function ProgressSegment({
  state,
  progress,
}: {
  state: 'completed' | 'active' | 'upcoming'
  progress: number
}) {
  return (
    <div className="flex-1 h-[3px] bg-white/20 rounded-full overflow-hidden">
      <motion.div
        className="h-full bg-white rounded-full origin-left"
        initial={false}
        animate={{
          scaleX:
            state === 'completed' ? 1 : state === 'active' ? progress / 100 : 0,
        }}
        transition={
          state === 'active'
            ? { duration: TICK_INTERVAL_MS / 1000, ease: 'linear' }
            : { duration: 0.25, ease: 'easeOut' }
        }
        style={{ width: '100%' }}
      />
    </div>
  )
}

/** Animated floating reaction emoji. */
function FloatingEmoji({
  emoji,
  x,
  y,
  onComplete,
}: {
  emoji: string
  x: number
  y: number
  onComplete: () => void
}) {
  return (
    <motion.div
      className="fixed pointer-events-none z-[200] text-4xl select-none"
      initial={{ x, y, scale: 0.3, opacity: 1 }}
      animate={{ y: y - 260, scale: 1.6, opacity: 0 }}
      transition={{ duration: 0.9, ease: 'easeOut' }}
      onAnimationComplete={onComplete}
    >
      {emoji}
    </motion.div>
  )
}

/** Double-tap burst overlay centered on the tap point. */
function DoubleTapBurst({
  x,
  y,
  onComplete,
}: {
  x: number
  y: number
  onComplete: () => void
}) {
  const offsets = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => ({
        angle: (Math.PI * 2 * i) / 6 + Math.random() * 0.4,
        dist: 50 + Math.random() * 40,
        delay: Math.random() * 0.12,
      })),
    [],
  )

  return (
    <>
      {offsets.map((o, i) => (
        <motion.div
          key={i}
          className="fixed pointer-events-none z-[200] text-3xl select-none"
          initial={{ x, y, scale: 0.2, opacity: 1 }}
          animate={{
            x: x + Math.cos(o.angle) * o.dist,
            y: y + Math.sin(o.angle) * o.dist - 60,
            scale: 1.4,
            opacity: 0,
          }}
          transition={{
            duration: 0.75,
            delay: o.delay,
            ease: 'easeOut',
          }}
          onAnimationComplete={i === 0 ? onComplete : undefined}
        >
          🔥
        </motion.div>
      ))}
    </>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function StoryViewer({
  stories,
  initialIndex = 0,
  currentUserId: _currentUserId,
  onClose,
  onReact,
}: StoryViewerProps) {
  // ---- core state ----
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [progress, setProgress] = useState(0)
  const [paused, setPaused] = useState(false)
  const [direction, setDirection] = useState<1 | -1>(1)

  // ---- reply input ----
  const [replyOpen, setReplyOpen] = useState(false)
  const [replyText, setReplyText] = useState('')
  const replyInputRef = useRef<HTMLInputElement>(null)

  // ---- animated reactions ----
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([])
  const [bursts, setBursts] = useState<{ id: string; x: number; y: number }[]>([])

  // ---- gesture helpers ----
  const lastTapRef = useRef(0)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isLongPressingRef = useRef(false)

  // ---- drag-to-dismiss motion values ----
  const dragY = useMotionValue(0)
  const dismissOpacity = useTransform(dragY, [0, SWIPE_DOWN_THRESHOLD * 2], [1, 0.3])
  const dismissScale = useTransform(dragY, [0, SWIPE_DOWN_THRESHOLD * 2], [1, 0.85])

  const story = stories[currentIndex]

  // ---------- navigation ----------

  const goNext = useCallback(() => {
    if (currentIndex < stories.length - 1) {
      setDirection(1)
      setCurrentIndex((i) => i + 1)
      setProgress(0)
    } else {
      onClose()
    }
  }, [currentIndex, stories.length, onClose])

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setDirection(-1)
      setCurrentIndex((i) => i - 1)
      setProgress(0)
    }
  }, [currentIndex])

  // ---------- auto-advance timer ----------

  useEffect(() => {
    if (paused || replyOpen) return

    const timer = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          goNext()
          return 0
        }
        return p + TICK_INCREMENT
      })
    }, TICK_INTERVAL_MS)

    return () => clearInterval(timer)
  }, [currentIndex, goNext, paused, replyOpen])

  // ---------- focus reply input when opened ----------

  useEffect(() => {
    if (replyOpen) {
      // small delay so the slide-up animation is visible before focus
      const t = setTimeout(() => replyInputRef.current?.focus(), 80)
      return () => clearTimeout(t)
    }
  }, [replyOpen])

  // ---------- helpers ----------

  const removeFloating = useCallback((id: string) => {
    setFloatingReactions((prev) => prev.filter((r) => r.id !== id))
  }, [])

  const removeBurst = useCallback((id: string) => {
    setBursts((prev) => prev.filter((b) => b.id !== id))
  }, [])

  const spawnReaction = useCallback(
    (emoji: string, clientX: number, clientY: number) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      setFloatingReactions((prev) => [
        ...prev,
        { id, emoji, x: clientX - 18, y: clientY - 18 },
      ])
    },
    [],
  )

  const spawnBurst = useCallback((clientX: number, clientY: number) => {
    const id = `burst-${Date.now()}`
    setBursts((prev) => [...prev, { id, x: clientX, y: clientY }])
  }, [])

  // ---------- horizontal swipe handler ----------

  const handleDragEnd = useCallback(
    (_: unknown, info: PanInfo) => {
      const { offset, velocity } = info

      // Horizontal swipe
      if (Math.abs(offset.x) > Math.abs(offset.y)) {
        if (offset.x < -SWIPE_X_THRESHOLD || velocity.x < -400) {
          goNext()
          return
        }
        if (offset.x > SWIPE_X_THRESHOLD || velocity.x > 400) {
          goPrev()
          return
        }
      }

      // Vertical swipe down to dismiss
      if (offset.y > SWIPE_DOWN_THRESHOLD || velocity.y > 500) {
        onClose()
      }
    },
    [goNext, goPrev, onClose],
  )

  // ---------- hold-to-pause / double-tap ----------

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Double-tap detection
      const now = Date.now()
      if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
        // Fire the 🔥 burst
        if (story) {
          onReact(story.id, '🔥')
          spawnBurst(e.clientX, e.clientY)
        }
        lastTapRef.current = 0
        return
      }
      lastTapRef.current = now

      // Long-press to pause
      isLongPressingRef.current = false
      longPressTimerRef.current = setTimeout(() => {
        isLongPressingRef.current = true
        setPaused(true)
      }, LONG_PRESS_DELAY)
    },
    [story, onReact, spawnBurst],
  )

  const handlePointerUp = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
    if (isLongPressingRef.current) {
      isLongPressingRef.current = false
      setPaused(false)
    }
  }, [])

  // ---------- reply submit ----------

  const handleReplySubmit = useCallback(() => {
    if (!replyText.trim() || !story) return
    // Treat reply as a reaction with the text content
    onReact(story.id, replyText.trim())
    setReplyText('')
    setReplyOpen(false)
  }, [replyText, story, onReact])

  // ---------- guard ----------

  if (!story) return null

  const energyConfig = ENERGY_CONFIG[story.energyRating]
  const bgGradient = ENERGY_GRADIENTS[energyConfig.value] ?? ENERGY_GRADIENTS[0]

  // ---------- slide variants with parallax depth ----------

  const slideVariants = {
    enter: (d: number) => ({
      x: d > 0 ? '70%' : '-70%',
      scale: 0.88,
      opacity: 0,
    }),
    center: {
      x: 0,
      scale: 1,
      opacity: 1,
    },
    exit: (d: number) => ({
      x: d > 0 ? '-40%' : '40%',
      scale: 0.92,
      opacity: 0,
    }),
  }

  return (
    <>
      {/* Floating reactions layer */}
      <AnimatePresence>
        {floatingReactions.map((r) => (
          <FloatingEmoji
            key={r.id}
            emoji={r.emoji}
            x={r.x}
            y={r.y}
            onComplete={() => removeFloating(r.id)}
          />
        ))}
      </AnimatePresence>

      {/* Double-tap bursts */}
      <AnimatePresence>
        {bursts.map((b) => (
          <DoubleTapBurst
            key={b.id}
            x={b.x}
            y={b.y}
            onComplete={() => removeBurst(b.id)}
          />
        ))}
      </AnimatePresence>

      {/* Main viewer – drag-to-dismiss wrapper */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="fixed inset-0 z-[100] flex flex-col overflow-hidden"
        style={{
          background: bgGradient,
          opacity: dismissOpacity,
          scale: dismissScale,
        }}
      >
        {/* Draggable surface for swipe gestures */}
        <motion.div
          className="flex-1 flex flex-col touch-none"
          drag
          dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
          dragElastic={{ left: 0.35, right: 0.35, top: 0.5, bottom: 0 }}
          onDragEnd={handleDragEnd}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={{ y: dragY }}
        >
          {/* Segmented progress bars */}
          <div className="flex gap-1 px-3 pt-3 pb-1 z-10">
            {stories.map((_, i) => (
              <ProgressSegment
                key={i}
                state={
                  i < currentIndex
                    ? 'completed'
                    : i === currentIndex
                      ? 'active'
                      : 'upcoming'
                }
                progress={i === currentIndex ? progress : 0}
              />
            ))}
          </div>

          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 z-10">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center ring-2 ring-white/20">
              {story.profilePhoto ? (
                <img
                  src={story.profilePhoto}
                  alt=""
                  decoding="async"
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <span className="text-xs font-bold text-white">
                  {story.username?.slice(0, 2).toUpperCase() ??
                    story.userId.slice(-2).toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">
                {story.venueName || 'Venue'}
              </p>
              <p className="text-xs text-white/50">
                {story.username} &middot;{' '}
                {new Date(story.createdAt).toLocaleTimeString([], {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onClose()
              }}
              className="p-2 rounded-full bg-white/10 text-white/80 hover:text-white hover:bg-white/20 transition-colors"
            >
              <X size={22} weight="bold" />
            </button>
          </div>

          {/* Pause indicator */}
          <AnimatePresence>
            {paused && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none"
              >
                <div className="px-4 py-2 rounded-full bg-black/50 backdrop-blur-sm">
                  <span className="text-sm font-medium text-white/80">Paused</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Story content with parallax slide transitions */}
          <div className="flex-1 relative flex items-center justify-center overflow-hidden">
            <AnimatePresence mode="popLayout" custom={direction}>
              <motion.div
                key={story.id}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{
                  x: { type: 'spring', stiffness: 350, damping: 35 },
                  scale: { type: 'spring', stiffness: 350, damping: 35 },
                  opacity: { duration: 0.2 },
                }}
                className="absolute inset-0 flex flex-col items-center justify-center px-8"
              >
                {story.photos.length > 0 ? (
                  <img
                    src={story.photos[0]}
                    alt=""
                    fetchPriority="high"
                    decoding="sync"
                    className="max-h-[55vh] rounded-2xl object-cover shadow-2xl"
                    draggable={false}
                  />
                ) : (
                  <div
                    className="w-full max-w-sm aspect-square rounded-3xl flex items-center justify-center shadow-2xl"
                    style={{
                      background: `linear-gradient(135deg, ${energyConfig.color}, oklch(0.2 0.05 270))`,
                    }}
                  >
                    <span className="text-7xl">{energyConfig.emoji}</span>
                  </div>
                )}
                {story.caption && (
                  <p className="text-white text-center mt-5 text-lg font-medium max-w-xs leading-snug drop-shadow-lg">
                    {story.caption}
                  </p>
                )}
                <div
                  className="mt-3 px-4 py-1.5 rounded-full backdrop-blur-sm"
                  style={{ backgroundColor: energyConfig.color + '33' }}
                >
                  <span className="text-sm text-white font-medium">
                    {energyConfig.emoji} {energyConfig.label}
                  </span>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Navigation tap zones (left/right third) */}
            <button
              onClick={goPrev}
              className="absolute left-0 top-0 bottom-0 w-1/3 z-10"
              aria-label="Previous story"
            />
            <button
              onClick={goNext}
              className="absolute right-0 top-0 bottom-0 w-1/3 z-10"
              aria-label="Next story"
            />
          </div>
        </motion.div>

        {/* Bottom bar: reactions + reply */}
        <div className="z-10 px-4 pb-4 pt-2">
          {/* Reaction strip */}
          <div className="flex items-center justify-center gap-3 mb-3">
            {STORY_REACTIONS.map((emoji) => (
              <motion.button
                key={emoji}
                whileTap={{ scale: 0.75 }}
                onClick={(e) => {
                  onReact(story.id, emoji)
                  spawnReaction(emoji, e.clientX, e.clientY)
                }}
                className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
              >
                <span className="text-xl">{emoji}</span>
              </motion.button>
            ))}
          </div>

          {/* Reply input */}
          <AnimatePresence>
            {replyOpen ? (
              <motion.div
                initial={{ y: 60, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 60, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className="flex items-center gap-2"
              >
                <input
                  ref={replyInputRef}
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleReplySubmit()
                    if (e.key === 'Escape') setReplyOpen(false)
                  }}
                  placeholder="Send a reply..."
                  className="flex-1 bg-white/10 backdrop-blur-sm text-white text-sm placeholder-white/40 rounded-full px-4 py-3 outline-none focus:ring-2 focus:ring-white/30 transition-shadow"
                />
                <motion.button
                  whileTap={{ scale: 0.85 }}
                  onClick={handleReplySubmit}
                  disabled={!replyText.trim()}
                  className="p-3 rounded-full bg-white/15 text-white disabled:opacity-30 hover:bg-white/25 transition-colors"
                >
                  <PaperPlaneRight size={20} weight="fill" />
                </motion.button>
              </motion.div>
            ) : (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setReplyOpen(true)}
                className="w-full bg-white/8 backdrop-blur-sm text-white/40 text-sm rounded-full px-4 py-3 text-left hover:bg-white/12 transition-colors"
              >
                Reply to {story.username || 'story'}...
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </>
  )
}
