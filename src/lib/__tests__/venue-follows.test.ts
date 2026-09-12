import { describe, expect, it } from 'vitest'
import {
  canFollowAnotherVenue,
  nextFollowedVenueIds,
  VENUE_FOLLOW_LIMIT,
  VENUE_FOLLOWS_RLS,
} from '../venue-follows'

describe('venue follow rules', () => {
  it('toggles follow and unfollow', () => {
    const followed = nextFollowedVenueIds([], 'neumos')
    expect(followed).toEqual({ ids: ['neumos'], didFollow: true })
    expect(nextFollowedVenueIds(['neumos'], 'neumos')).toEqual({
      ids: [],
      didFollow: false,
    })
  })

  it('enforces the 10-venue cap', () => {
    const ids = Array.from({ length: VENUE_FOLLOW_LIMIT }, (_, i) => `v-${i}`)
    expect(canFollowAnotherVenue(ids, 'extra')).toBe(false)
    expect(nextFollowedVenueIds(ids, 'extra')).toEqual({ error: 'limit' })
    expect(canFollowAnotherVenue(ids, 'v-0')).toBe(true)
  })
})

describe('venue_follows RLS intent', () => {
  it('is owner-only read/write — no anon and no public select', () => {
    expect(VENUE_FOLLOWS_RLS.table).toBe('venue_follows')
    expect(VENUE_FOLLOWS_RLS.select).toBe('auth.uid() = user_id')
    expect(VENUE_FOLLOWS_RLS.insert).toBe('auth.uid() = user_id')
    expect(VENUE_FOLLOWS_RLS.delete).toBe('auth.uid() = user_id')
    expect(VENUE_FOLLOWS_RLS.anon).toBe('none')
  })
})
