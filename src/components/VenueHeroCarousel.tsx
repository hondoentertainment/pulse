import { useState, useEffect, useRef, useCallback } from 'react'
import { Venue } from '@/lib/types'
import { cn } from '@/lib/utils'
import { ArrowLeft } from '@phosphor-icons/react'
import { motion, useMotionValue, useTransform, animate, AnimatePresence } from 'framer-motion'

interface VenueHeroCarouselProps {
  venue: Venue
  pulseScore: number
  onBack: () => void
}

function getCategoryGradients(category?: string): string[] {
  const cat = (category || '').toLowerCase()

  if (cat.includes('bar') || cat.includes('pub') || cat.includes('lounge')) {
    return [
      'linear-gradient(135deg, #b44d12 0%, #dc6b20 30%, #f59e0b 60%, #92400e 100%)',
      'linear-gradient(135deg, #dc6b20 0%, #f97316 30%, #fbbf24 60%, #b45309 100%)',
      'linear-gradient(135deg, #92400e 0%, #b44d12 30%, #dc6b20 60%, #f59e0b 100%)',
      'linear-gradient(135deg, #f59e0b 0%, #dc6b20 40%, #92400e 80%, #b44d12 100%)',
    ]
  }

  if (cat.includes('club') || cat.includes('nightclub') || cat.includes('dance')) {
    return [
      'linear-gradient(135deg, #7c3aed 0%, #a855f7 30%, #ec4899 60%, #6366f1 100%)',
      'linear-gradient(135deg, #ec4899 0%, #f43f5e 30%, #a855f7 60%, #7c3aed 100%)',
      'linear-gradient(135deg, #6366f1 0%, #8b5cf6 30%, #d946ef 60%, #ec4899 100%)',
      'linear-gradient(135deg, #d946ef 0%, #a855f7 40%, #6366f1 80%, #ec4899 100%)',
    ]
  }

  if (cat.includes('restaurant') || cat.includes('dining') || cat.includes('bistro')) {
    return [
      'linear-gradient(135deg, #78350f 0%, #a16207 30%, #65a30d 60%, #4d7c0f 100%)',
      'linear-gradient(135deg, #a16207 0%, #ca8a04 30%, #84cc16 60%, #65a30d 100%)',
      'linear-gradient(135deg, #4d7c0f 0%, #65a30d 30%, #a16207 60%, #78350f 100%)',
      'linear-gradient(135deg, #65a30d 0%, #a16207 40%, #78350f 80%, #ca8a04 100%)',
    ]
  }

  if (cat.includes('cafe') || cat.includes('coffee')) {
    return [
      'linear-gradient(135deg, #78350f 0%, #92400e 30%, #d4a574 60%, #a16207 100%)',
      'linear-gradient(135deg, #92400e 0%, #b45309 30%, #e8c9a0 60%, #78350f 100%)',
      'linear-gradient(135deg, #a16207 0%, #d4a574 30%, #92400e 60%, #78350f 100%)',
    ]
  }

  // Default / generic
  return [
    'linear-gradient(135deg, #1e3a5f 0%, #3b82f6 30%, #6366f1 60%, #1e40af 100%)',
    'linear-gradient(135deg, #3b82f6 0%, #6366f1 30%, #8b5cf6 60%, #1e3a5f 100%)',
    'linear-gradient(135deg, #1e40af 0%, #3b82f6 30%, #60a5fa 60%, #6366f1 100%)',
    'linear-gradient(135deg, #6366f1 0%, #3b82f6 40%, #1e3a5f 80%, #1e40af 100%)',
  ]
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-red-400'
  if (score >= 60) return 'text-orange-400'
  if (score >= 40) return 'text-yellow-400'
  if (score >= 20) return 'text-green-400'
  return 'text-blue-400'
}

function getScoreLabel(score: number): string {
  if (score >= 80) return 'Electric'
  if (score >= 60) return 'Buzzing'
  if (score >= 40) return 'Lively'
  if (score >= 20) return 'Chill'
  return 'Quiet'
}

