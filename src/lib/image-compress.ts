/**
 * Client-side image downscale / JPEG recompress for pulse + vibe vision uploads.
 */

export interface CompressImageOptions {
  maxWidth?: number
  maxHeight?: number
  quality?: number
}

export interface CompressImageResult {
  dataUrl: string
  blob: Blob
  format: 'jpeg'
  width: number
  height: number
  originalBytes: number
  compressedBytes: number
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to decode image'))
    img.src = dataUrl
  })
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error('canvas.toBlob returned null'))
        else resolve(blob)
      },
      'image/jpeg',
      quality,
    )
  })
}

/**
 * Downscale and re-encode as JPEG. No-ops gracefully when Canvas/Image
 * APIs are unavailable (SSR / some test envs) by returning null.
 */
export async function compressImageDataUrl(
  dataUrl: string,
  opts: CompressImageOptions = {},
): Promise<CompressImageResult | null> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    return null
  }

  const maxWidth = opts.maxWidth ?? 1280
  const maxHeight = opts.maxHeight ?? 1280
  const quality = opts.quality ?? 0.72

  const originalBytes = Math.ceil((dataUrl.length * 3) / 4)
  const img = await loadImage(dataUrl)

  let { width, height } = img
  const scale = Math.min(1, maxWidth / width, maxHeight / height)
  width = Math.max(1, Math.round(width * scale))
  height = Math.max(1, Math.round(height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(img, 0, 0, width, height)

  const blob = await canvasToBlob(canvas, quality)
  const compressedDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Failed to read compressed blob'))
    reader.readAsDataURL(blob)
  })

  return {
    dataUrl: compressedDataUrl,
    blob,
    format: 'jpeg',
    width,
    height,
    originalBytes,
    compressedBytes: blob.size,
  }
}
