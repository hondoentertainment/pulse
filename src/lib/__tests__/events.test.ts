import { describe, it, expect } from 'vitest'
import {
  createEvent,
  rsvpToEvent,
  getRSVPCounts,
  getUserRSVP,
  getUpcomingEvents,
  getUserEvents,
  predictEventSurge,
  generateCalendarExport,
  toICSString,
  getEventsSoon,
} from '../events'
import type { Venue } from '../types'

const futureStart = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
const futureEnd = new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString()
const pastEnd = new Date(Date.now() - 60 * 60 * 1000).toISOString()

describe('createEvent', () => {
  it('creates an event with creator as going', () => {
    const event = createEvent('v1', 'u1', 'DJ Night', 'Great DJ', 'dj_set', futureStart, futureEnd)
    expect(event.venueId).toBe('v1')
    expect(event.title).toBe('DJ Night')
    expect(event.rsvps['u1']).toBe('going')
    expect(event.id).toMatch(/^event-/)
  })

  it('supports optional fields', () => {
    const event = createEvent('v1', 'u1', 'Test', '', 'other', futureStart, futureEnd, {
      coverCharge: 20,
      recurring: { frequency: 'weekly', dayOfWeek: 5 },
    })
    expect(event.coverCharge).toBe(20)
    expect(event.recurring?.frequency).toBe('weekly')
  })
})

describe('rsvpToEvent', () => {
  const event = createEvent('v1', 'u1', 'Test', '', 'other', futureStart, futureEnd)

  it('adds a going RSVP', () => {
    const updated = rsvpToEvent(event, 'u2', 'going')
    expect(updated.rsvps['u2']).toBe('going')
  })

  it('adds an interested RSVP', () => {
    const updated = rsvpToEvent(event, 'u2', 'interested')
    expect(updated.rsvps['u2']).toBe('interested')
  })

  it('removes RSVP on not_going', () => {
    let updated = rsvpToEvent(event, 'u2', 'going')
    updated = rsvpToEvent(updated, 'u2', 'not_going')
    expect(updated.rsvps['u2']).toBeUndefined()
  })
})

describe('getRSVPCounts', () => {
  it('counts going and interested', () => {
    let event = createEvent('v1', 'u1', 'Test', '', 'other', futureStart, futureEnd)
    event = rsvpToEvent(event, 'u2', 'going')
    event = rsvpToEvent(event, 'u3', 'interested')
    event = rsvpToEvent(event, 'u4', 'interested')
    const counts = getRSVPCounts(event)
    expect(counts.going).toBe(2) // u1 + u2
    expect(counts.interested).toBe(2) // u3 + u4
  })
})

describe('getUserRSVP', () => {
  const event = createEvent('v1', 'u1', 'Test', '', 'other', futureStart, futureEnd)

  it('returns status for RSVPd user', () => {
    expect(getUserRSVP(event, 'u1')).toBe('going')
  })

  it('returns null for non-RSVPd user', () => {
    expect(getUserRSVP(event, 'u99')).toBeNull()
  })
})

describe('getUpcomingEvents', () => {
  it('filters out past events', () => {
    const events = [
      createEvent('v1', 'u1', 'Past', '', 'other', pastEnd, pastEnd),
      createEvent('v1', 'u1', 'Future', '', 'other', futureStart, futureEnd),
    ]
    const upcoming = getUpcomingEvents(events, 'v1')
    expect(upcoming.length).toBe(1)
    expect(upcoming[0].title).toBe('Future')
  })

  it('filters by venue', () => {
    const events = [
      createEvent('v1', 'u1', 'A', '', 'other', futureStart, futureEnd),
      createEvent('v2', 'u1', 'B', '', 'other', futureStart, futureEnd),
    ]
    expect(getUpcomingEvents(events, 'v1').length).toBe(1)
  })

  it('respects limit', () => {
    const events = Array.from({ length: 10 }, (_, i) =>
      createEvent('v1', 'u1', `E${i}`, '', 'other', futureStart, futureEnd)
    )
    expect(getUpcomingEvents(events, 'v1', 3).length).toBe(3)
  })
})

describe('getUserEvents', () => {
  it('returns events user RSVPd to', () => {
    let event = createEvent('v1', 'u1', 'Test', '', 'other', futureStart, futureEnd)
    event = rsvpToEvent(event, 'u2', 'going')
    expect(getUserEvents([event], 'u2').length).toBe(1)
  })

  it('filters by status', () => {
    let event = createEvent('v1', 'u1', 'Test', '', 'other', futureStart, futureEnd)
    event = rsvpToEvent(event, 'u2', 'interested')
    expect(getUserEvents([event], 'u2', 'going').length).toBe(0)
    expect(getUserEvents([event], 'u2', 'interested').length).toBe(1)
  })
})

describe('predictEventSurge', () => {
  it('predicts low energy for few RSVPs', () => {
    const event = createEvent('v1', 'u1', 'Small', '', 'other', futureStart, futureEnd)
    const pred = predictEventSurge(event)
    expect(pred.confidence).toBe('low')
  })

  it('predicts high energy for many RSVPs', () => {
    let event = createEvent('v1', 'u1', 'Big', '', 'dj_set', futureStart, futureEnd)
    for (let i = 0; i < 50; i++) {
      event = rsvpToEvent(event, `u${i + 10}`, 'going')
    }
    const pred = predictEventSurge(event)
    expect(pred.predictedEnergyLevel).toBe('electric')
    expect(pred.confidence).toBe('high')
    expect(pred.label).toContain('Electric')
  })

  it('boosts high-energy event categories', () => {
    let mellow = createEvent('v1', 'u1', 'Trivia', '', 'trivia', futureStart, futureEnd)
    let energetic = createEvent('v1', 'u1', 'DJ Night', '', 'dj_set', futureStart, futureEnd)
    // Same RSVPs
    for (let i = 0; i < 8; i++) {
      mellow = rsvpToEvent(mellow, `u${i + 10}`, 'going')
      energetic = rsvpToEvent(energetic, `u${i + 10}`, 'going')
    }
    const mellowPred = predictEventSurge(mellow)
    const energeticPred = predictEventSurge(energetic)
    // DJ set should be at least as high as trivia
    const levels = ['dead', 'chill', 'buzzing', 'electric']
    expect(levels.indexOf(energeticPred.predictedEnergyLevel))
      .toBeGreaterThanOrEqual(levels.indexOf(mellowPred.predictedEnergyLevel))
  })
})

describe('calendar export', () => {
  it('generates valid ICS', () => {
    const event = createEvent('v1', 'u1', 'Test', 'A test event', 'other', futureStart, futureEnd)
    const venue: Venue = { id: 'v1', name: 'Bar', location: { lat: 0, lng: 0, address: '123 Main St' }, pulseScore: 50 }
    const cal = generateCalendarExport(event, venue)
    const ics = toICSString(cal)
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('SUMMARY:Test')
    expect(ics).toContain('LOCATION:Bar, 123 Main St')
    expect(ics).toContain('END:VCALENDAR')
  })
})

describe('getEventsSoon', () => {
  it('returns events starting within window', () => {
    const soonStart = new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1h from now
    const soonEnd = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString()
    const farStart = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    const events = [
      createEvent('v1', 'u1', 'Soon', '', 'other', soonStart, soonEnd),
      createEvent('v1', 'u1', 'Far', '', 'other', farStart, futureEnd),
    ]
    const soon = getEventsSoon(events, 4)
    expect(soon.length).toBe(1)
    expect(soon[0].title).toBe('Soon')
  })
})
