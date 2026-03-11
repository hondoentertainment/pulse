import { useState, useEffect, useCallback } from 'react'
import { PulseStory } from '@/lib/stories'
import { ENERGY_CONFIG } from '@/lib/types'
import { X } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { STORY_REACTIONS } from '@/lib/stories'

interface StoryViewerProps {
  stories: PulseStory[]
  initialIndex?: number
  currentUserId: string
  onClose: () => void
  onReact: (storyId: string, emoji: string) => void
}

export function StoryViewer({ stories, initialIndex = 0, currentUserId, onClose, onReact }: StoryViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [progress, setProgress] = useState(0)

  const story = stories[currentIndex]

  const goNext = useCallback(() => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex(i => i + 1)
      setProgress(0)
    } else {
      onClose()
    }
  }, [currentIndex, stories.length, onClose])

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(i => i - 1)
      setProgress(0)
    }
  }, [currentIndex])

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          goNext()
          return 0
        }
        return p + 2
      })
    }, 100)
    return () => clearInterval(timer)
  }, [currentIndex, goNext])

  if (!story) return null

  const energyConfig = ENERGY_CONFIG[story.energyRating]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black flex flex-col"
    >
      {/* Progress bars */}
      <div className="flex gap-1 px-2 pt-2 z-10">
        {stories.map((_, i) => (
          <div key={i} className="flex-1 h-0.5 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-100"
              style={{ width: i < currentIndex ? '100%' : i === currentIndex ? `${progress}%` : '0%' }}
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 z-10">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
          <span className="text-xs font-bold text-white">{story.userId.slice(-2).toUpperCase()}</span>
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-white">{story.venueName || 'Venue'}</p>
          <p className="text-xs text-white/60">
            {new Date(story.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
          </p>
        </div>
        <button onClick={onClose} className="p-2 text-white/80 hover:text-white">
          <X size={24} weight="bold" />
        </button>
      </div>

      {/* Story content */}
      <div className="flex-1 relative flex items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={story.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="w-full h-full flex flex-col items-center justify-center px-8"
          >
            {story.photos.length > 0 ? (
              <img src={story.photos[0]} alt="" className="max-h-[60vh] rounded-xl object-cover" />
            ) : (
              <div
                className="w-full max-w-sm aspect-square rounded-2xl flex items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${energyConfig.color}, oklch(0.2 0.05 270))` }}
              >
                <span className="text-6xl">{energyConfig.emoji}</span>
              </div>
            )}
            {story.caption && (
              <p className="text-white text-center mt-4 text-lg font-medium max-w-xs">{story.caption}</p>
            )}
            <div className="mt-3 px-3 py-1 rounded-full" style={{ backgroundColor: energyConfig.color + '33' }}>
              <span className="text-sm text-white">{energyConfig.emoji} {energyConfig.label}</span>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Navigation tap zones */}
        <button
          onClick={goPrev}
          className="absolute left-0 top-0 bottom-0 w-1/3"
          aria-label="Previous story"
        />
        <button
          onClick={goNext}
          className="absolute right-0 top-0 bottom-0 w-1/3"
          aria-label="Next story"
        />
      </div>

      {/* Reactions */}
      <div className="px-4 py-4 flex items-center justify-center gap-4 z-10">
        {STORY_REACTIONS.map(emoji => (
          <button
            key={emoji}
            onClick={() => onReact(story.id, emoji)}
            className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 active:scale-90 transition-all"
          >
            <span className="text-lg">{emoji}</span>
          </button>
        ))}
      </div>
    </motion.div>
  )
}
