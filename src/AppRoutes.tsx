/**
 * Video-feed route wiring.
 *
 * The canonical top-level `<Routes>` lives in `src/App.tsx` (locked from
 * modification). This module exports a small `VideoFeedRoute` component that
 * `App.tsx` (or a future composed router) can mount as a lazy-loaded route
 * without pulling the video feed into the initial chunk.
 *
 * To keep bundle impact minimal, the import of `VideoFeed` is route-lazy —
 * it is not referenced from the main chunk when the feature flag is off.
 */

import { lazy, Suspense } from 'react'
import { isVideoFeedEnabled } from '@/lib/video-feature-flag'

const VideoFeed = lazy(() => import('@/components/video/VideoFeed').then((m) => ({ default: m.VideoFeed })))

const pageFallback = (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <p className="text-muted-foreground">Loading video feed…</p>
  </div>
)

export function VideoFeedRoute() {
  if (!isVideoFeedEnabled()) {
    // Feature flag disabled — behave as if the route does not exist.
    return <div className="min-h-screen bg-background" aria-hidden />
  }
  return (
    <Suspense fallback={pageFallback}>
      <VideoFeed />
    </Suspense>
  )
}

export default VideoFeedRoute
