import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Play, X } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

interface PulseMediaCarouselProps {
  photos?: string[]
  video?: string
  altPrefix?: string
  className?: string
  onDoubleTap?: () => void
}

type MediaItem =
  | { type: 'video'; src: string }
  | { type: 'photo'; src: string }

export function PulseMediaCarousel({
  photos = [],
  video,
  altPrefix = 'Pulse media',
  className,
  onDoubleTap,
}: PulseMediaCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [expanded, setExpanded] = useState(false)
  const [isVideoPlaying, setIsVideoPlaying] = useState(false)
  const items: MediaItem[] = [
    ...(video ? [{ type: 'video' as const, src: video }] : []),
    ...photos.map(src => ({ type: 'photo' as const, src })),
  ]

  if (items.length === 0) return null

  const active = items[Math.min(activeIndex, items.length - 1)]

  return (
    <>
      <div className={cn("relative overflow-hidden bg-secondary", className)}>
        <button
          type="button"
          onClick={() => setExpanded(true)}
          onDoubleClick={(event) => {
            event.preventDefault()
            onDoubleTap?.()
          }}
          className="block w-full text-left"
          aria-label="Open media"
        >
          <div className="relative aspect-square w-full overflow-hidden bg-muted sm:aspect-[4/5]">
            {active.type === 'video' ? (
              <video
                src={active.src}
                controls
                playsInline
                className="h-full w-full object-cover"
                onPlay={() => setIsVideoPlaying(true)}
                onPause={() => setIsVideoPlaying(false)}
              />
            ) : (
              <img
                src={active.src}
                alt={`${altPrefix} ${activeIndex + 1}`}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
            )}

            {active.type === 'video' && !isVideoPlaying && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 text-black">
                  <Play size={32} weight="fill" className="ml-1" />
                </div>
              </div>
            )}
          </div>
        </button>

        {items.length > 1 && (
          <>
            <div className="absolute right-3 top-3 rounded-full bg-black/55 px-2 py-1 text-xs font-semibold text-white backdrop-blur">
              {activeIndex + 1}/{items.length}
            </div>
            <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
              {items.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  aria-label={`Show media ${index + 1}`}
                  className={cn(
                    "h-1.5 rounded-full bg-white/45 transition-all",
                    index === activeIndex ? "w-5 bg-white" : "w-1.5"
                  )}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/95 p-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur"
              aria-label="Close media"
            >
              <X size={24} weight="bold" />
            </button>
            <motion.div
              className="max-h-full w-full max-w-3xl overflow-hidden rounded-lg"
              initial={{ scale: 0.96 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.96 }}
            >
              {active.type === 'video' ? (
                <video src={active.src} controls autoPlay playsInline className="max-h-[88vh] w-full object-contain" />
              ) : (
                <img src={active.src} alt={`${altPrefix} expanded`} className="max-h-[88vh] w-full object-contain" />
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
