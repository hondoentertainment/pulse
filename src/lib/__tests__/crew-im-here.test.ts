import { describe, expect, it } from 'vitest'
import { crewImHereForViewer, formatCrewImHere } from '../crew-im-here'

const now = Date.parse('2026-10-01T04:00:00.000Z')
const recent = new Date(now - 10 * 60 * 1000).toISOString()

const crewA = {
  ownerId: 'owner-a',
  venueId: 'neumos',
  memberUserIds: ['maya', 'sam'],
}
const crewB = {
  ownerId: 'owner-b',
  venueId: 'neumos',
  memberUserIds: ['lee', 'jo'],
}

const presence = [
  { userId: 'maya', venueId: 'neumos', checkedInAt: recent, username: 'Maya' },
  { userId: 'sam', venueId: 'neumos', checkedInAt: recent, username: 'Sam' },
  { userId: 'lee', venueId: 'neumos', checkedInAt: recent, username: 'Lee' },
  { userId: 'owner-a', venueId: 'barboza', checkedInAt: recent, username: 'Alex' },
]

describe('crew tonight I am here', () => {
  it('shows crew mates at the pinned venue and hides other crews', () => {
    const visible = crewImHereForViewer({
      viewerId: 'sam',
      crews: [crewA, crewB],
      presence,
      venueId: 'neumos',
      nowMs: now,
    })
    expect(visible.map((row) => row.userId)).toEqual(['maya'])
    expect(formatCrewImHere(visible)).toBe('Maya is here')
  })

  it('lets the owner see both members and does not leak guests', () => {
    const visible = crewImHereForViewer({
      viewerId: 'owner-a',
      crews: [crewA],
      presence,
      venueId: 'neumos',
      nowMs: now,
    })
    expect(visible.map((row) => row.userId)).toEqual(['maya', 'sam'])
    expect(formatCrewImHere(visible)).toBe('Maya and Sam are here')
    expect(crewImHereForViewer({
      viewerId: null,
      crews: [crewA, crewB],
      presence,
      venueId: 'neumos',
      nowMs: now,
    })).toEqual([])
    expect(crewImHereForViewer({
      viewerId: 'stranger',
      crews: [crewA],
      presence,
      venueId: 'neumos',
      nowMs: now,
    })).toEqual([])
  })
})
