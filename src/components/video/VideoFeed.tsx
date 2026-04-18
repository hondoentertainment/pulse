/**
 * Vertical TikTok-style video feed.
 *
 * Rendering model: a `overflow-y-scroll snap-y snap-mandatory` container
 * holds one full-viewport snap target per pulse. An IntersectionObserver
 * watches each slot and toggles play/pause so only the visible `<video>`
 * is active — memory + battery win on mobile.
 *
 * Adaptive quality: when `navigator.connection.effectiveType` is 2g/3g we
 * pass `?q=low` to the video URL. The Edge storage layer is expected to
 * deliver a downscaled variant at that query param; until that's wired up,
 * the query string is benign.
 *
 * This component is route-lazy from `AppRoutes.tsx` to keep the main bundle
 * small — it is never part of the initial chunk when the feed flag is off.
 */

import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useVideoFeed } from '@/hooks/use-video-feed'
import type { VideoFeedItem } from '@/lib/video-client'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const VideoCaptureSheet = lazy(() =>
  import('@/components/video/VideoCaptureSheet').then((m) => ({ default: m.VideoCaptureSheet })),
)

// --- analytics shim ---------------------------------------------------
// The in-tree analytics API (`trackEvent`) is event-typed; since we don't
// own that enum we emit via a loose `pulse_viewed` event if available,
// falling back to a no-op. The constraint forbids modifying analytics.ts.
function track(event: string, props: Record<string, unknown>): void {
  try {
    const w = globalThis as unknown as {
      va?: (action: string, props?: Record<string, unknown>) => void
      // Vercel Analytics attaches to `window.va` at runtime.
    }
    if (typeof w.va === 'function') w.va(event, props)
  } catch {
    /* analytics is best-effort */
  }
}

// --- network quality hint ---------------------------------------------
type EffectiveType = 'slow-2g' | '2g' | '3g' | '4g' | undefined

function useEffectiveConnectionType(): EffectiveType {
  const [type, setType] = useState<EffectiveType>(undefined)

  useEffect(() => {
    const nav = navigator as unknown as {
      connection?: {
        effectiveType?: EffectiveType
        addEventListener?: (t: string, cb: () => void) => void
        removeEventListener?: (t: string, cb: () => void) => void
      }
    }
    const c = nav.connection
    if (!c) return
    setType(c.effectiveType)
    const onChange = () => setType(c.effectiveType)
    c.addEventListener?.('change', onChange)
    return () => c.removeEventListener?.('change', onChange)
  }, [])

  return type
}

function qualitySuffix(type: EffectiveType): string {
  if (type === 'slow-2g' || type === '2g' || type === '3g') return '?q=low'
  return ''
}

// --- component --------------------------------------------------------

export interface VideoFeedProps {
  viewer?: { lat: number; lng: number } | null
  enabled?: boolean
  onOpenVenue?: (venueId: string) => void
  onReact?: (pulseId: string) => void
}

export function VideoFeed({
  viewer = null,
  enabled = true,
  onOpenVenue,
  onReact,
}: VideoFeedProps) {
  const { items, isLoading, hasNextPage, fetchNextPage, error } = useVideoFeed({ viewer, enabled })

  const [captureOpen, setCaptureOpen] = useState(false)
  const effective = useEffectiveConnectionType()

  // Sound: muted by default; persist the unmuted choice per-session only.
  const [unmuted, setUnmuted] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('video-feed-unmuted') === '1'
    } catch {
      return false
    }
  })
  const toggleSound = useCallback(() => {
    setUnmuted((prev) => {
      const next = !prev
      try {
        sessionStorage.setItem('video-feed-unmuted', next ? '1' : '0')
      } catch {
        /* noop */
      }
      return next
    })
  }, [])

  if (!enabled) return null

  if (isLoading && items.length === 0) {
    return <VideoFeedSkeleton />
  }

  if (error && items.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        <p>Couldn't load the video feed. Pull to retry.</p>
      </div>
    )
  }

  if (!isLoading && items.length === 0) {
    return (
      <EmptyState
        onOpenCapture={() => setCaptureOpen(true)}
        captureOpen={captureOpen}
        onCloseCapture={() => setCaptureOpen(false)}
      />
    )
  }

  return (
    <div className="relative w-full h-[calc(100vh-4rem)] bg-black overflow-hidden">
      <div
        data-testid="video-feed-scroller"
        className="w-full h-full overflow-y-scroll snap-y snap-mandatory"
        style={{ scrollSnapStop: 'always' }}
      >
        {items.map((item, index) => (
          <VideoSlot
            key={item.id}
            item={item}
            index={index}
            unmuted={unmuted}
            qualitySuffix={qualitySuffix(effective)}
            onVisible={() => {
              track('pulse_viewed', { pulseId: item.id, feed: 'video', position: index })
            }}
            onSoundToggle={toggleSound}
            onOpenVenue={onOpenVenue}
            onReact={onReact}
          />
        ))}
        {/* Sentinel — when this scrolls into view, prefetch the next page. */}
        <InfiniteSentinel onReach={fetchNextPage} hasNextPage={hasNextPage} />
      </div>

      {/* FAB: open capture sheet */}
      <button
        type="button"
        onClick={() => setCaptureOpen(true)}
        className="absolute bottom-4 right-4 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center z-20"
        aria-label="Record a video pulse"
      >
        +
      </button>

      {captureOpen && (
        <Suspense fallback={null}>
          <VideoCaptureSheet open={captureOpen} onClose={() => setCaptureOpen(false)} />
        </Suspense>
      )}
    </div>
  )
}

