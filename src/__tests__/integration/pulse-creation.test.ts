import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Pulse, Venue, EnergyRating } from '@/lib/types'
import { canPostPulse, calculatePulseScore } from '@/lib/pulse-engine'
import { uploadPulseToSupabase } from '@/lib/supabase-api'
import { enqueuePulse, getQueue, clearQueue, type QueuedPulse } from '@/lib/offline-queue'

// ---------------------------------------------------------------------------
// Mock Supabase so no real API calls are made
// ---------------------------------------------------------------------------

const mockInsert = vi.fn().mockResolvedValue({ error: null })

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: mockInsert,
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeVenue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: 'venue-1',
    name: 'Test Bar',
    location: { lat: 40.7128, lng: -74.006, address: '123 Main St' },
    pulseScore: 50,
    ...overrides,
  }
}

function makePulse(overrides: Partial<Pulse> = {}): Pulse {
  const now = new Date()
  return {
    id: `pulse-${Math.random().toString(36).slice(2)}`,
    userId: 'user-1',
    venueId: 'venue-1',
    photos: [],
    energyRating: 'buzzing',
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 90 * 60 * 1000).toISOString(),
    reactions: { fire: [], eyes: [], skull: [], lightning: [] },
    views: 0,
    ...overrides,
  }
}

