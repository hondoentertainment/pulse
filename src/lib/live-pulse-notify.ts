/**
 * Who should get a live-pulse Web Push: followers of the venue, or
 * subscribers who shared a nearby lat/lng.
 */

export const LIVE_PULSE_NEARBY_MILES = 1.5

export interface NotifySubscriber {
  userId: string
  lat?: number | null
  lng?: number | null
  scope?: 'followed' | 'nearby' | 'followed_or_nearby'
}

export interface LivePulseNotifyTarget {
  userId: string
  reason: 'followed' | 'nearby'
}

function haversineMiles(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 3958.8
  const toRad = (x: number) => (x * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(Math.min(1, h)))
}

export function selectLivePulseNotifyTargets(input: {
  authorUserId?: string | null
  followedUserIds: readonly string[]
  subscribers: readonly NotifySubscriber[]
  venueLocation?: { lat: number; lng: number } | null
  nearbyMiles?: number
}): LivePulseNotifyTarget[] {
  const nearbyMiles = input.nearbyMiles ?? LIVE_PULSE_NEARBY_MILES
  const followed = new Set(input.followedUserIds)
  const seen = new Set<string>()
  const targets: LivePulseNotifyTarget[] = []

  for (const sub of input.subscribers) {
    if (!sub.userId || seen.has(sub.userId)) continue
    if (input.authorUserId && sub.userId === input.authorUserId) continue
    const scope = sub.scope ?? 'followed_or_nearby'
    const isFollowed = followed.has(sub.userId)
    if ((scope === 'followed' || scope === 'followed_or_nearby') && isFollowed) {
      seen.add(sub.userId)
      targets.push({ userId: sub.userId, reason: 'followed' })
      continue
    }
    const canNearby = scope === 'nearby' || scope === 'followed_or_nearby'
    if (
      canNearby
      && input.venueLocation
      && typeof sub.lat === 'number'
      && typeof sub.lng === 'number'
    ) {
      const miles = haversineMiles(input.venueLocation, { lat: sub.lat, lng: sub.lng })
      if (miles <= nearbyMiles) {
        seen.add(sub.userId)
        targets.push({ userId: sub.userId, reason: 'nearby' })
      }
    }
  }

  return targets
}

/** In-app notifications go to every follower, even without a Web Push token. */
export function collectLivePulseNotifyUserIds(input: {
  authorUserId?: string | null
  followedUserIds: readonly string[]
  subscriberTargets: readonly { userId: string }[]
}): string[] {
  const ids = new Set<string>()
  for (const id of input.followedUserIds) {
    if (id && id !== input.authorUserId) ids.add(id)
  }
  for (const target of input.subscriberTargets) {
    if (target.userId && target.userId !== input.authorUserId) ids.add(target.userId)
  }
  return [...ids]
}

export function livePulseNotifyPayload(input: {
  venueId: string
  venueName: string
  caption?: string | null
}): { title: string; body: string; url: string } {
  const snippet = (input.caption ?? '').trim()
  return {
    title: input.venueName,
    body: snippet || 'New live pulse',
    url: `/venue/${input.venueId}`,
  }
}
