import { GroupedNotification, ENERGY_CONFIG } from '@/lib/types'
import { formatTimeAgo } from '@/lib/pulse-engine'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { Lightning, Fire, Eye, Skull, MapPin, TrendUp } from '@phosphor-icons/react'
import { motion } from 'framer-motion'

interface NotificationCardProps {
  notification: GroupedNotification
  onClick?: () => void
}

export function NotificationCard({ notification, onClick }: NotificationCardProps) {
  const getNotificationContent = () => {
    switch (notification.type) {
      case 'friend_pulse':
        if (!notification.pulse || !notification.user || !notification.venue) return null
        const energyConfig = ENERGY_CONFIG[notification.pulse.energyRating]
        const isGroupedPulse = notification.count && notification.count > 1
        
        if (isGroupedPulse && notification.groupedUsers) {
          const displayUsers = notification.groupedUsers.slice(0, 3)
          const remainingCount = (notification.count || 0) - displayUsers.length
          
          return (
            <>
              <div className="flex items-start gap-3">
                <div className="flex -space-x-2 flex-shrink-0">
                  {displayUsers.map((user, index) => (
                    <div
                      key={user.id}
                      className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center border-2 border-card"
                      style={{ zIndex: displayUsers.length - index }}
                    >
                      <span className="text-xs font-bold">
                        {user.username.slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">
                    <span className="font-semibold text-foreground">
                      {displayUsers.map(u => u.username).join(', ')}
                      {remainingCount > 0 && ` and ${remainingCount} other${remainingCount !== 1 ? 's' : ''}`}
                    </span>
                    {' '}posted pulses at{' '}
                    <span className="font-semibold text-foreground">{notification.venue.name}</span>
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className="text-xs px-2 py-0.5 bg-primary text-primary-foreground">
                      {notification.count} pulses
                    </Badge>
                    <span className="text-xs text-muted-foreground font-mono uppercase">
                      {formatTimeAgo(notification.createdAt)}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )
        }
        
        return (
          <>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold">
                  {notification.user.username.slice(0, 2).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm">
                  <span className="font-semibold text-foreground">{notification.user.username}</span>
                  {' '}posted a pulse at{' '}
                  <span className="font-semibold text-foreground">{notification.venue.name}</span>
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge
                    className="text-xs px-2 py-0.5"
                    style={{
                      backgroundColor: energyConfig.color,
                      color: 'oklch(0.98 0 0)'
                    }}
                  >
                    {energyConfig.emoji} {energyConfig.label}
                  </Badge>
                  <span className="text-xs text-muted-foreground font-mono uppercase">
                    {formatTimeAgo(notification.createdAt)}
                  </span>
                </div>
                {notification.pulse.caption && (
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                    {notification.pulse.caption}
                  </p>
                )}
              </div>
              {notification.pulse.photos.length > 0 && (
                <div className="w-16 h-16 rounded-lg overflow-hidden bg-secondary flex-shrink-0">
                  <img
                    src={notification.pulse.photos[0]}
                    alt="Pulse preview"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
            </div>
          </>
        )

      case 'pulse_reaction':
        if (!notification.pulse || !notification.venue) return null
        const reactionIcons = {
          fire: Fire,
          eyes: Eye,
          skull: Skull,
          lightning: Lightning
        }
        
        const isGrouped = notification.count && notification.count > 1
        
        if (isGrouped && notification.groupedUsers && notification.groupedReactionTypes) {
          const displayUsers = notification.groupedUsers.slice(0, 3)
          const remainingCount = (notification.count || 0) - displayUsers.length
          
          return (
            <div className="flex items-start gap-3">
              <div className="flex -space-x-2 flex-shrink-0">
                {displayUsers.map((user, index) => (
                  <div
                    key={user.id}
                    className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center border-2 border-card"
                    style={{ zIndex: displayUsers.length - index }}
                  >
                    <span className="text-xs font-bold">
                      {user.username.slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm">
                  <span className="font-semibold text-foreground">
                    {displayUsers.map(u => u.username).join(', ')}
                    {remainingCount > 0 && ` and ${remainingCount} other${remainingCount !== 1 ? 's' : ''}`}
                  </span>
                  {' '}reacted to your pulse at{' '}
                  <span className="font-semibold text-foreground">{notification.venue.name}</span>
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex items-center gap-1">
                    {notification.groupedReactionTypes.map((reactionType) => {
                      const ReactionIcon = reactionIcons[reactionType]
                      return (
                        <ReactionIcon
                          key={reactionType}
                          size={16}
                          weight="fill"
                          className="text-accent"
                        />
                      )
                    })}
                  </div>
                  <span className="text-xs text-muted-foreground">•</span>
                  <span className="text-xs text-muted-foreground font-mono uppercase">
                    {formatTimeAgo(notification.createdAt)}
                  </span>
                </div>
              </div>
            </div>
          )
        }
        
        if (!notification.user) return null
        const ReactionIcon = notification.reactionType ? reactionIcons[notification.reactionType] : Fire
        return (
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-bold">
                {notification.user.username.slice(0, 2).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm">
                <span className="font-semibold text-foreground">{notification.user.username}</span>
                {' '}reacted to your pulse at{' '}
                <span className="font-semibold text-foreground">{notification.venue.name}</span>
              </p>
              <div className="flex items-center gap-2 mt-1">
                <ReactionIcon size={16} weight="fill" className="text-accent" />
                <span className="text-xs text-muted-foreground font-mono uppercase">
                  {formatTimeAgo(notification.createdAt)}
                </span>
              </div>
            </div>
          </div>
        )

      case 'friend_nearby':
        if (!notification.user || !notification.venue) return null
        return (
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent to-primary flex items-center justify-center flex-shrink-0">
              <MapPin size={20} weight="fill" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm">
                <span className="font-semibold text-foreground">{notification.user.username}</span>
                {' '}is at{' '}
                <span className="font-semibold text-foreground">{notification.venue.name}</span>
              </p>
              <span className="text-xs text-muted-foreground font-mono uppercase">
                {formatTimeAgo(notification.createdAt)}
              </span>
            </div>
          </div>
        )

      case 'trending_venue':
        if (!notification.venue) return null
        const isGroupedTrending = notification.count && notification.count > 1
        
        return (
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-energy-electric to-energy-buzzing flex items-center justify-center flex-shrink-0 animate-pulse-glow">
              <TrendUp size={20} weight="fill" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm">
                <span className="font-semibold text-foreground">{notification.venue.name}</span>
                {' '}is trending near you
                {isGroupedTrending && ` (${notification.count} alerts)`}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <Badge className="bg-accent text-accent-foreground text-xs px-2 py-0.5">
                  Hot Right Now
                </Badge>
                <span className="text-xs text-muted-foreground font-mono uppercase">
                  {formatTimeAgo(notification.createdAt)}
                </span>
              </div>
            </div>
          </div>
        )

      case 'impact':
        if (!notification.venue || !notification.energyThreshold) return null
        const thresholdEmoji = notification.energyThreshold === 'electric' ? '⚡' : '🔥'
        const thresholdLabel = notification.energyThreshold === 'electric' ? 'Electric' : 'Buzzing'
        const thresholdColor = notification.energyThreshold === 'electric' 
          ? 'from-energy-electric to-primary' 
          : 'from-energy-buzzing to-accent'
        
        return (
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${thresholdColor} flex items-center justify-center flex-shrink-0 animate-pulse-glow`}>
              <Lightning size={20} weight="fill" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm">
                <span className="font-semibold text-accent">Your pulse</span>
                {' '}pushed{' '}
                <span className="font-semibold text-foreground">{notification.venue.name}</span>
                {' '}into{' '}
                <span className="font-semibold text-accent">{thresholdLabel}</span>
                {' '}{thresholdEmoji}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <Badge className="bg-accent text-accent-foreground text-xs px-2 py-0.5">
                  You Moved The Needle
                </Badge>
                <span className="text-xs text-muted-foreground font-mono uppercase">
                  {formatTimeAgo(notification.createdAt)}
                </span>
              </div>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  const content = getNotificationContent()
  if (!content) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card
        className={`p-4 cursor-pointer transition-all hover:bg-card/80 border-l-4 ${
          notification.read
            ? 'border-l-border'
            : 'border-l-accent bg-card/50'
        }`}
        onClick={onClick}
      >
        {content}
      </Card>
    </motion.div>
  )
}