export function VenueHeroCarousel({ venue, pulseScore, onBack }: VenueHeroCarouselProps) {
  const gradients = getCategoryGradients(venue.category)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isTouching, setIsTouching] = useState(false)
  const autoPlayRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const dragX = useMotionValue(0)
  const parallaxX = useTransform(dragX, [-300, 0, 300], [30, 0, -30])

  const startAutoPlay = useCallback(() => {
    if (autoPlayRef.current) clearInterval(autoPlayRef.current)
    autoPlayRef.current = setInterval(() => {
      if (!isTouching) {
        setCurrentIndex((prev) => (prev + 1) % gradients.length)
      }
    }, 5000)
  }, [isTouching, gradients.length])

  useEffect(() => {
    startAutoPlay()
    return () => {
      if (autoPlayRef.current) clearInterval(autoPlayRef.current)
    }
  }, [startAutoPlay])

  const handleDragEnd = (_: unknown, info: { offset: { x: number }; velocity: { x: number } }) => {
    const threshold = 50
    const velocity = info.velocity.x

    if (info.offset.x < -threshold || velocity < -500) {
      setCurrentIndex((prev) => Math.min(prev + 1, gradients.length - 1))
    } else if (info.offset.x > threshold || velocity > 500) {
      setCurrentIndex((prev) => Math.max(prev - 1, 0))
    }
    startAutoPlay()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      setCurrentIndex((prev) => Math.min(prev + 1, gradients.length - 1))
      startAutoPlay()
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      setCurrentIndex((prev) => Math.max(prev - 1, 0))
      startAutoPlay()
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative h-[320px] overflow-hidden rounded-b-3xl"
      role="region"
      aria-roledescription="carousel"
      aria-label="Venue images"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* Parallax background layer */}
      <motion.div
        className="absolute inset-0 scale-110"
        style={{ x: parallaxX }}
      >
        <AnimatePresence mode="popLayout">
          <motion.div
            key={currentIndex}
            className="absolute inset-0"
            style={{ background: gradients[currentIndex] }}
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
          />
        </AnimatePresence>
      </motion.div>

      {/* Decorative elements for visual interest */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{ x: parallaxX }}
      >
        <div className="absolute top-8 right-8 w-32 h-32 rounded-full bg-white/5 blur-xl" />
        <div className="absolute bottom-16 left-12 w-24 h-24 rounded-full bg-white/8 blur-lg" />
        <div className="absolute top-20 left-1/3 w-16 h-16 rounded-full bg-white/5 blur-md" />
      </motion.div>

      {/* Swipe gesture layer */}
      <motion.div
        className="absolute inset-0 z-10 cursor-grab active:cursor-grabbing"
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.2}
        onDragStart={() => setIsTouching(true)}
        onDragEnd={(e, info) => {
          setIsTouching(false)
          handleDragEnd(e, info)
        }}
        onTouchStart={() => {
          setIsTouching(true)
          if (autoPlayRef.current) clearInterval(autoPlayRef.current)
        }}
        onTouchEnd={() => {
          setIsTouching(false)
          startAutoPlay()
        }}
        style={{ x: dragX }}
      />

      {/* Gradient overlay for text readability */}
      <div className="absolute inset-0 z-20 pointer-events-none bg-gradient-to-t from-background via-background/40 to-transparent" />

      {/* Back button */}
      <button
        onClick={onBack}
        aria-label="Go back"
        className="absolute top-4 left-4 z-30 p-2.5 rounded-full bg-black/20 backdrop-blur-md border border-white/10 hover:bg-black/30 transition-colors"
      >
        <ArrowLeft size={22} weight="bold" className="text-white" />
      </button>

      {/* Live region announces carousel slide changes */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        Slide {currentIndex + 1} of {gradients.length}
      </div>

      {/* Content overlay */}
      <div className="absolute bottom-0 left-0 right-0 z-20 p-5 pointer-events-none">
        {/* Pulse score badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          className="mb-3"
        >
          <div className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/30 backdrop-blur-sm border border-white/10',
            getScoreColor(pulseScore)
          )}>
            <motion.div
              className="w-2 h-2 rounded-full bg-current"
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
            />
            <span className="text-sm font-bold">{pulseScore}</span>
            <span className="text-xs opacity-80">{getScoreLabel(pulseScore)}</span>
          </div>
        </motion.div>

        {/* Venue name */}
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="text-3xl font-bold text-white mb-1.5 drop-shadow-lg"
        >
          {venue.name}
        </motion.h1>

        {/* Category badge */}
        {venue.category && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.4 }}
          >
            <span className="inline-block px-2.5 py-1 rounded-md bg-white/15 backdrop-blur-sm text-xs font-mono uppercase tracking-wider text-white/90">
              {venue.category}
            </span>
          </motion.div>
        )}

        {/* Dot indicators */}
        <div className="flex items-center gap-2 mt-4" role="tablist" aria-label="Venue image slides">
          {gradients.map((_, index) => (
            <button
              key={index}
              className="pointer-events-auto relative"
              onClick={() => {
                setCurrentIndex(index)
                startAutoPlay()
              }}
              role="tab"
              aria-label={`Go to slide ${index + 1}`}
              aria-selected={index === currentIndex}
            >
              <div
                className={cn(
                  'h-1.5 rounded-full transition-all duration-300',
                  index === currentIndex
                    ? 'w-6 bg-white'
                    : 'w-1.5 bg-white/40'
                )}
              />
              {index === currentIndex && (
                <motion.div
                  layoutId="activeDot"
                  className="absolute inset-0 h-1.5 w-6 rounded-full bg-white"
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
