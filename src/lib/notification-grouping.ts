import { NotificationWithData, GroupedNotification, User } from '@/lib/types'

export function groupNotifications(
  notifications: NotificationWithData[]
): GroupedNotification[] {
  const grouped: Map<string, GroupedNotification> = new Map()
  const standalone: GroupedNotification[] = []

  for (const notification of notifications) {
    if (notification.type === 'pulse_reaction' && notification.pulseId) {
      const groupKey = `reaction_${notification.pulseId}`
      
      if (grouped.has(groupKey)) {
        const existing = grouped.get(groupKey)!
        
        if (!existing.groupedUsers) {
          existing.groupedUsers = existing.user ? [existing.user] : []
          existing.groupedReactionTypes = existing.reactionType ? [existing.reactionType] : []
          existing.count = 1
        }
        
        if (notification.user && !existing.groupedUsers.find(u => u.id === notification.user!.id)) {
          existing.groupedUsers.push(notification.user)
        }
        
        if (notification.reactionType && !existing.groupedReactionTypes!.includes(notification.reactionType)) {
          existing.groupedReactionTypes!.push(notification.reactionType)
        }
        
        existing.count = (existing.count || 1) + 1
        
        if (new Date(notification.createdAt) > new Date(existing.createdAt)) {
          existing.createdAt = notification.createdAt
        }
        
        if (!notification.read) {
          existing.read = false
        }
      } else {
        grouped.set(groupKey, { ...notification })
      }
    } else {
      standalone.push(notification)
    }
  }

  return [...Array.from(grouped.values()), ...standalone].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
}
