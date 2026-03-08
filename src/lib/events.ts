import type { Venue, EnergyRating } from './types'

/**
 * Events & Scheduling Engine
 *
 * Event creation tied to venues, RSVP tracking,
 * event-based surge predictions, and calendar integration.
 */

export type EventCategory = 'dj_set' | 'happy_hour' | 'game_night' | 'live_music' | 'trivia' | 'open_mic' | 'karaoke' | 'comedy' | 'other'

export type RSVPStatus = 'going' | 'interested' | 'not_going'

export interface VenueEvent {
  id: string
  venueId: string
  createdByUserId: string
  title: string
  description: string
  category: EventCategory
  startTime: string
  endTime: string
  coverCharge?: number
  imageUrl?: string
  rsvps: Record<string, RSVPStatus>
  createdAt: string
  recurring?: {
    frequency: 'weekly' | 'biweekly' | 'monthly'
    dayOfWeek?: number
  }
}

export interface EventSurgePrediction {
  eventId: string
  venueId: string
  predictedPeakTime: string
  predictedEnergyLevel: EnergyRating
  confidence: 'low' | 'medium' | 'high'
  label: string
}

export interface CalendarExport {
  title: string
  description: string
  location: string
  startTime: string
  endTime: string
  url: string
}

export const EVENT_CATEGORIES: { value: EventCategory; label: string; emoji: string }[] = [
  { value: 'dj_set', label: 'DJ Set', emoji: '🎧' },
  { value: 'happy_hour', label: 'Happy Hour', emoji: '🍸' },
  { value: 'game_night', label: 'Game Night', emoji: '🎮' },
  { value: 'live_music', label: 'Live Music', emoji: '🎵' },
  { value: 'trivia', label: 'Trivia', emoji: '🧠' },
  { value: 'open_mic', label: 'Open Mic', emoji: '🎤' },
  { value: 'karaoke', label: 'Karaoke', emoji: '🎶' },
  { value: 'comedy', label: 'Comedy', emoji: '😂' },
  { value: 'other', label: 'Other', emoji: '✨' },
]

/**
 * Create a new event tied to a venue.
 */
