import { describe, expect, it } from 'vitest'
import {
  formatHereNowCount,
  friendNamesForViewer,
  isPresenceActive,
  presenceExpiresAt,
} from '../here-now'

describe('here now', () => {
  it('treats I’m-here as a 90-minute presence window', () => {
    const start = '2026-09-14T01:00:00.000Z'
    const t = Date.parse(start)
    expect(isPresenceActive(start, null, t + 30 * 60 * 1000)).toBe(true)
    expect(isPresenceActive(start, null, t + 91 * 60 * 1000)).toBe(false)
    expect(isPresenceActive(start, '2026-09-14T01:10:00.000Z', t + 20 * 60 * 1000)).toBe(false)
    expect(presenceExpiresAt(start)).toBe('2026-09-14T02:30:00.000Z')
  })

  it('shows a count to everyone and names only for followed people', () => {
    expect(formatHereNowCount(3)).toBe('3 here now')
    expect(formatHereNowCount(0)).toBe('0 here now')
    expect(friendNamesForViewer(
      [
        { userId: 'friend', username: 'kai' },
        { userId: 'stranger', username: 'anon' },
      ],
      ['friend'],
    )).toEqual([{ userId: 'friend', username: 'kai' }])
  })
})
