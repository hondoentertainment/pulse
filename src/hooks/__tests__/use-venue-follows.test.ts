// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const listMyVenueFollows = vi.fn(async () => ['neumos'])
const followVenue = vi.fn(async () => undefined)
const unfollowVenue = vi.fn(async () => undefined)

vi.mock('@/lib/data', () => ({
  USE_SUPABASE_BACKEND: true,
}))

vi.mock('@/lib/data/venue-follows', () => ({
  listMyVenueFollows: (...args: unknown[]) => listMyVenueFollows(...args),
  followVenue: (...args: unknown[]) => followVenue(...args),
  unfollowVenue: (...args: unknown[]) => unfollowVenue(...args),
}))

import { useVenueFollows } from '../use-venue-follows'

describe('useVenueFollows', () => {
  beforeEach(() => {
    listMyVenueFollows.mockClear()
    followVenue.mockClear()
    unfollowVenue.mockClear()
  })

  it('loads persisted follows for a signed-in user', async () => {
    const { result } = renderHook(() => useVenueFollows({
      userId: 'user-1',
      signedIn: true,
    }))
    await waitFor(() => expect(result.current.ready).toBe(true))
    expect(result.current.followedVenueIds).toEqual(['neumos'])
    expect(result.current.isFollowed('neumos')).toBe(true)
  })

  it('persists follow and unfollow', async () => {
    const { result } = renderHook(() => useVenueFollows({
      userId: 'user-1',
      signedIn: true,
    }))
    await waitFor(() => expect(result.current.ready).toBe(true))
    await act(async () => {
      const unfollow = await result.current.toggleFollow('neumos')
      expect(unfollow.ok).toBe(true)
      expect(unfollow.following).toBe(false)
    })
    expect(unfollowVenue).toHaveBeenCalledWith('neumos')

    await act(async () => {
      const follow = await result.current.toggleFollow('barrio')
      expect(follow.ok).toBe(true)
      expect(follow.following).toBe(true)
    })
    expect(followVenue).toHaveBeenCalledWith('barrio')
  })

  it('sends guests to the auth path instead of writing', async () => {
    const { result } = renderHook(() => useVenueFollows({
      userId: null,
      signedIn: false,
    }))
    const outcome = await result.current.toggleFollow('neumos')
    expect(outcome.ok).toBe(false)
    expect(outcome.error).toBe('auth')
    expect(followVenue).not.toHaveBeenCalled()
  })
})
