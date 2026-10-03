import { describe, expect, it } from 'vitest'
import { constrainPulsePhotoDataUrl, isAllowedPulsePhotoType, PULSE_PHOTO_MAX_BYTES } from '../pulse-photo'

describe('pulse photo', () => {
  it('accepts a single compressed image type and rejects non-images', () => {
    expect(isAllowedPulsePhotoType('image/jpeg')).toBe(true)
    expect(isAllowedPulsePhotoType('image/png')).toBe(true)
    expect(isAllowedPulsePhotoType('video/mp4')).toBe(false)
    expect(isAllowedPulsePhotoType('application/pdf')).toBe(false)
  })

  it('keeps a constrained data URL on the pulse row and drops oversized payloads', () => {
    const ok = `data:image/jpeg;base64,${'a'.repeat(80)}`
    expect(constrainPulsePhotoDataUrl(ok)).toBe(ok)
    expect(constrainPulsePhotoDataUrl('https://cdn.example/photo.jpg')).toBeNull()
    expect(constrainPulsePhotoDataUrl(`data:image/jpeg;base64,${'x'.repeat(PULSE_PHOTO_MAX_BYTES * 2)}`)).toBeNull()
  })
})
