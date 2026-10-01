import { NotificationWithData, GroupedNotification } from '@/lib/types'

export interface GroupingPreferences {
  groupReactions: boolean
  groupFriendPulses: boolean
  groupTrendingVenues: boolean
}

export function groupNotifications(
  notifications: NotificationWithData[],
  preferences: GroupingPreferences = {
    groupReactions: true,
    groupFriendPulses: false,
    groupTrendingVenues: false
  }
): GroupedNotification[] {
  const grouped: Map<string, GroupedNotification> = new Map()
  const standalone: GroupedNotification[] = []

  const seenIds = new Set<string>()

  for (const notification of notifications) {
    if (seenIds.has(notification.id)) continue
    seenIds.add(notification.id)

    let shouldGroup = false
    let groupKey = ''

    if (notification.type === 'pulse_reaction' && notification.pulseId && preferences.groupReactions) {
      shouldGroup = true
      groupKey = `reaction_${notification.pulseId}`
    } else if (
      (notification.type === 'friend_pulse'
        || notification.type === 'venue_surge'
        || notification.type === 'owner_reply')
      && notification.venueId
    ) {
      // Always collapse these return triggers. A preference must not reopen a storm.
      shouldGroup = true
      groupKey = `${notification.type}_${notification.venueId}_${getTimeWindow(notification.createdAt)}`
    } else if (notification.type === 'trending_venue' && notification.venueId && preferences.groupTrendingVenues) {
      shouldGroup = true
      groupKey = `trending_${notification.venueId}_${getTimeWindow(notification.createdAt)}`
    }

    if (shouldGroup && groupKey) {
      if (grouped.has(groupKey)) {
        const existing = grouped.get(groupKey)!
        existing.groupedIds = [...(existing.groupedIds ?? [existing.id]), notification.id]
        
        if (!existing.groupedUsers) {
          existing.groupedUsers = existing.user ? [existing.user] : []
          if (notification.type === 'pulse_reaction') {
            existing.groupedReactionTypes = existing.reactionType ? [existing.reactionType] : []
          }
          existing.count = 1
        }
        
        if (notification.user && !existing.groupedUsers.find(u => u.id === notification.user!.id)) {
          existing.groupedUsers.push(notification.user)
        }
        
        if (notification.type === 'pulse_reaction' && notification.reactionType) {
          if (!existing.groupedReactionTypes) {
            existing.groupedReactionTypes = []
          }
          if (!existing.groupedReactionTypes.includes(notification.reactionType)) {
            existing.groupedReactionTypes.push(notification.reactionType)
          }
        }
        
        existing.count = (existing.count || 1) + 1
        
        if (new Date(notification.createdAt) > new Date(existing.createdAt)) {
          existing.createdAt = notification.createdAt
        }
        
        if (!notification.read) {
          existing.read = false
        }
      } else {
        grouped.set(groupKey, { ...notification, groupedIds: [notification.id] })
      }
    } else {
      standalone.push(notification)
    }
  }

  return [...Array.from(grouped.values()), ...standalone].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
}

function getTimeWindow(timestamp: string): string {
  const date = new Date(timestamp)
  const hour = Math.floor(date.getTime() / (1000 * 60 * 60))
  return hour.toString()
}
