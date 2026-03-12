import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { generateBlurhash, type ImageLoadState } from '@/lib/performance-engine'

interface ProgressiveImageProps {
  src: string
  thumbnailSrc?: string
  alt: string
  className?: string
  /** Base color for the gradient placeholder. Defaults to a dark neutral. */
  placeholderColor?: string
  width?: number
  height?: number
}

/**
 * Three-stage progressive image loader:
 *   1. CSS gradient placeholder (instant)
 *   2. Low-res thumbnail (blurred)
 *   3. Full-resolution image (crossfades in)
 *
 * Uses IntersectionObserver to defer loading until the element enters the
 * viewport.
 */
export function ProgressiveImage({
  src,
  thumbnailSrc,
  alt,
  className,
  placeholderColor,
  width = 400,
  height = 300,
}: ProgressiveImageProps) {
  const [stage, setStage] = useState<ImageLoadState>('placeholder')
  const [isInView, setIsInView] = useState(false)
  const [hasError, setHasError] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Observe intersection
  useEffect(() => {
    const node = containerRef.current
    if (!node) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true)
          observer.disconnect()
        }
      },
      { rootMargin: '200px' }
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  // Load thumbnail when in view
  useEffect(() => {
    if (!isInView || !thumbnailSrc) return

    const img = new Image()
    img.src = thumbnailSrc
    img.onload = () => {
      if (!hasError) setStage('thumbnail')
    }
    img.onerror = () => {
      // Skip thumbnail stage, try full image directly
    }
  }, [isInView, thumbnailSrc, hasError])

  // Load full image when in view (or after thumbnail)
  useEffect(() => {
    if (!isInView) return

    const img = new Image()
    img.src = src
    img.onload = () => {
      setHasError(false)
      setStage('full')
    }
    img.onerror = () => {
      setHasError(true)
    }
  }, [isInView, src])

  const placeholder = placeholderColor
    ? `linear-gradient(135deg, ${placeholderColor} 0%, ${placeholderColor}88 100%)`
    : generateBlurhash(width, height)

  const handleRetry = useCallback(() => {
    setHasError(false)
    setStage('placeholder')
  }, [])

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${className ?? ''}`}
      style={{ aspectRatio: `${width}/${height}` }}
      role="img"
      aria-label={alt}
    >
      {/* Stage 1: Gradient placeholder (always rendered as base layer) */}
      <div
        className="absolute inset-0"
        style={{ background: placeholder }}
        aria-hidden="true"
      />

      <AnimatePresence>
        {/* Stage 2: Thumbnail (blurred) */}
        {stage === 'thumbnail' && thumbnailSrc && (
          <motion.img
            key="thumbnail"
            src={thumbnailSrc}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover"
            style={{ filter: 'blur(20px)', transform: 'scale(1.1)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          />
        )}

        {/* Stage 3: Full image */}
        {stage === 'full' && !hasError && (
          <motion.img
            key="full"
            src={src}
            alt={alt}
            className="absolute inset-0 h-full w-full object-cover"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
          />
        )}
      </AnimatePresence>

      {/* Error state */}
      {hasError && (
        <button
          onClick={handleRetry}
          className="absolute inset-0 flex items-center justify-center bg-zinc-900/80 text-zinc-400 text-sm"
          aria-label={`Failed to load image: ${alt}. Tap to retry.`}
        >
          <span className="text-center px-4">
            Failed to load
            <br />
            <span className="text-xs underline">Tap to retry</span>
          </span>
        </button>
      )}
    </div>
  )
}