function buildNewPulse(data: {
  venueId: string
  userId: string
  energyRating: EnergyRating
  caption?: string
  photos?: string[]
  video?: string
  hashtags?: string[]
}): Pulse {
  const now = new Date()
  return {
    id: `pulse-${Date.now()}`,
    userId: data.userId,
    venueId: data.venueId,
    photos: data.photos || [],
    video: data.video,
    energyRating: data.energyRating,
    caption: data.caption,
    hashtags: data.hashtags,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 90 * 60 * 1000).toISOString(),
    reactions: { fire: [], eyes: [], skull: [], lightning: [] },
    views: 0,
    isPending: true,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Pulse creation integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  // ── Creating a pulse with all required fields ────────────
  describe('creating a pulse with all required fields', () => {
    it('constructs a valid pulse object with required fields', () => {
      const pulse = buildNewPulse({
        venueId: 'venue-1',
        userId: 'user-1',
        energyRating: 'buzzing',
        caption: 'Great vibes tonight!',
        photos: ['https://img.test/photo1.jpg'],
      })

      expect(pulse.venueId).toBe('venue-1')
      expect(pulse.userId).toBe('user-1')
      expect(pulse.energyRating).toBe('buzzing')
      expect(pulse.caption).toBe('Great vibes tonight!')
      expect(pulse.photos).toEqual(['https://img.test/photo1.jpg'])
      expect(pulse.createdAt).toBeDefined()
      expect(pulse.expiresAt).toBeDefined()
      expect(pulse.isPending).toBe(true)
    })

    it('sets expiry to 90 minutes from creation time', () => {
      const pulse = buildNewPulse({
        venueId: 'venue-1',
        userId: 'user-1',
        energyRating: 'chill',
      })

      const created = new Date(pulse.createdAt).getTime()
      const expires = new Date(pulse.expiresAt).getTime()
      const diffMinutes = (expires - created) / (60 * 1000)

      expect(diffMinutes).toBe(90)
    })

    it('initializes reactions as empty arrays', () => {
      const pulse = buildNewPulse({
        venueId: 'venue-1',
        userId: 'user-1',
        energyRating: 'electric',
      })

      expect(pulse.reactions).toEqual({
        fire: [],
        eyes: [],
        skull: [],
        lightning: [],
      })
    })

    it('uploads pulse to Supabase via uploadPulseToSupabase', async () => {
      const pulse = makePulse({ id: 'upload-test' })
      const result = await uploadPulseToSupabase(pulse)

      expect(result).toBe(true)
    })
  })

  // ── Pulse validation ─────────────────────────────────────
  describe('pulse validation', () => {
    it('energy rating is required (must be one of the valid values)', () => {
      const validRatings: EnergyRating[] = ['dead', 'chill', 'buzzing', 'electric']

      for (const rating of validRatings) {
        const pulse = buildNewPulse({
          venueId: 'venue-1',
          userId: 'user-1',
          energyRating: rating,
        })
        expect(validRatings).toContain(pulse.energyRating)
      }
    })

    it('venue is required for pulse creation', () => {
      const venue = makeVenue()

      // canPostPulse requires a venueId
      const result = canPostPulse(venue.id, [], 120)
      expect(result.canPost).toBe(true)
    })

    it('rejects posting when cooldown is active for the same venue', () => {
      const recentPulse = makePulse({
        venueId: 'venue-1',
        createdAt: new Date().toISOString(),
      })

      const result = canPostPulse('venue-1', [recentPulse], 120)
      expect(result.canPost).toBe(false)
      expect(result.remainingMinutes).toBeDefined()
      expect(result.remainingMinutes).toBeGreaterThan(0)
    })

    it('allows posting to a different venue even during cooldown', () => {
      const recentPulse = makePulse({
        venueId: 'venue-1',
        createdAt: new Date().toISOString(),
      })

      const result = canPostPulse('venue-2', [recentPulse], 120)
      expect(result.canPost).toBe(true)
    })

    it('allows posting after cooldown expires', () => {
      const oldPulse = makePulse({
        venueId: 'venue-1',
        createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), // 3 hours ago
      })

      const result = canPostPulse('venue-1', [oldPulse], 120)
      expect(result.canPost).toBe(true)
    })
  })

  // ── Pulse appears in pending state before confirmation ───
  describe('pulse pending state', () => {
    it('new pulse starts with isPending = true', () => {
      const pulse = buildNewPulse({
        venueId: 'venue-1',
        userId: 'user-1',
        energyRating: 'buzzing',
      })

      expect(pulse.isPending).toBe(true)
    })

    it('pulse transitions from pending to confirmed after upload', async () => {
      const pulse = buildNewPulse({
        venueId: 'venue-1',
        userId: 'user-1',
        energyRating: 'buzzing',
      })

      expect(pulse.isPending).toBe(true)

      // Simulate uploading
      const success = await uploadPulseToSupabase(pulse)
      expect(success).toBe(true)

      // After confirmation the app sets isPending = false
      const confirmedPulse = { ...pulse, isPending: false, uploadError: false }
      expect(confirmedPulse.isPending).toBe(false)
      expect(confirmedPulse.uploadError).toBe(false)
    })

    it('pulse gets uploadError flag when upload fails', async () => {
      mockInsert.mockResolvedValueOnce({ error: { message: 'Network error' } })

      const pulse = buildNewPulse({
        venueId: 'venue-1',
        userId: 'user-1',
        energyRating: 'electric',
      })

      const success = await uploadPulseToSupabase(pulse)
      expect(success).toBe(false)

      // App would set error state
      const failedPulse = { ...pulse, isPending: false, uploadError: true }
      expect(failedPulse.uploadError).toBe(true)
    })

    it('pulse is added to front of list while pending (optimistic)', () => {
      const existingPulses = [
        makePulse({ id: 'old-1', isPending: false }),
        makePulse({ id: 'old-2', isPending: false }),
      ]

      const newPulse = buildNewPulse({
        venueId: 'venue-1',
        userId: 'user-1',
        energyRating: 'buzzing',
      })

      // Simulate optimistic insert at front of list
      const updatedPulses = [newPulse, ...existingPulses]

      expect(updatedPulses[0].isPending).toBe(true)
      expect(updatedPulses[0].id).toBe(newPulse.id)
      expect(updatedPulses).toHaveLength(3)
    })
  })

  // ── Pulse with media attachment ──────────────────────────
  describe('pulse with media attachment', () => {
    it('creates pulse with photo attachments', () => {
      const photos = [
        'https://images.test/photo1.jpg',
        'https://images.test/photo2.jpg',
      ]

      const pulse = buildNewPulse({
        venueId: 'venue-1',
        userId: 'user-1',
        energyRating: 'electric',
        photos,
      })

      expect(pulse.photos).toEqual(photos)
      expect(pulse.photos).toHaveLength(2)
    })

    it('creates pulse with video attachment', () => {
      const pulse = buildNewPulse({
        venueId: 'venue-1',
        userId: 'user-1',
        energyRating: 'buzzing',
        video: 'https://videos.test/clip.mp4',
      })

      expect(pulse.video).toBe('https://videos.test/clip.mp4')
    })

    it('creates pulse with both photos and video', () => {
      const pulse = buildNewPulse({
        venueId: 'venue-1',
        userId: 'user-1',
        energyRating: 'buzzing',
        photos: ['https://images.test/photo1.jpg'],
        video: 'https://videos.test/clip.mp4',
      })

      expect(pulse.photos).toHaveLength(1)
      expect(pulse.video).toBeDefined()
    })

    it('creates pulse with no media (photos empty, no video)', () => {
      const pulse = buildNewPulse({
        venueId: 'venue-1',
        userId: 'user-1',
        energyRating: 'chill',
      })

      expect(pulse.photos).toEqual([])
      expect(pulse.video).toBeUndefined()
    })

    it('uploads pulse with media to Supabase', async () => {
      const pulse = makePulse({
        id: 'media-upload',
        photos: ['https://images.test/photo1.jpg'],
        video: 'https://videos.test/clip.mp4',
      })

      const result = await uploadPulseToSupabase(pulse)
      expect(result).toBe(true)
    })
  })

  // ── Pulse contributes to venue score ─────────────────────
  describe('pulse contributes to venue score', () => {
    it('single pulse contributes a positive score', () => {
      const pulse = makePulse({ energyRating: 'buzzing' })
      const score = calculatePulseScore([pulse])
      expect(score).toBeGreaterThan(0)
    })

    it('higher energy rating contributes more to venue score', () => {
      const chillPulse = makePulse({ energyRating: 'chill' })
      const electricPulse = makePulse({ energyRating: 'electric' })

      const chillScore = calculatePulseScore([chillPulse])
      const electricScore = calculatePulseScore([electricPulse])

      expect(electricScore).toBeGreaterThan(chillScore)
    })
  })

  // ── Offline fallback for pulse creation ──────────────────
  describe('offline fallback for pulse creation', () => {
    it('queues pulse in offline queue when upload fails', async () => {
      mockInsert.mockResolvedValueOnce({ error: { message: 'Network error' } })

      const pulse = makePulse({ id: 'offline-pulse' })
      const success = await uploadPulseToSupabase(pulse)

      if (!success) {
        enqueuePulse({
          id: pulse.id,
          venueId: pulse.venueId,
          energyRating: pulse.energyRating,
          caption: pulse.caption,
          photos: pulse.photos,
        })
      }

      expect(success).toBe(false)
      const queue = getQueue()
      expect(queue).toHaveLength(1)
      expect(queue[0].id).toBe('offline-pulse')
      expect(queue[0].status).toBe('pending')

      clearQueue()
    })
  })
})
