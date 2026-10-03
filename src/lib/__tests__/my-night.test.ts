import { describe, expect, it } from 'vitest'
import {
  canPinMyNight,
  MY_NIGHT_PIN_CAP,
  nextPinnedVenueIds,
  orderFollowingRowsPinnedFirst,
} from '../my-night'

describe('my night pins', () => {
  it('caps pins at 2–3 rooms', () => {
    expect(MY_NIGHT_PIN_CAP).toBe(3)
    expect(canPinMyNight(2, false)).toBe(true)
    expect(canPinMyNight(3, false)).toBe(false)
    expect(canPinMyNight(3, true)).toBe(true)
    expect(nextPinnedVenueIds(['a', 'b', 'c'], 'd').atCap).toBe(true)
    expect(nextPinnedVenueIds(['a'], 'b').ids).toEqual(['a', 'b'])
    expect(nextPinnedVenueIds(['a', 'b'], 'a').ids).toEqual(['b'])
  })

  it('orders Following with pinned rooms first', () => {
    const rows = [
      { venue: { id: 'late' } },
      { venue: { id: 'pinned' } },
    ]
    expect(orderFollowingRowsPinnedFirst(rows, ['pinned']).map((row) => row.venue.id)).toEqual([
      'pinned',
      'late',
    ])
  })
})
