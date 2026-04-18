import { useCallback, useMemo } from 'react'
import { useKV } from '@github/spark/hooks'
import type { User, Venue } from '@/lib/types'
import {
  createRSVP,
  cancelRSVP as cancelRSVPFn,
  getVenueNightPlan,
  getFriendsGoingTonight,
  getPopularVenuesTonight,
  getSuggestedVenues,
  getTonightDateString,
  type VenueRSVP,
  type VenueNightPlan,
  type ArrivalEstimate,
} from '@/lib/going-tonight'

// ── Mock seed data for demo ──────────────────────────────────

const MOCK_FRIEND_NAMES = ['Sarah', 'Mike', 'Alex', 'Jordan', 'Taylor', 'Casey', 'Riley', 'Morgan']

function generateMockFriendUsers(): User[] {
  return MOCK_FRIEND_NAMES.map((name, i) => ({
    id: `mock-friend-${i + 1}`,
    username: name,
    profilePhoto: `https://api.dicebear.com/7.x/avataaars/svg?seed=${name.toLowerCase()}`,
    friends: [],
    createdAt: new Date().toISOString(),
  }))
}

function generateSeedRsvps(venues: Venue[]): VenueRSVP[] {
  if (venues.length === 0) return []

  const now = new Date()
  // Set to 9 PM tonight for realistic demo timestamps
  const tonightBase = new Date(now)
  tonightBase.setHours(21, 0, 0, 0)
  if (now.getHours() < 4) {
    tonightBase.setDate(tonightBase.getDate() - 1)
  }

  const arrivals: ArrivalEstimate[] = ['Around 9', 'Around 10', 'Around 11', 'Late night']
  const rsvps: VenueRSVP[] = []

  // Distribute mock friends across top venues
  const topVenues = venues.slice(0, Math.min(5, venues.length))
  const friends = generateMockFriendUsers()

  friends.forEach((friend, i) => {
    const venue = topVenues[i % topVenues.length]
    const status = i < 6 ? 'going' : 'maybe'
    rsvps.push({
      userId: friend.id,
      venueId: venue.id,
      timestamp: new Date(tonightBase.getTime() - (i * 10 * 60 * 1000)).toISOString(),
      status,
      arrivalEstimate: arrivals[i % arrivals.length],
    })
  })

  return rsvps
}

// ── Hook ─────────────────────────────────────────────────────

export interface UseGoingTonightReturn {
  /** RSVP as "going" to a venue */
  markGoing: (venueId: string, arrivalEstimate?: ArrivalEstimate) => void
  /** RSVP as "maybe" to a venue */
  markMaybe: (venueId: string) => void
  /** Cancel RSVP at a venue */
  cancelGoing: (venueId: string) => void
  /** User's current RSVP status at a specific venue */
  getMyStatus: (venueId: string) => VenueRSVP | null
  /** All venues the user is going to tonight */
  myPlansTonight: VenueRSVP[]
  /** Aggregated friend plans: venueId -> friend RSVPs */
  friendsPlans: Map<string, VenueRSVP[]>
  /** Top venues by RSVP count */
  popularTonight: (Venue & { goingCount: number })[]
  /** Venues suggested based on friend activity */
  suggestedVenues: (Venue & { friendCount: number })[]
  /** Get the night plan for a specific venue */
  getVenuePlan: (venueId: string) => VenueNightPlan
  /** All RSVPs for tonight */
  allRsvps: VenueRSVP[]
  /** Mock friend users for display */
  mockFriends: User[]
}

export function useGoingTonight(
  currentUserId: string,
  friendIds: string[],
  venues: Venue[],
  users: User[]
): UseGoingTonightReturn {
  const [rsvps, setRsvps] = useKV<VenueRSVP[]>('goingTonightRsvps', () => generateSeedRsvps(venues))
  const mockFriends = useMemo(() => generateMockFriendUsers(), [])

  const allUsers = useMemo(() => {
    const userIds = new Set(users.map(u => u.id))
    return [...users, ...mockFriends.filter(f => !userIds.has(f.id))]
  }, [users, mockFriends])

  const allFriendIds = useMemo(() => {
    const mockIds = mockFriends.map(f => f.id)
    return [...new Set([...friendIds, ...mockIds])]
  }, [friendIds, mockFriends])

  const markGoing = useCallback(
    (venueId: string, arrivalEstimate?: ArrivalEstimate) => {
      const rsvp = createRSVP(currentUserId, venueId, 'going', arrivalEstimate)
      setRsvps(prev => [...(prev ?? []), rsvp])
    },
    [currentUserId, setRsvps]
  )

  const markMaybe = useCallback(
    (venueId: string) => {
      const rsvp = createRSVP(currentUserId, venueId, 'maybe')
      setRsvps(prev => [...(prev ?? []), rsvp])
    },
    [currentUserId, setRsvps]
  )

  const cancelGoing = useCallback(
    (venueId: string) => {
      const rsvp = cancelRSVPFn(currentUserId, venueId)
      setRsvps(prev => [...(prev ?? []), rsvp])
    },
    [currentUserId, setRsvps]
  )

  const currentRsvps = useMemo(() => rsvps ?? [], [rsvps])

  const getMyStatus = useCallback(
    (venueId: string): VenueRSVP | null => {
      const myRsvps = currentRsvps
        .filter(r => r.userId === currentUserId && r.venueId === venueId)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

      const latest = myRsvps[0]
      if (!latest || latest.status === 'cancelled') return null
      return latest
    },
    [currentRsvps, currentUserId]
  )

  const myPlansTonight = useMemo(() => {
    const myRsvps = currentRsvps.filter(r => r.userId === currentUserId)
    // Deduplicate by venue, keep latest
    const byVenue = new Map<string, VenueRSVP>()
    for (const rsvp of myRsvps) {
      const existing = byVenue.get(rsvp.venueId)
      if (!existing || new Date(rsvp.timestamp).getTime() > new Date(existing.timestamp).getTime()) {
        byVenue.set(rsvp.venueId, rsvp)
      }
    }
    return Array.from(byVenue.values()).filter(r => r.status === 'going' || r.status === 'maybe')
  }, [currentRsvps, currentUserId])

  const friendsPlans = useMemo(
    () => getFriendsGoingTonight(currentUserId, allFriendIds, currentRsvps),
    [currentUserId, allFriendIds, currentRsvps]
  )

  const popularTonight = useMemo(
    () => getPopularVenuesTonight(currentRsvps, venues),
    [currentRsvps, venues]
  )

  const suggestedVenues = useMemo(
    () => getSuggestedVenues(currentUserId, currentRsvps, venues),
    [currentUserId, currentRsvps, venues]
  )

  const getVenuePlan = useCallback(
    (venueId: string): VenueNightPlan => {
      const date = getTonightDateString()
      return getVenueNightPlan(venueId, date, currentRsvps, allUsers)
    },
    [currentRsvps, allUsers]
  )

  return {
    markGoing,
    markMaybe,
    cancelGoing,
    getMyStatus,
    myPlansTonight,
    friendsPlans,
    popularTonight,
    suggestedVenues,
    getVenuePlan,
    allRsvps: currentRsvps,
    mockFriends,
  }
}
