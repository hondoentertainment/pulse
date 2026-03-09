import { User, Pulse, PresenceData } from './types'
import { calculateDistance } from './pulse-engine'

const NEARBY_RADIUS_FEET = 250
const FEET_PER_MILE = 5280
const NEARBY_RADIUS_MILES = NEARBY_RADIUS_FEET / FEET_PER_MILE
const CO_PRESENCE_WINDOW_MINS = 90
const RECENT_HISTORY_DAYS = 7

export interface PresenceContext {
    currentUser: User
    allUsers: User[]
    allPulses: Pulse[]
    venueLocation: { lat: number; lng: number }
    userLocations: Record<string, { lat: number; lng: number, lastUpdate: string }>
}

export function calculatePresence(
    venueId: string,
    context: PresenceContext
): PresenceData {
    const { currentUser, allUsers, allPulses, venueLocation, userLocations } = context
    const now = new Date()

    // 1. Filter eligible users (privacy + activity)
    const eligibleUsers = allUsers.filter(user => {
        if (user.id === currentUser.id) return false

        const settings = user.presenceSettings || { enabled: true, visibility: 'everyone', hideAtSensitiveVenues: false }
        if (!settings.enabled || settings.visibility === 'off') return false
        if (settings.visibility === 'friends' && !currentUser.friends.includes(user.id)) return false

        // Check if user has shared location recently (last 5 mins)
        const loc = userLocations[user.id]
        if (!loc) return false
        const locAge = (now.getTime() - new Date(loc.lastUpdate).getTime()) / 60000
        if (locAge > 5) return false

        return true
    })

    // 2. Identify Friends & Familiar Faces
    const friends = eligibleUsers.filter(u => currentUser.friends.includes(u.id))

    // A "familiar face" = reacted to each other OR co-presence in last 7 days
    const familiarFaces = eligibleUsers.filter(u => {
        if (friends.find(f => f.id === u.id)) return false // Don't count friends as just familiar

        const hasReacted = allPulses.some(p =>
            (p.userId === currentUser.id && Object.values(p.reactions).flat().includes(u.id)) ||
            (p.userId === u.id && Object.values(p.reactions).flat().includes(currentUser.id))
        )
        if (hasReacted) return true

        // Co-presence check (recent venue history)
        const sevenDaysAgo = new Date(now.getTime() - RECENT_HISTORY_DAYS * 24 * 60 * 60 * 1000)
        const recentPulses = allPulses.filter(p => new Date(p.createdAt) > sevenDaysAgo)

        const sharedVenues = recentPulses.some(p1 => {
            if (p1.userId !== currentUser.id) return false
            return recentPulses.some(p2 => {
                if (p2.userId !== u.id || p1.venueId !== p2.venueId) return false
                const timeDiff = Math.abs(new Date(p1.createdAt).getTime() - new Date(p2.createdAt).getTime()) / 60000
                return timeDiff <= CO_PRESENCE_WINDOW_MINS
            })
        })

        return sharedVenues
    })

    // 3. Proximity Checks (Nearby vs In-Venue)
    // Geofence is 250ft
    const friendsHereNow: User[] = []
    const friendsNearby: User[] = []

    friends.forEach(user => {
        const loc = userLocations[user.id]
        const distance = calculateDistance(venueLocation.lat, venueLocation.lng, loc.lat, loc.lng)

        if (distance <= NEARBY_RADIUS_MILES * 0.5) { // "In venue" core
            friendsHereNow.push(user)
        } else if (distance <= NEARBY_RADIUS_MILES) { // "Nearby" ring
            friendsNearby.push(user)
        }
    })

    const familiarFacesNearby = familiarFaces.filter(user => {
        const loc = userLocations[user.id]
        const distance = calculateDistance(venueLocation.lat, venueLocation.lng, loc.lat, loc.lng)
        return distance <= NEARBY_RADIUS_MILES
    })

    // 4. Aggregation Logic (Thresholding & Suppression)
    const totalCount = friendsHereNow.length + friendsNearby.length + familiarFacesNearby.length
    const isSuppressed = totalCount < 2 // Safety Rule: show nothing unless >= 2

    // Avatar Prioritization
    const prioritizedAvatars: string[] = [
        ...friendsHereNow.map(u => u.profilePhoto || ''),
        ...friendsNearby.map(u => u.profilePhoto || ''),
        ...familiarFacesNearby.map(u => u.profilePhoto || '')
    ].filter(url => url !== '').slice(0, 6)

    return {
        venueId,
        friendsHereNowCount: friendsHereNow.length,
        friendsNearbyCount: friendsNearby.length,
        familiarFacesCount: familiarFacesNearby.length,
        prioritizedAvatars: isSuppressed ? [] : prioritizedAvatars,
        lastPresenceUpdateAt: now.toISOString(),
        isSuppressed
    }
}

export function applyJitter(count: number): string {
    if (count <= 0) return '0'
    if (count < 5) return count.toString()
    return `${Math.floor(count / 2) * 2}+` // Simple jitter/rounding
}
