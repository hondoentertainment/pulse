import { describe, expect, it } from 'vitest'
import { filterModeratedPulses } from '../content-moderation'
import { getLiveNowReviews } from '../live-reviews'
import {
  HIDE_UNDO_MS,
  hidePulseDecision,
  mapOwnerHiddenRow,
  ownerHiddenCopy,
  undoHideDecision,
} from '../pulse-hide'
import type { Pulse } from '../types'

function pulse(overrides: Partial<Pulse> = {}): Pulse {
  return {
    id: 'p1',
    userId: 'author',
    venueId: 'v1',
    photos: [],
    energyRating: 'buzzing',
    caption: 'Named a staff member',
    kind: 'review',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    reactions: { fire: [], eyes: [], skull: [], lightning: [] },
    views: 0,
    ...overrides,
  }
}

describe('admin hide and undo', () => {
  const now = new Date('2026-10-09T04:00:00.000Z')

  it('lets an admin attach a resolution note and undo inside 10 seconds', () => {
    const hidden = hidePulseDecision({
      admin: true,
      note: '  Hidden because it named a staff member.  ',
      now,
    })
    expect(hidden).toEqual({
      ok: true,
      hiddenAt: now.toISOString(),
      note: 'Hidden because it named a staff member.',
    })
    expect(hidePulseDecision({ admin: false, note: 'nope' }).ok).toBe(false)
    expect(hidePulseDecision({ admin: true, note: 'x'.repeat(281) }).ok).toBe(false)
    expect(undoHideDecision({
      admin: true,
      hiddenAt: now.toISOString(),
      now: new Date(now.getTime() + 4_000),
    })).toEqual({ ok: true })
    expect(undoHideDecision({
      admin: true,
      hiddenAt: now.toISOString(),
      now: new Date(now.getTime() + HIDE_UNDO_MS + 1),
    }).ok).toBe(false)
    expect(HIDE_UNDO_MS).toBe(10_000)
  })

  it('shows the note to the owner and keeps the pulse out of Live now', () => {
    const hidden = pulse({ hiddenAt: now.toISOString(), hiddenNote: 'Repost without the name.' })
    expect(ownerHiddenCopy({ hiddenAt: hidden.hiddenAt, note: hidden.hiddenNote })).toEqual({
      hidden: true,
      line: 'Hidden from Live now · only you can see it',
      note: 'Repost without the name.',
    })
    expect(getLiveNowReviews([hidden, pulse({ id: 'live' })]).map((row) => row.id)).toEqual(['live'])
    expect(filterModeratedPulses([hidden], 'author', [], []).map((row) => row.id)).toEqual(['p1'])
    expect(filterModeratedPulses([hidden], 'someone-else', [], [])).toEqual([])
    expect(mapOwnerHiddenRow({
      id: 'p1',
      venue_id: 'v1',
      caption: 'Named a staff member',
      energy_rating: 'buzzing',
      created_at: now.toISOString(),
      hidden_at: now.toISOString(),
      hidden_note: 'Repost without the name.',
    })?.note).toBe('Repost without the name.')
  })
})
