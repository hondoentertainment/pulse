/**
 * Image/Video CDN Optimizer
 *
 * URL transforms for responsive image delivery,
 * lazy loading support, and srcset generation.
 */

export interface ImageOptions {
  width?: number
  height?: number
  quality?: number
  format?: 'webp' | 'avif' | 'jpeg' | 'png' | 'auto'
  fit?: 'cover' | 'contain' | 'fill' | 'inside'
  blur?: number
}

export interface ResponsiveImage {
  src: string
  srcSet: string
  sizes: string
  placeholder?: string
}

const DEFAULT_QUALITY = 80
const BREAKPOINTS = [320, 640, 768, 1024, 1280]

/**
 * Build a CDN URL with image transforms.
 */
export function buildImageUrl(src: string, options: ImageOptions = {}): string {
  if (!src) return ''

  const params = new URLSearchParams()
  if (options.width) params.set('w', options.width.toString())
  if (options.height) params.set('h', options.height.toString())
  params.set('q', (options.quality ?? DEFAULT_QUALITY).toString())
  if (options.format && options.format !== 'auto') params.set('fm', options.format)
  if (options.fit) params.set('fit', options.fit)
  if (options.blur) params.set('blur', options.blur.toString())

  const separator = src.includes('?') ? '&' : '?'
  return `${src}${separator}${params.toString()}`
}

/**
 * Generate responsive image attributes (src, srcSet, sizes).
 */
export function getResponsiveImage(
  src: string,
  options: { maxWidth?: number; quality?: number; aspect?: string } = {}
): ResponsiveImage {
  const { maxWidth = 1280, quality = DEFAULT_QUALITY } = options

  const applicableBreakpoints = BREAKPOINTS.filter(bp => bp <= maxWidth)

  const srcSet = applicableBreakpoints
    .map(w => `${buildImageUrl(src, { width: w, quality, format: 'webp' })} ${w}w`)
    .join(', ')

  const sizes = applicableBreakpoints
    .map((bp, i) => {
      if (i === applicableBreakpoints.length - 1) return `${bp}px`
      return `(max-width: ${bp}px) ${bp}px`
    })
    .join(', ')

  const placeholder = buildImageUrl(src, { width: 20, quality: 10, blur: 20 })

  return {
    src: buildImageUrl(src, { width: maxWidth, quality, format: 'webp' }),
    srcSet,
    sizes,
    placeholder,
  }
}

/**
 * Generate a thumbnail URL for a video.
 */
export function getVideoThumbnail(videoUrl: string, options: { width?: number; time?: number } = {}): string {
  const { width = 640, time = 1 } = options
  const params = new URLSearchParams({ w: width.toString(), t: time.toString(), fm: 'jpg' })
  const separator = videoUrl.includes('?') ? '&' : '?'
  return `${videoUrl}${separator}${params.toString()}`
}

/**
 * Get optimized avatar URL for different sizes.
 */
export function getAvatarUrl(
  src: string | undefined,
  size: 'small' | 'medium' | 'large' = 'medium'
): string {
  if (!src) return ''
  const sizeMap = { small: 48, medium: 96, large: 256 }
  const px = sizeMap[size]
  return buildImageUrl(src, { width: px, height: px, fit: 'cover', format: 'webp', quality: 85 })
}

/**
 * Check if the browser supports a given image format.
 */
export function supportsImageFormat(format: 'webp' | 'avif'): boolean {
  if (typeof document === 'undefined') return false
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  return canvas.toDataURL(`image/${format}`).startsWith(`data:image/${format}`)
}

/**
 * Preload critical images.
 */
export function preloadImage(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve()
    img.onerror = reject
    img.src = src
  })
}

/**
 * Preload multiple images concurrently.
 */
export function preloadImages(srcs: string[]): Promise<PromiseSettledResult<void>[]> {
  return Promise.allSettled(srcs.map(preloadImage))
}
