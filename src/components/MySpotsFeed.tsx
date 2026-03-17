import { Venue, PulseWithUser } from '@/lib/types'
import { PulseCard } from '@/components/PulseCard'
import { Card } from '@/components/ui/card'
import { PulseScore } from '@/components/PulseScore'
import { MapPin, HeartStraight, Buildings, Lightning, Compass } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { formatDistance } from '@/lib/units'
import { formatTimeAgo } from '@/lib/pulse-engine'

interface MySpotsFeedProps {
  followedVenues: Venue[]
  pulses: PulseWithUser[]
  userLocation: { lat: number; lng: number } | null
  unitSystem: 'imperial' | 'metric'
  currentUserId: string
  onVenueClick: (venue: Venue) => void
  onToggleFollow: (venueId: string) => void
  onReaction: (pulseId: string, type: 'fire' | 'eyes' | 'skull' | 'lightning') => void
  onExplore?: () => void
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8
  const p1 = (lat1 * Math.PI) / 180
  const p2 = (lat2 * Math.PI) / 180
  const dp = ((lat2 - lat1) * Math.PI) / 180
  const dl = ((lon2 - lon1) * Math.PI) / 180
  const a = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function MySpotsFeed({
  followedVenues,
  pulses,
  userLocation,
  unitSystem,
  currentUserId,
  onVenueClick,
  onToggleFollow,
  onReaction,
  onExplore
}: MySpotsFeedProps) {
  const followedPulses = pulses
    .filter((p) => followedVenues.some((v) => v.id === p.venueId))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  // Count pulses per venue for activity indicator
  const venueActivityCounts = new Map<string, number>()
  followedPulses.forEach((p) => {
    venueActivityCounts.set(p.venueId, (venueActivityCounts.get(p.venueId) || 0) + 1)
  })

  if (followedVenues.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl mx-auto px-4 py-12"
      >
        <div className="text-center space-y-5">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
            className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 border border-primary/30 flex items-center justify-center mx-auto"
          >
            <HeartStraight size={36} weight="duotone" className="text-primary" />
          </motion.div>
          <div className="space-y-2">
            <h3 className="text-lg font-bold">No Followed Venues Yet</h3>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              Follow venues you love to see their pulse activity here. Tap the heart icon on any venue page to get started.
            </p>
          </div>
          {onExplore && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={onExplore}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium text-sm shadow-lg shadow-primary/30"
            >
              <Compass size={18} weight="fill" />
              Explore Venues
            </motion.button>
          )}
        </div>
      </motion.div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Buildings size={20} weight="fill" className="text-primary" />
            <h3 className="text-lg font-bold">Following</h3>
            <span className="text-xs text-muted-foreground font-mono">
              {followedVenues.length}/10
            </span>
          </div>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
          <AnimatePresence>
            {followedVenues.map((venue, index) => {
              const distance = userLocation
                ? calculateDistance(userLocation.lat, userLocation.lng, venue.location.lat, venue.location.lng)
                : undefined
              const activityCount = venueActivityCounts.get(venue.id) || 0

              return (
                <motion.div
                  key={venue.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
                  transition={{ delay: index * 0.05 }}
                  className="flex-shrink-0"
                >
                  <Card
                    className="w-40 p-3 cursor-pointer hover:bg-card/80 transition-colors border-border/50 hover:border-primary/30 relative group"
                    onClick={() => onVenueClick(venue)}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onToggleFollow(venue.id)
                      }}
                      className="absolute top-1.5 right-1.5 p-1 rounded-full bg-background/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    >
                      <HeartStraight size={12} weight="fill" className="text-primary" />
                    </button>
                    <div className="space-y-2">
                      <p className="text-sm font-bold truncate">{venue.name}</p>
                      {venue.category && (
                        <p className="text-[10px] text-muted-foreground font-mono uppercase">{venue.category}</p>
                      )}
                      <div className="flex items-center justify-between">
                        <PulseScore score={venue.pulseScore} size="sm" showLabel={false} />
                        {activityCount > 0 && (
                          <div className="flex items-center gap-1 text-[10px] font-medium text-cyan-400">
                            <Lightning size={10} weight="fill" />
                            <span>{activityCount}</span>
                          </div>
                        )}
                      </div>
                      {venue.lastPulseAt && (
                        <p className="text-[10px] text-muted-foreground truncate">
                          {formatTimeAgo(venue.lastPulseAt)}
                        </p>
                      )}
                      {distance !== undefined && (
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <MapPin size={10} weight="fill" />
                          <span>{formatDistance(distance, unitSystem)}</span>
                        </div>
                      )}
                    </div>
                  </Card>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-bold">Recent Activity</h3>
        {followedPulses.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-8 space-y-2"
          >
            <div className="w-12 h-12 rounded-full bg-card border border-border flex items-center justify-center mx-auto mb-3">
              <Lightning size={20} weight="duotone" className="text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">No pulses from your followed venues yet</p>
            <p className="text-sm text-muted-foreground">
              Activity from your followed venues will appear here
            </p>
          </motion.div>
        ) : (
          <AnimatePresence>
            {followedPulses.map((pulse, index) => (
              <motion.div
                key={pulse.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
              >
                <PulseCard
                  pulse={pulse}
                  allPulses={pulses}
                  onReaction={(type) => onReaction(pulse.id, type)}
                  currentUserId={currentUserId}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}
