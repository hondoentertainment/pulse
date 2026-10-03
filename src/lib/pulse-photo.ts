/**
 * Optional single compressed photo on a pulse.
 * Client-compress only. Store on pulses.photos the way the row already does.
 * No S3 / Cloudinary / new buckets.
 */

export const PULSE_PHOTO_MAX_EDGE = 1280
export const PULSE_PHOTO_MAX_BYTES = 180_000
export const PULSE_PHOTO_MIME = 'image/jpeg'
export const PULSE_PHOTO_QUALITY = 0.72

export function isAllowedPulsePhotoType(mime: string | undefined): boolean {
  if (!mime) return false
  return mime === 'image/jpeg' || mime === 'image/png' || mime === 'image/webp' || mime === 'image/heic'
}

export function constrainPulsePhotoDataUrl(dataUrl: string, maxBytes = PULSE_PHOTO_MAX_BYTES): string | null {
  if (!dataUrl.startsWith('data:image/')) return null
  if (dataUrl.length > maxBytes * 1.4) return null
  return dataUrl
}

export async function compressPulsePhotoFile(file: File): Promise<string> {
  if (!file || file.size <= 0) {
    throw new Error('Choose one photo')
  }
  if (!isAllowedPulsePhotoType(file.type) && !file.type.startsWith('image/')) {
    throw new Error('Photo must be an image')
  }

  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, PULSE_PHOTO_MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    throw new Error('Could not compress photo')
  }
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  let quality = PULSE_PHOTO_QUALITY
  let dataUrl = canvas.toDataURL(PULSE_PHOTO_MIME, quality)
  while (dataUrl.length > PULSE_PHOTO_MAX_BYTES * 1.37 && quality > 0.4) {
    quality -= 0.08
    dataUrl = canvas.toDataURL(PULSE_PHOTO_MIME, quality)
  }
  const constrained = constrainPulsePhotoDataUrl(dataUrl)
  if (!constrained) {
    throw new Error('Photo is too large after compression')
  }
  return constrained
}
