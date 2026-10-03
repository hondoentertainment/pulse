import { useCallback, useEffect, useMemo, useState } from 'react'
import { USE_SUPABASE_BACKEND } from '@/lib/data'
import {
  followVenue,
  listMyVenueFollows,
  unfollowVenue,
} from '@/lib/data/venue-follows'
import { nextFollowedVenueIds, VENUE_FOLLOW_COPY } from '@/lib/venue-follows'
import { AuthRequiredError } from '@/lib/auth/require-auth'

export interface UseVenueFollowsResult {
  followedVenueIds: string[]
  isFollowed: (venueId: string) => boolean
  toggleFollow: (venueId: string) => Promise<{
    ok: boolean
    following: boolean
    error?: 'auth' | 'limit' | 'persist'
    message?: string
  }>
  ready: boolean
}

export function useVenueFollows(input: {
  userId?: string | null
  signedIn: boolean
  seedIds?: readonly string[]
}): UseVenueFollowsResult {
  const [followedVenueIds, setFollowedVenueIds] = useState<string[]>(
    () => [...(input.seedIds ?? [])],
  )
  const [ready, setReady] = useState(!input.signedIn)

  useEffect(() => {
    if (!input.signedIn || !input.userId) {
      setFollowedVenueIds([])
      setReady(true)
      return
    }
    if (!USE_SUPABASE_BACKEND) {
      setFollowedVenueIds([...(input.seedIds ?? [])])
      setReady(true)
      return
    }
    let cancelled = false
    setReady(false)
    void listMyVenueFollows(input.userId).then((ids) => {
      if (cancelled) return
      setFollowedVenueIds(ids)
      setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [input.seedIds, input.signedIn, input.userId])

  const isFollowed = useCallback(
    (venueId: string) => followedVenueIds.includes(venueId),
    [followedVenueIds],
  )

  const toggleFollow = useCallback(async (venueId: string) => {
    if (!input.signedIn || !input.userId) {
      return {
        ok: false as const,
        following: false,
        error: 'auth' as const,
        message: VENUE_FOLLOW_COPY.guestDescription,
      }
    }
    const next = nextFollowedVenueIds(followedVenueIds, venueId)
    if ('error' in next) {
      return {
        ok: false as const,
        following: false,
        error: 'limit' as const,
        message: VENUE_FOLLOW_COPY.limitDescription,
      }
    }
    const previous = followedVenueIds
    setFollowedVenueIds(next.ids)
    if (USE_SUPABASE_BACKEND) {
      try {
        if (next.didFollow) await followVenue(venueId)
        else await unfollowVenue(venueId)
      } catch (err) {
        setFollowedVenueIds(previous)
        if (err instanceof AuthRequiredError) {
          return {
            ok: false as const,
            following: previous.includes(venueId),
            error: 'auth' as const,
            message: VENUE_FOLLOW_COPY.guestDescription,
          }
        }
        return {
          ok: false as const,
          following: previous.includes(venueId),
          error: 'persist' as const,
          message: err instanceof Error ? err.message : 'Could not update follow',
        }
      }
    }
    return { ok: true as const, following: next.didFollow }
  }, [followedVenueIds, input.signedIn, input.userId])

  return useMemo(
    () => ({ followedVenueIds, isFollowed, toggleFollow, ready }),
    [followedVenueIds, isFollowed, ready, toggleFollow],
  )
}
