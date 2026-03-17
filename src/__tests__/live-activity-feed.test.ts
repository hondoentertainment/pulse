import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  generateActivityEvents,
  formatActivityMessage,
  prioritizeEvents,
  deduplicateEvents,
  groupSimilarEvents,
  filterDecayedEvents,
  enforceMaxEvents,
  type ActivityEvent,
} from '../lib/live-activity-feed'
import type { Venue, Pulse } from '../lib/types'

function makeVenue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: 'venue-1',
    name: 'Neon Lounge',
    location: { lat: 47.6, lng: -122.3, address: '123 Main St' },
    pulseScore: 50,
    ...overrides,
  }
}

function makePulse(overrides: Partial<Pulse> = {}): Pulse {
  return {
    id: `pulse-${Math.random().toString(36).slice(2, 7)}`,
    userId: 'user-1',
    venueId: 'venue-1',
    photos: [],
    energyRating: 'buzzing',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
    reactions: { fire: [], eyes: [], skull: [], lightning: [] },
    views: 0,
    ...overrides,
  }
}

function makeEvent(overrides: Partial<ActivityEvent> = {}): ActivityEvent {
  return {
    id: `laf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    type: 'checkin',
    venueId: 'venue-1',
    venueName: 'Neon Lounge',
    timestamp: Date.now(),
    message: '3 people just checked in at Neon Lounge',
    priority: 2,
    ...overrides,
  }
}

describe('live-activity-feed', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-17T22:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('generateActivityEvents', () => {
    it('generates checkin events from recent pulses', () => {
      const venue = makeVenue()
      const pulse = makePulse({ venueId: venue.id })
      const result = generateActivityEvents([venue], [], [pulse])
      const checkins = result.filter((e) => e.type === 'checkin')
      expect(checkins.length).toBeGreaterThan(0)
      expect(checkins[0].venueId).toBe(venue.id)
    })

    it('generates surge events for high-score venues', () => {
      const venue = makeVenue({ pulseScore: 80 })
      const result = generateActivityEvents([venue], [], [])
      const surges = result.filter((e) => e.type === 'surge')
      expect(surges.length).toBeGreaterThan(0)
    })

    it('generates trending events for venues with high velocity', () => {
      const venue = makeVenue({ scoreVelocity: 25 })
      const result = generateActivityEvents([venue], [], [])
      const trending = result.filter((e) => e.type === 'trending')
      expect(trending.length).toBeGreaterThan(0)
    })

    it('generates event_starting events from event data', () => {
      const events = [{ venueName: 'Club Vinyl', name: 'DJ Night', venueId: 'v1' }]
      const result = generateActivityEvents([], events, [])
      const starting = result.filter((e) => e.type === 'event_starting')
      expect(starting.length).toBe(1)
      expect(starting[0].venueName).toBe('Club Vinyl')
    })

    it('returns empty array for empty venues and no events', () => {
      const result = generateActivityEvents([], [], [])
      expect(result).toEqual([])
    })

    it('does not generate checkin events from old pulses', () => {
      const venue = makeVenue()
      const oldPulse = makePulse({
        venueId: venue.id,
        createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 hour ago
      })
      const result = generateActivityEvents([venue], [], [oldPulse])
      const checkins = result.filter((e) => e.type === 'checkin')
      expect(checkins.length).toBe(0)
    })
  })

  describe('formatActivityMessage', () => {
    it('formats checkin event with count', () => {
      const event = makeEvent({ type: 'checkin', count: 3, venueName: 'Neon Lounge' })
      const msg = formatActivityMessage(event)
      expect(msg).toBe('3 people just checked in at Neon Lounge')
    })

    it('formats checkin event with count of 1', () => {
      const event = makeEvent({ type: 'checkin', count: 1, venueName: 'The Bar' })
      const msg = formatActivityMessage(event)
      expect(msg).toBe('1 person just checked in at The Bar')
    })

    it('formats surge event', () => {
      const event = makeEvent({ type: 'surge', venueName: 'The Rooftop' })
      const msg = formatActivityMessage(event)
      expect(msg).toBe('The Rooftop is surging right now')
    })

    it('formats event_starting event', () => {
      const event = makeEvent({ type: 'event_starting', venueName: 'Club Vinyl' })
      const msg = formatActivityMessage(event)
      expect(msg).toBe('Event starting soon at Club Vinyl')
    })

    it('formats trending event', () => {
      const event = makeEvent({ type: 'trending', venueName: 'Sidebar' })
      const msg = formatActivityMessage(event)
      expect(msg).toBe('Sidebar is trending right now')
    })

    it('formats happy_hour event', () => {
      const event = makeEvent({ type: 'happy_hour', venueName: 'Sidebar' })
      const msg = formatActivityMessage(event)
      expect(msg).toBe('Happy hour ending soon at Sidebar')
    })
  })

  describe('prioritizeEvents', () => {
    it('sorts by priority and recency', () => {
      const now = Date.now()
      const events: ActivityEvent[] = [
        makeEvent({ priority: 1, timestamp: now }),
        makeEvent({ priority: 3, timestamp: now - 60_000 }),
        makeEvent({ priority: 2, timestamp: now }),
      ]
      const sorted = prioritizeEvents(events)
      // Higher priority events should come first when recency is similar
      expect(sorted[0].priority).toBe(3)
    })

    it('returns empty array for empty input', () => {
      expect(prioritizeEvents([])).toEqual([])
    })

    it('prefers recent low-priority over old high-priority', () => {
      const now = Date.now()
      const events: ActivityEvent[] = [
        makeEvent({ id: 'old-high', priority: 3, timestamp: now - 29 * 60_000 }),
        makeEvent({ id: 'new-low', priority: 2, timestamp: now }),
      ]
      const sorted = prioritizeEvents(events)
      expect(sorted[0].id).toBe('new-low')
    })
  })

  describe('deduplicateEvents', () => {
    it('removes duplicate events for same venue and type within window', () => {
      const now = Date.now()
      const events: ActivityEvent[] = [
        makeEvent({ id: 'e1', venueId: 'v1', type: 'checkin', timestamp: now }),
        makeEvent({ id: 'e2', venueId: 'v1', type: 'checkin', timestamp: now + 1000 }),
      ]
      const result = deduplicateEvents(events, 5 * 60 * 1000)
      expect(result.length).toBe(1)
    })

    it('keeps events for different venues', () => {
      const now = Date.now()
      const events: ActivityEvent[] = [
        makeEvent({ id: 'e1', venueId: 'v1', type: 'checkin', timestamp: now }),
        makeEvent({ id: 'e2', venueId: 'v2', type: 'checkin', timestamp: now }),
      ]
      const result = deduplicateEvents(events, 5 * 60 * 1000)
      expect(result.length).toBe(2)
    })

    it('keeps events of different types for same venue', () => {
      const now = Date.now()
      const events: ActivityEvent[] = [
        makeEvent({ id: 'e1', venueId: 'v1', type: 'checkin', timestamp: now }),
        makeEvent({ id: 'e2', venueId: 'v1', type: 'surge', timestamp: now }),
      ]
      const result = deduplicateEvents(events, 5 * 60 * 1000)
      expect(result.length).toBe(2)
    })

    it('keeps events outside the dedup window', () => {
      const now = Date.now()
      const events: ActivityEvent[] = [
        makeEvent({ id: 'e1', venueId: 'v1', type: 'checkin', timestamp: now - 10 * 60 * 1000 }),
        makeEvent({ id: 'e2', venueId: 'v1', type: 'checkin', timestamp: now }),
      ]
      const result = deduplicateEvents(events, 5 * 60 * 1000)
      expect(result.length).toBe(2)
    })

    it('returns empty array for empty input', () => {
      expect(deduplicateEvents([])).toEqual([])
    })
  })

  describe('groupSimilarEvents', () => {
    it('groups checkin events at the same venue', () => {
      const events: ActivityEvent[] = [
        makeEvent({ id: 'e1', venueId: 'v1', type: 'checkin', count: 2 }),
        makeEvent({ id: 'e2', venueId: 'v1', type: 'checkin', count: 3 }),
      ]
      const result = groupSimilarEvents(events)
      const checkins = result.filter((e) => e.type === 'checkin')
      expect(checkins.length).toBe(1)
      expect(checkins[0].count).toBe(5)
    })

    it('does not group different venue checkins', () => {
      const events: ActivityEvent[] = [
        makeEvent({ id: 'e1', venueId: 'v1', type: 'checkin', count: 2 }),
        makeEvent({ id: 'e2', venueId: 'v2', type: 'checkin', count: 3, venueName: 'Other' }),
      ]
      const result = groupSimilarEvents(events)
      const checkins = result.filter((e) => e.type === 'checkin')
      expect(checkins.length).toBe(2)
    })

    it('does not group non-checkin events', () => {
      const events: ActivityEvent[] = [
        makeEvent({ id: 'e1', venueId: 'v1', type: 'surge' }),
        makeEvent({ id: 'e2', venueId: 'v1', type: 'surge' }),
      ]
      const result = groupSimilarEvents(events)
      const surges = result.filter((e) => e.type === 'surge')
      expect(surges.length).toBe(2)
    })

    it('updates message after grouping', () => {
      const events: ActivityEvent[] = [
        makeEvent({ id: 'e1', venueId: 'v1', type: 'checkin', count: 2, venueName: 'Neon Lounge' }),
        makeEvent({ id: 'e2', venueId: 'v1', type: 'checkin', count: 1, venueName: 'Neon Lounge' }),
      ]
      const result = groupSimilarEvents(events)
      const checkin = result.find((e) => e.type === 'checkin')
      expect(checkin?.message).toBe('3 people just checked in at Neon Lounge')
    })
  })

  describe('filterDecayedEvents', () => {
    it('filters out events older than 30 minutes', () => {
      const now = Date.now()
      const events: ActivityEvent[] = [
        makeEvent({ id: 'recent', timestamp: now - 10 * 60 * 1000 }),
        makeEvent({ id: 'old', timestamp: now - 35 * 60 * 1000 }),
      ]
      const result = filterDecayedEvents(events)
      expect(result.length).toBe(1)
      expect(result[0].id).toBe('recent')
    })

    it('keeps events exactly at the boundary', () => {
      const now = Date.now()
      const events: ActivityEvent[] = [
        makeEvent({ id: 'boundary', timestamp: now - 30 * 60 * 1000 }),
      ]
      const result = filterDecayedEvents(events)
      expect(result.length).toBe(1)
    })

    it('filters all events when all expired', () => {
      const events: ActivityEvent[] = [
        makeEvent({ timestamp: Date.now() - 60 * 60 * 1000 }),
        makeEvent({ timestamp: Date.now() - 45 * 60 * 1000 }),
      ]
      const result = filterDecayedEvents(events)
      expect(result.length).toBe(0)
    })

    it('returns empty for empty input', () => {
      expect(filterDecayedEvents([])).toEqual([])
    })

    it('respects custom decay window', () => {
      const now = Date.now()
      const events: ActivityEvent[] = [
        makeEvent({ timestamp: now - 10 * 60 * 1000 }),
      ]
      const result = filterDecayedEvents(events, 5 * 60 * 1000)
      expect(result.length).toBe(0)
    })
  })

  describe('enforceMaxEvents', () => {
    it('returns all events when under max', () => {
      const events = Array.from({ length: 5 }, (_, i) =>
        makeEvent({ id: `e${i}`, timestamp: Date.now() - i * 1000 })
      )
      expect(enforceMaxEvents(events, 50).length).toBe(5)
    })

    it('trims to max keeping most recent', () => {
      const now = Date.now()
      const events = Array.from({ length: 60 }, (_, i) =>
        makeEvent({ id: `e${i}`, timestamp: now - i * 1000 })
      )
      const result = enforceMaxEvents(events, 50)
      expect(result.length).toBe(50)
      // Most recent should be kept
      expect(result.find((e) => e.id === 'e0')).toBeDefined()
      // Oldest should be dropped
      expect(result.find((e) => e.id === 'e59')).toBeUndefined()
    })

    it('handles empty input', () => {
      expect(enforceMaxEvents([], 50)).toEqual([])
    })
  })
})
