import { describe, expect, it } from 'vitest'
import { eventIsTonight, EVENTS_TONIGHT_EMPTY, listEventsTonight, mapEventRow } from '../events-tonight'

describe('events tonight', () => {
  it('maps existing events table rows and never invents a show', () => {
    expect(mapEventRow({ id: '', venue_id: 'v', title: 'Nope' })).toBeNull()
    expect(mapEventRow({ id: 'e1', venue_id: 'neumos', title: 'DJ' })?.title).toBe('DJ')
    expect(EVENTS_TONIGHT_EMPTY).toMatch(/No events/)
  })

  it('keeps only tonight’s real rows', () => {
    const now = new Date('2026-09-14T03:00:00.000Z')
    const rows = [
      { id: 'e1', venueId: 'neumos', title: 'Tonight', startsAt: '2026-09-14T02:00:00.000Z', date: null },
      { id: 'e2', venueId: 'neumos', title: 'Tomorrow', startsAt: '2026-09-16T02:00:00.000Z', date: null },
    ]
    expect(eventIsTonight(rows[0], now)).toBe(true)
    expect(listEventsTonight(rows, now).map((row) => row.id)).toEqual(['e1'])
  })
})
