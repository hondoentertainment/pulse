import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.stubEnv('SUPABASE_URL', 'https://abcdefgh.supabase.co')

import {
  normalizePulseTimestamp,
  resolvePulseMediaUrl,
  rowToAppPulse,
  type PulseRow,
} from '../pulse-mapper'

const sampleRow: PulseRow = {
  id: 'pulse-1',
  user_id: 'user-1',
  venue_id: 'venue-1',
  crew_id: null,
  photos: ['pulse-videos/user-1/thumb.jpg'],
  video_url: 'pulse-videos/user-1/clip.mp4',
  energy_rating: 'electric',
  caption: 'Packed dance floor',
  hashtags: ['nightlife'],
  views: 12,
  is_pioneer: true,
  credibility_weight: 1.2,
  reactions: { fire: ['user-2'], eyes: [], skull: [], lightning: [] },
  created_at: '2026-06-15T10:00:00Z',
  expires_at: '2026-06-15T11:30:00Z',
  deleted_at: null,
}

describe('pulse-mapper', () => {
  beforeEach(() => {
    vi.stubEnv('SUPABASE_URL', 'https://abcdefgh.supabase.co')
  })

  it('maps DB rows to app pulse shape with normalized media URLs', () => {
    const pulse = rowToAppPulse(sampleRow)
    expect(pulse.id).toBe('pulse-1')
    expect(pulse.userId).toBe('user-1')
    expect(pulse.photos[0]).toContain('/storage/v1/object/public/pulse-videos/')
    expect(pulse.video).toContain('/storage/v1/object/public/pulse-videos/')
    expect(pulse.createdAt).toBe('2026-06-15T10:00:00.000Z')
    expect(pulse.isPending).toBe(false)
  })

  it('resolves storage paths on the server', () => {
    expect(resolvePulseMediaUrl('pulse-videos/u/v.mp4')).toContain(
      'https://abcdefgh.supabase.co/storage/v1/object/public/pulse-videos/u/v.mp4',
    )
  })

  it('normalizes timestamps', () => {
    expect(normalizePulseTimestamp('bad')).toBe(new Date(0).toISOString())
  })
})
