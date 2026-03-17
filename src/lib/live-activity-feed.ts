import type { Venue, Pulse, EnergyRating } from './types'

export type ActivityEventType =
  | 'checkin'
  | 'surge'
  | 'event_starting'
  | 'trending'
  | 'happy_hour'

export interface ActivityEvent {
  id: string
  type: ActivityEventType
  venueId: string
  venueName: string
  timestamp: number
  message: string
  priority: number
  count?: number
  energyRating?: EnergyRating
}

const EVENT_DECAY_MS = 30 * 60 * 1000 // 30 minutes

function generateId(): string {
  return `laf_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

/**
 * Generate activity events from current venue, event, and pulse data.
 */
export function generateActivityEvents(
  venues: Venue[],
  _events: Record<string, string>[],
  pulses: Pulse[]
): ActivityEvent[] {
  const now = Date.now()
  const results: ActivityEvent[] = []

  for (const venue of venues) {
    // Check-in events from recent pulses
    const recentPulses = pulses.filter(
      (p) =>
        p.venueId === venue.id &&
        now - new Date(p.createdAt).getTime() < EVENT_DECAY_MS
    )

    if (recentPulses.length > 0) {
      results.push({
        id: generateId(),
        type: 'checkin',
        venueId: venue.id,
        venueName: venue.name,
        timestamp: now - Math.floor(Math.random() * 5 * 60 * 1000),
        message: '',
        priority: 2,
        count: recentPulses.length,
      })
    }

    // Surge events for high-energy venues
    if (venue.pulseScore >= 75) {
      results.push({
        id: generateId(),
        type: 'surge',
        venueId: venue.id,
        venueName: venue.name,
        timestamp: now - Math.floor(Math.random() * 10 * 60 * 1000),
        message: '',
        priority: 3,
        energyRating: venue.pulseScore >= 90 ? 'electric' : 'buzzing',
      })
    }

    // Trending events
    if (venue.scoreVelocity !== undefined && venue.scoreVelocity > 15) {
      results.push({
        id: generateId(),
        type: 'trending',
        venueId: venue.id,
        venueName: venue.name,
        timestamp: now - Math.floor(Math.random() * 8 * 60 * 1000),
        message: '',
        priority: 2,
      })
    }

    // Happy hour events based on time of day
    const hour = new Date(now).getHours()
    if (
      (venue.category === 'nightlife' || venue.category === 'food') &&
      hour >= 16 &&
      hour < 19
    ) {
      results.push({
        id: generateId(),
        type: 'happy_hour',
        venueId: venue.id,
        venueName: venue.name,
        timestamp: now - Math.floor(Math.random() * 5 * 60 * 1000),
        message: '',
        priority: 1,
      })
    }
  }

  // Event-starting events from the events list
  for (const event of _events) {
    if (event.venueName && event.name) {
      results.push({
        id: generateId(),
        type: 'event_starting',
        venueId: event.venueId ?? '',
        venueName: event.venueName,
        timestamp: now - Math.floor(Math.random() * 15 * 60 * 1000),
        message: '',
        priority: 3,
      })
    }
  }

  // Apply formatted messages
  return results.map((e) => ({
    ...e,
    message: e.message || formatActivityMessage(e),
  }))
}

/**
 * Format a human-readable message for an activity event.
 */
export function formatActivityMessage(event: ActivityEvent): string {
  switch (event.type) {
    case 'checkin': {
      const count = event.count ?? 1
      const people = count === 1 ? '1 person' : `${count} people`
      return `${people} just checked in at ${event.venueName}`
    }
    case 'surge':
      return `${event.venueName} is surging right now`
    case 'event_starting':
      return `Event starting soon at ${event.venueName}`
    case 'trending':
      return `${event.venueName} is trending right now`
    case 'happy_hour':
      return `Happy hour ending soon at ${event.venueName}`
  }
}

/**
 * Sort events by a combination of recency and priority score.
 * Higher priority and more recent events appear first.
 */
export function prioritizeEvents(events: ActivityEvent[]): ActivityEvent[] {
  const now = Date.now()
  return [...events].sort((a, b) => {
    const ageA = (now - a.timestamp) / 60_000 // age in minutes
    const ageB = (now - b.timestamp) / 60_000
    // Score: priority weight minus age penalty
    const scoreA = a.priority * 10 - ageA
    const scoreB = b.priority * 10 - ageB
    return scoreB - scoreA
  })
}

/**
 * Remove duplicate events for the same venue and type within a time window.
 */
export function deduplicateEvents(
  events: ActivityEvent[],
  windowMs: number = 5 * 60 * 1000
): ActivityEvent[] {
  const seen = new Map<string, number>()
  const result: ActivityEvent[] = []

  // Process newest first so we keep the most recent event
  const sorted = [...events].sort((a, b) => b.timestamp - a.timestamp)

  for (const event of sorted) {
    const key = `${event.venueId}:${event.type}`
    const lastSeen = seen.get(key)

    if (lastSeen === undefined || lastSeen - event.timestamp > windowMs) {
      seen.set(key, event.timestamp)
      result.push(event)
    }
  }

  // Restore original relative order
  return result.reverse()
}

/**
 * Group similar events (e.g., multiple check-ins at same venue) into a single event with a count.
 */
export function groupSimilarEvents(events: ActivityEvent[]): ActivityEvent[] {
  const groups = new Map<string, ActivityEvent[]>()
  const nonGroupable: ActivityEvent[] = []

  for (const event of events) {
    if (event.type === 'checkin') {
      const key = `${event.venueId}:checkin`
      const group = groups.get(key)
      if (group) {
        group.push(event)
      } else {
        groups.set(key, [event])
      }
    } else {
      nonGroupable.push(event)
    }
  }

  const grouped: ActivityEvent[] = []
  for (const [, group] of groups) {
    const totalCount = group.reduce((sum, e) => sum + (e.count ?? 1), 0)
    const newest = group.reduce((a, b) =>
      a.timestamp > b.timestamp ? a : b
    )
    const merged: ActivityEvent = {
      ...newest,
      count: totalCount,
      message: '',
    }
    merged.message = formatActivityMessage(merged)
    grouped.push(merged)
  }

  return [...grouped, ...nonGroupable]
}

/**
 * Filter out events older than the decay window (default 30 minutes).
 */
export function filterDecayedEvents(
  events: ActivityEvent[],
  decayMs: number = EVENT_DECAY_MS
): ActivityEvent[] {
  const cutoff = Date.now() - decayMs
  return events.filter((e) => e.timestamp >= cutoff)
}

/**
 * Enforce a maximum rolling window of events.
 */
export function enforceMaxEvents(
  events: ActivityEvent[],
  max: number = 50
): ActivityEvent[] {
  if (events.length <= max) return events
  // Keep the most recent events
  return [...events].sort((a, b) => b.timestamp - a.timestamp).slice(0, max)
}
