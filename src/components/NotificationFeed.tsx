import { useState, useEffect } from 'react'
import { useKV } from '@github/spark/hooks'
import { Notification, GroupedNotification, NotificationWithData, Pulse, User, Venue } from '@/lib/types'
import { NotificationCard } from '@/components/NotificationCard'
import { groupNotifications } from '@/lib/notification-grouping'
import { useNotificationSettings } from '@/hooks/use-notification-settings'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { CheckCircle, Bell } from '@phosphor-icons/react'
import { motion } from 'framer-motion'

interface NotificationFeedProps {
  currentUser: User
  pulses: Pulse[]
  venues: Venue[]
  onNotificationClick: (notification: GroupedNotification) => void
}

export function NotificationFeed({
  currentUser,
  pulses,
  venues,
  onNotificationClick
}: NotificationFeedProps) {
  const [notifications, setNotifications] = useKV<Notification[]>('notifications', [])
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const { settings } = useNotificationSettings()

  const enrichNotification = (notification: Notification): NotificationWithData | null => {
    const pulse = notification.pulseId
      ? pulses.find((p) => p.id === notification.pulseId)
      : undefined

    const venue = notification.venueId
      ? venues.find((v) => v.id === notification.venueId)
      : pulse
      ? venues.find((v) => v.id === pulse.venueId)
      : undefined

    const user =
      notification.type === 'friend_pulse' || notification.type === 'pulse_reaction'
        ? currentUser
        : undefined

    if (!notification.pulseId && !notification.venueId) return null

    return {
      ...notification,
      user,
      pulse: pulse
        ? {
            ...pulse,
            user: currentUser,
            venue: venue!
          }
        : undefined,
      venue
    }
  }

  const enrichedNotifications = (notifications || [])
    .map(enrichNotification)
    .filter((n): n is NotificationWithData => n !== null)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const groupedNotifications = groupNotifications(enrichedNotifications, {
    groupReactions: settings?.groupReactions ?? true,
    groupFriendPulses: settings?.groupFriendPulses ?? false,
    groupTrendingVenues: settings?.groupTrendingVenues ?? false
  })

  const filteredNotifications =
    filter === 'unread'
      ? groupedNotifications.filter((n) => !n.read)
      : groupedNotifications

  const unreadCount = groupedNotifications.filter((n) => !n.read).length

  const markAsRead = (notificationId: string) => {
    setNotifications((current) => {
      if (!current) return []
      return current.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
    })
  }

  const markAllAsRead = () => {
    setNotifications((current) => {
      if (!current) return []
      return current.map((n) => ({ ...n, read: true }))
    })
  }

  const handleNotificationClick = (notification: GroupedNotification) => {
    markAsRead(notification.id)
    
    if (notification.groupedUsers && notification.count && notification.count > 1) {
      const relatedNotifications = (notifications || []).filter(
        n => n.type === 'pulse_reaction' && n.pulseId === notification.pulseId
      )
      relatedNotifications.forEach(n => markAsRead(n.id))
    }
    
    onNotificationClick(notification)
  }

  if (groupedNotifications.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex flex-col items-center justify-center py-16 space-y-4">
          <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center">
            <Bell size={40} className="text-muted-foreground" />
          </div>
          <div className="text-center space-y-2">
            <h3 className="text-lg font-bold">No notifications yet</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              When your friends post pulses or react to yours, you'll see them here
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Notifications</h2>
          {unreadCount > 0 && (
            <p className="text-sm text-muted-foreground mt-1">
              {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={markAllAsRead}
            className="text-accent hover:text-accent hover:bg-accent/10"
          >
            <CheckCircle size={18} weight="bold" className="mr-2" />
            Mark all read
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant={filter === 'all' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setFilter('all')}
          className={filter === 'all' ? 'bg-primary' : ''}
        >
          All
        </Button>
        <Button
          variant={filter === 'unread' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setFilter('unread')}
          className={filter === 'unread' ? 'bg-primary' : ''}
        >
          Unread {unreadCount > 0 && `(${unreadCount})`}
        </Button>
      </div>

      <Separator />

      <div className="space-y-3">
        {filteredNotifications.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-muted-foreground">
              No unread notifications
            </p>
          </div>
        ) : (
          filteredNotifications.map((notification) => (
            <NotificationCard
              key={notification.id}
              notification={notification}
              onClick={() => handleNotificationClick(notification)}
            />
          ))
        )}
      </div>
    </div>
  )
}
