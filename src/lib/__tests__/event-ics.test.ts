import { describe, expect, it } from 'vitest'
import { buildEventIcs, eventIcsFilename } from '../event-ics'

describe('event ics', () => {
  it('builds a downloadable .ics from a real events-tonight row', () => {
    const ics = buildEventIcs({
      id: 'e1',
      venueId: 'neumos',
      title: 'DJ set',
      startsAt: '2026-09-14T04:00:00.000Z',
      date: '2026-09-13',
    }, 'Neumos')
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('SUMMARY:DJ set')
    expect(ics).toContain('LOCATION:Neumos')
    expect(ics).toContain('DTSTART:20260914T040000Z')
    expect(eventIcsFilename({
      id: 'e1',
      venueId: 'neumos',
      title: 'DJ set',
      startsAt: null,
      date: null,
    })).toBe('dj-set.ics')
  })

  it('does not invent a calendar row when the event is empty', () => {
    expect(buildEventIcs({
      id: 'e1',
      venueId: 'neumos',
      title: '   ',
      startsAt: '2026-09-14T04:00:00.000Z',
      date: null,
    })).toBeNull()
    expect(buildEventIcs({
      id: 'e1',
      venueId: 'neumos',
      title: 'DJ',
      startsAt: null,
      date: null,
    })).toBeNull()
  })
})