// --- slot -----------------------------------------------------------

interface VideoSlotProps {
  item: VideoFeedItem
  index: number
  unmuted: boolean
  qualitySuffix: string
  onVisible: () => void
  onSoundToggle: () => void
  onOpenVenue?: (venueId: string) => void
  onReact?: (pulseId: string) => void
}

function VideoSlot({
  item,
  index,
  unmuted,
  qualitySuffix,
  onVisible,
  onSoundToggle,
  onOpenVenue,
  onReact,
}: VideoSlotProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const slotRef = useRef<HTMLDivElement | null>(null)
  const firedViewRef = useRef(false)
  const [reacted, setReacted] = useState(false)

  useEffect(() => {
    const slot = slotRef.current
    const video = videoRef.current
    if (!slot || !video) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            video.play().catch(() => {
              /* autoplay rejected (uncommon when muted) */
            })
            if (!firedViewRef.current) {
              firedViewRef.current = true
              onVisible()
            }
          } else {
            video.pause()
          }
        }
      },
      { threshold: [0, 0.6, 1] },
    )
    observer.observe(slot)
    return () => observer.disconnect()
  }, [onVisible])

  // Double-tap for react — collapsed tap tracking.
  const lastTapRef = useRef(0)
  const onTap = useCallback(() => {
    const now = Date.now()
    if (now - lastTapRef.current < 280) {
      setReacted(true)
      onReact?.(item.id)
    } else {
      onSoundToggle()
    }
    lastTapRef.current = now
  }, [item.id, onReact, onSoundToggle])

  const swipeLeftHandlers = useMemo(() => {
    let startX = 0
    return {
      onTouchStart: (e: React.TouchEvent<HTMLDivElement>) => {
        startX = e.touches[0]?.clientX ?? 0
      },
      onTouchEnd: (e: React.TouchEvent<HTMLDivElement>) => {
        const endX = e.changedTouches[0]?.clientX ?? startX
        if (startX - endX > 80) onOpenVenue?.(item.venueId)
      },
    }
  }, [item.venueId, onOpenVenue])

  const src = `${item.videoUrl}${qualitySuffix}`

  return (
    <div
      ref={slotRef}
      data-testid={`video-slot-${index}`}
      className="relative w-full h-full snap-start bg-black"
      style={{ height: '100%' }}
      {...swipeLeftHandlers}
      onClick={onTap}
    >
      <video
        ref={videoRef}
        src={src}
        poster={item.videoThumbnailUrl ?? undefined}
        muted={!unmuted}
        loop
        playsInline
        preload="metadata"
        className="w-full h-full object-cover"
        data-testid={`video-el-${index}`}
      />

      <div className="absolute bottom-6 left-4 right-4 flex flex-col gap-2 text-white pointer-events-none">
        {item.caption && <p className="text-sm drop-shadow-md">{item.caption}</p>}
        {item.hashtags.length > 0 && (
          <p className="text-xs opacity-80">
            {item.hashtags.map((h) => `#${h}`).join(' ')}
          </p>
        )}
      </div>

      <div
        className={cn(
          'absolute top-4 right-4 px-2 py-1 rounded-full text-xs font-medium',
          unmuted ? 'bg-primary text-primary-foreground' : 'bg-black/60 text-white',
        )}
        aria-live="polite"
      >
        {unmuted ? 'Sound on' : 'Muted — tap for sound'}
      </div>

      {reacted && (
        <div
          aria-hidden
          className="absolute inset-0 flex items-center justify-center text-6xl pointer-events-none"
        >
          🔥
        </div>
      )}
    </div>
  )
}

// --- sentinel -------------------------------------------------------

function InfiniteSentinel({
  onReach,
  hasNextPage,
}: {
  onReach: () => void
  hasNextPage: boolean
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!hasNextPage) return
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) onReach()
      },
      { threshold: 0.1 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [onReach, hasNextPage])

  return (
    <div
      ref={ref}
      className="w-full h-16 flex items-center justify-center text-muted-foreground snap-end"
      data-testid="video-feed-sentinel"
    >
      {hasNextPage ? 'Loading…' : 'You\u2019re all caught up'}
    </div>
  )
}

// --- empty / skeleton -----------------------------------------------

function VideoFeedSkeleton() {
  return (
    <div
      data-testid="video-feed-skeleton"
      className="w-full h-[calc(100vh-4rem)] bg-black flex flex-col gap-1 p-2"
    >
      <Skeleton className="flex-1 w-full rounded-lg bg-muted/20" />
      <Skeleton className="flex-1 w-full rounded-lg bg-muted/20" />
    </div>
  )
}

function EmptyState({
  onOpenCapture,
  captureOpen,
  onCloseCapture,
}: {
  onOpenCapture: () => void
  captureOpen: boolean
  onCloseCapture: () => void
}) {
  return (
    <div
      data-testid="video-feed-empty"
      className="w-full h-[calc(100vh-4rem)] bg-black text-white flex flex-col items-center justify-center gap-4"
    >
      <p className="text-lg font-semibold">No video pulses yet</p>
      <p className="text-sm text-muted-foreground">Be the first to pulse a venue.</p>
      <button
        type="button"
        className="px-4 py-2 rounded-full bg-primary text-primary-foreground"
        onClick={onOpenCapture}
      >
        Record a pulse
      </button>
      {captureOpen && (
        <Suspense fallback={null}>
          <VideoCaptureSheet open={captureOpen} onClose={onCloseCapture} />
        </Suspense>
      )}
    </div>
  )
}

export default VideoFeed
