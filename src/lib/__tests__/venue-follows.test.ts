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

describe('follows RLS intent (reused venue Follow)', () => {
  it('uses existing follows — follower writes, live rows selectable, no second table', () => {
    expect(VENUE_FOLLOWS_RLS.table).toBe('follows')
    expect(VENUE_FOLLOWS_RLS.select).toBe('deleted_at IS NULL OR is_admin()')
    expect(VENUE_FOLLOWS_RLS.insert).toBe('auth.uid() = follower_id')
    expect(VENUE_FOLLOWS_RLS.update).toBe('auth.uid() = follower_id OR is_admin()')
    expect(VENUE_FOLLOWS_RLS.delete).toBe('auth.uid() = follower_id OR is_admin()')
    expect(VENUE_FOLLOWS_RLS.venueRow).toBe('target_kind = venue AND target_venue_id IS NOT NULL')
    expect(VENUE_FOLLOWS_RLS.anon).toBe('no writes')
  })
})
