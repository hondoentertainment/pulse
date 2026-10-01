import { describe, expect, it } from 'vitest'
import {
  decideVenueSurgeNotify,
  isWithinQuietHours,
  parseQuietHour,
  shouldDeliverSurgePush,
  surgeRateLimitOpen,
  venueSurgeNotifyPayload,
} from '../venue-surge-notify'

describe('decideVenueSurgeNotify', () => {
  const now = Date.parse('2026-09-24T04:00:00.000Z')

  it('sends when a venue crosses Electric and the 2h window is open', () => {
    expect(decideVenueSurgeNotify({
      energyRating: 'electric',
      priorEnergies: ['buzzing', 'chill'],
      lastNotifiedAt: null,
      nowMs: now,
    })).toEqual({ send: true, reason: 'electric_cross' })
  })

  it('skips remote or lower energy', () => {
    expect(decideVenueSurgeNotify({
      energyRating: 'buzzing',
      priorEnergies: [],
      nowMs: now,
    }).reason).toBe('not_electric')
  })

  it('does not re-notify while the room is already Electric', () => {
    expect(decideVenueSurgeNotify({
      energyRating: 'electric',
      priorEnergies: ['electric'],
      nowMs: now,
    }).reason).toBe('already_electric')
  })

  it('rate-limits to one notify per venue every 2 hours', () => {
    const recent = new Date(now - 30 * 60 * 1000).toISOString()
    expect(surgeRateLimitOpen(recent, now)).toBe(false)
    expect(decideVenueSurgeNotify({
      energyRating: 'electric',
      priorEnergies: [],
      lastNotifiedAt: recent,
      nowMs: now,
    }).reason).toBe('rate_limited')
    const old = new Date(now - 3 * 60 * 60 * 1000).toISOString()
    expect(surgeRateLimitOpen(old, now)).toBe(true)
  })
})

describe('quiet hours and mute', () => {
  it('treats a window that wraps midnight as overnight quiet hours', () => {
    expect(isWithinQuietHours({ hour: 23, start: 22, end: 7 })).toBe(true)
    expect(isWithinQuietHours({ hour: 6, start: 22, end: 7 })).toBe(true)
    expect(isWithinQuietHours({ hour: 12, start: 22, end: 7 })).toBe(false)
    expect(isWithinQuietHours({ hour: 21, start: 22, end: 7 })).toBe(false)
    expect(isWithinQuietHours({ hour: 1, start: null, end: null })).toBe(false)
    expect(isWithinQuietHours({ hour: 1, start: 1, end: 1 })).toBe(false)
    expect(parseQuietHour('22')).toBe(22)
    expect(parseQuietHour('7')).toBe(7)
    expect(parseQuietHour('24')).toBeNull()
    expect(parseQuietHour('')).toBeNull()
  })

  it('drops muted venues and quiet-hour subscribers', () => {
    expect(shouldDeliverSurgePush({
      muted: true,
      quietStart: null,
      quietEnd: null,
      hour: 21,
    })).toBe(false)
    expect(shouldDeliverSurgePush({
      muted: false,
      quietStart: 22,
      quietEnd: 7,
      hour: 23,
    })).toBe(false)
    expect(shouldDeliverSurgePush({
      muted: false,
      quietStart: 22,
      quietEnd: 7,
      hour: 21,
    })).toBe(true)
  })
})

describe('venueSurgeNotifyPayload', () => {
  it('names the venue, tags the surge, and deep-links to it', () => {
    expect(venueSurgeNotifyPayload({ venueId: 'neumos', venueName: 'Neumos' })).toEqual({
      title: 'Neumos · Surging',
      body: 'Electric right now',
      url: '/venue/neumos',
      kind: 'venue_surge',
      tag: 'venue-surge:neumos',
      renotify: true,
    })
  })

  it('keeps a long venue name to a glasses glance', () => {
    const payload = venueSurgeNotifyPayload({
      venueId: 'long',
      venueName: 'The Extremely Long Seattle Listening Room and Cocktail Bar',
    })
    expect(payload.title.endsWith('· Surging')).toBe(true)
    expect(payload.title.length).toBeLessThanOrEqual(40)
    expect(payload.body).toBe('Electric right now')
    expect(payload.kind).toBe('venue_surge')
    expect(payload.tag).toBe('venue-surge:long')
  })
})
