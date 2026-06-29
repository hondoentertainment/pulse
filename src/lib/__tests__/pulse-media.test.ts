import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  normalizePulse,
  normalizePulseMedia,
  normalizePulseTimestamp,
  resolvePulseMediaUrl,
} from '../pulse-media'

describe('pulse-media', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://abcdefgh.supabase.co')
  })

  it('normalizes storage object keys to public URLs', () => {
    expect(resolvePulseMediaUrl('pulse-videos/user-1/clip.mp4')).toBe(
      'https://abcdefgh.supabase.co/storage/v1/object/public/pulse-videos/user-1/clip.mp4',
    )
  })

  it('leaves absolute URLs unchanged', () => {
    const url = 'https://cdn.example.com/photo.jpg'
    expect(resolvePulseMediaUrl(url)).toBe(url)
  })

  it('appends low-quality hint for storage URLs', () => {
    expect(
      resolvePulseMediaUrl('pulse-videos/user-1/clip.mp4', { quality: 'low' }),
    ).toContain('q=low')
  })

  it('normalizes invalid timestamps to epoch ISO strings', () => {
    expect(normalizePulseTimestamp('not-a-date')).toBe(new Date(0).toISOString())
    expect(normalizePulseTimestamp('2026-06-15T12:00:00.000Z')).toBe('2026-06-15T12:00:00.000Z')
  })

  it('normalizes pulse media fields', () => {
    const normalized = normalizePulseMedia({
      photos: ['pulse-videos/u/p.jpg'],
      video: 'pulse-videos/u/v.mp4',
    })
    expect(normalized.photos[0]).toContain('/storage/v1/object/public/pulse-videos/')
    expect(normalized.video).toContain('/storage/v1/object/public/pulse-videos/')
  })

  it('normalizes full pulse records', () => {
    const pulse = normalizePulse({
      id: 'p1',
      userId: 'u1',
      venueId: 'v1',
      photos: [],
      energyRating: 'chill',
      hashtags: [],
      views: 0,
      isPioneer: false,
      credibilityWeight: 1,
      reactions: { fire: [], eyes: [], skull: [], lightning: [] },
      createdAt: '2026-06-15T10:00:00Z',
      expiresAt: '2026-06-15T11:30:00Z',
      isPending: false,
      uploadError: false,
    })
    expect(pulse.createdAt).toBe('2026-06-15T10:00:00.000Z')
    expect(pulse.expiresAt).toBe('2026-06-15T11:30:00.000Z')
  })
})