export function createEvent(
  venueId: string,
  userId: string,
  title: string,
  description: string,
  category: EventCategory,
  startTime: string,
  endTime: string,
  options?: {
    coverCharge?: number
    imageUrl?: string
    recurring?: VenueEvent['recurring']
  }
): VenueEvent {
  return {
    id: `event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    venueId,
    createdByUserId: userId,
    title,
    description,
    category,
    startTime,
    endTime,
    coverCharge: options?.coverCharge,
    imageUrl: options?.imageUrl,
    rsvps: { [userId]: 'going' },
    createdAt: new Date().toISOString(),
    recurring: options?.recurring,
  }
}

/**
 * RSVP to an event.
 */
export function rsvpToEvent(
  event: VenueEvent,
  userId: string,
  status: RSVPStatus
): VenueEvent {
  const rsvps = { ...event.rsvps }
  if (status === 'not_going') {
    delete rsvps[userId]
  } else {
    rsvps[userId] = status
  }
  return { ...event, rsvps }
}

/**
 * Get RSVP counts for an event.
 */
export function getRSVPCounts(event: VenueEvent): { going: number; interested: number } {
  let going = 0
  let interested = 0
  for (const status of Object.values(event.rsvps)) {
    if (status === 'going') going++
    else if (status === 'interested') interested++
  }
  return { going, interested }
}

/**
 * Get a user's RSVP status for an event.
 */
export function getUserRSVP(event: VenueEvent, userId: string): RSVPStatus | null {
  return event.rsvps[userId] ?? null
}

/**
 * Get upcoming events for a venue.
 */
export function getUpcomingEvents(
  events: VenueEvent[],
  venueId: string,
  limit: number = 5
): VenueEvent[] {
  const now = Date.now()
  return events
    .filter(e => e.venueId === venueId && new Date(e.endTime).getTime() > now)
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    .slice(0, limit)
}

/**
 * Get events a user has RSVP'd to.
 */
export function getUserEvents(
  events: VenueEvent[],
  userId: string,
  statusFilter?: RSVPStatus
): VenueEvent[] {
  const now = Date.now()
  return events
    .filter(e => {
      const status = e.rsvps[userId]
      if (!status) return false
      if (statusFilter && status !== statusFilter) return false
      return new Date(e.endTime).getTime() > now
    })
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
}

/**
 * Generate event-based surge prediction.
 *
 * Uses RSVP count and event category to predict venue energy
 * at event time. Higher RSVP = higher confidence.
 */
export function predictEventSurge(event: VenueEvent): EventSurgePrediction {
  const { going, interested } = getRSVPCounts(event)
  const totalInterest = going + interested * 0.5

  let predictedEnergyLevel: EnergyRating
  let confidence: 'low' | 'medium' | 'high'

  if (totalInterest >= 50) {
    predictedEnergyLevel = 'electric'
    confidence = 'high'
  } else if (totalInterest >= 20) {
    predictedEnergyLevel = 'electric'
    confidence = 'medium'
  } else if (totalInterest >= 10) {
    predictedEnergyLevel = 'buzzing'
    confidence = 'medium'
  } else if (totalInterest >= 5) {
    predictedEnergyLevel = 'buzzing'
    confidence = 'low'
  } else {
    predictedEnergyLevel = 'chill'
    confidence = 'low'
  }

  // High-energy event categories get a boost
  const highEnergyCategories: EventCategory[] = ['dj_set', 'live_music', 'karaoke']
  if (highEnergyCategories.includes(event.category) && predictedEnergyLevel !== 'electric') {
    const upgrade: Record<EnergyRating, EnergyRating> = {
      dead: 'chill',
      chill: 'buzzing',
      buzzing: 'electric',
      electric: 'electric',
    }
    predictedEnergyLevel = upgrade[predictedEnergyLevel]
  }

  // Calculate predicted peak time (1 hour after start)
  const startMs = new Date(event.startTime).getTime()
  const peakMs = startMs + 60 * 60 * 1000
  const predictedPeakTime = new Date(peakMs).toISOString()

  // Generate human-readable label
  const peakDate = new Date(peakMs)
  const timeStr = peakDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  const label = `Expected to be ${predictedEnergyLevel === 'electric' ? 'Electric' : 'Buzzing'} at ${timeStr}`

  return {
    eventId: event.id,
    venueId: event.venueId,
    predictedPeakTime,
    predictedEnergyLevel,
    confidence,
    label,
  }
}

/**
 * Generate an .ics calendar export for an event.
 */
export function generateCalendarExport(
  event: VenueEvent,
  venue: Venue
): CalendarExport {
  return {
    title: event.title,
    description: event.description,
    location: `${venue.name}, ${venue.location.address}`,
    startTime: event.startTime,
    endTime: event.endTime,
    url: `https://pulse.app/event/${event.id}`,
  }
}

/**
 * Format calendar export to ICS string.
 */
export function toICSString(cal: CalendarExport): string {
  const formatDate = (iso: string) => iso.replace(/[-:]/g, '').replace(/\.\d+/, '')
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Pulse//Events//EN',
    'BEGIN:VEVENT',
    `DTSTART:${formatDate(cal.startTime)}`,
    `DTEND:${formatDate(cal.endTime)}`,
    `SUMMARY:${cal.title}`,
    `DESCRIPTION:${cal.description}`,
    `LOCATION:${cal.location}`,
    `URL:${cal.url}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
}

/**
 * Get events happening soon (next N hours) across all venues.
 */
export function getEventsSoon(
  events: VenueEvent[],
  hoursAhead: number = 4
): VenueEvent[] {
  const now = Date.now()
  const cutoff = now + hoursAhead * 60 * 60 * 1000
  return events
    .filter(e => {
      const start = new Date(e.startTime).getTime()
      return start > now && start <= cutoff
    })
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
}
