import { useMemo } from 'react'
import { User, Venue, Pulse } from '@/lib/types'
import { generateActivityDigest } from '@/lib/social-graph'
import { getEnergyLabel } from '@/lib/pulse-engine'
import { Users, MapPin, Lightning } from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'

interface LiveActivityFeedProps {
  currentUser: User
  allUsers: User[]
  venues: Venue[]
  pulses: Pulse[]
  onVenueClick: (venue: Venue) => void
}

function formatTimestamp(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function energyColor(label: string): string {
  switch (label) {
    case 'Electric': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
    case 'Buzzing': return 'bg-orange-500/20 text-orange-400 border-orange-500/30'
    case 'Chill': return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
    default: return 'bg-muted text-muted-foreground border-border'
  }
}

export function LiveActivityFeed({
  currentUser,
  allUsers,
  venues,
  pulses,
  onVenueClick,
}: LiveActivityFeedProps) {
  const venueSummaries = useMemo(
    () => venues.map(venue => ({ id: venue.id, name: venue.name })),
    [venues]
  )
  const venueById = useMemo(
    () => new Map(venues.map(venue => [venue.id, venue] as const)),
    [venues]
  )
  const digest = useMemo(
    () => generateActivityDigest(
      currentUser,
      allUsers,
      pulses,
      venueSummaries
    ),
    [allUsers, currentUser, pulses, venueSummaries]
  )

  if (digest.entries.length === 0) {
    return (
      <Card className="p-6 text-center">
        <Users size={32} className="mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Your friends haven't pulsed recently
        </p>
      </Card>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-3">
        <Users size={20} weight="fill" className="text-primary" />
        <h3 className="text-lg font-bold">Friend Activity</h3>
      </div>
      {digest.entries.map((entry, i) =>
        entry.venues.map((venueActivity, j) => {
          const venue = venueById.get(venueActivity.venueId)
          if (!venue) return null
          const energyLabel = getEnergyLabel(venue.pulseScore)
          return (
            <motion.div
              key={`${entry.userId}-${venueActivity.venueId}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: (i + j) * 0.05, duration: 0.2 }}
            >
              <button
                onClick={() => onVenueClick(venue)}
                className="w-full text-left"
              >
                <Card className="p-3 hover:bg-accent/5 transition-colors">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9 flex-shrink-0">
                      {entry.profilePhoto && (
                        <AvatarImage src={entry.profilePhoto} alt={entry.username} />
                      )}
                      <AvatarFallback className="text-xs">
                        {entry.username.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">
                        <span className="font-semibold">{entry.username}</span>
                        {' '}checked into{' '}
                        <span className="font-semibold">{venueActivity.venueName}</span>
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground">
                          {formatTimestamp(venueActivity.timestamp)}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 ${energyColor(energyLabel)}`}
                        >
                          <Lightning size={8} weight="fill" className="mr-0.5" />
                          {energyLabel}
                        </Badge>
                      </div>
                    </div>
                    <MapPin size={16} className="text-muted-foreground flex-shrink-0" />
                  </div>
                </Card>
              </button>
            </motion.div>
          )
        })
      )}
    </div>
  )
}
