import { motion } from 'framer-motion'
import { MapPin, Users, TrendUp, ArrowRight, CalendarCheck, MoonStars } from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { User, Venue } from '@/lib/types'
import type { VenueRSVP } from '@/lib/going-tonight'

// ── Types ────────────────────────────────────────────────────

interface FriendPlan {
  user: User
  venue: Venue
  rsvp: VenueRSVP
}

interface PopularVenue {
  venue: Venue
  goingCount: number
  maxCount: number
}

interface GoingTonightFeedProps {
  friendPlans: FriendPlan[]
  popularVenues: PopularVenue[]
  onJoin: (venueId: string) => void
  onVenueClick?: (venueId: string) => void
}

// ── Animation Variants ───────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
}

// ── Component ────────────────────────────────────────────────

export function GoingTonightFeed({
  friendPlans,
  popularVenues,
  onJoin,
  onVenueClick,
}: GoingTonightFeedProps) {
  const isEmpty = friendPlans.length === 0 && popularVenues.length === 0

  return (
    <Card className="p-4 bg-card border-border overflow-hidden" data-testid="going-tonight-feed">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <MoonStars size={20} weight="fill" className="text-primary" />
        <h3 className="text-lg font-bold">Tonight's Plans</h3>
      </div>

      {isEmpty ? (
        <EmptyState />
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-5"
        >
          {/* Friend Activity */}
          {friendPlans.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <Users size={12} weight="fill" />
                <span>Friends Going Out</span>
              </div>
              <motion.div variants={containerVariants} className="space-y-2">
                {friendPlans.map((plan) => (
                  <FriendPlanRow
                    key={`${plan.user.id}-${plan.venue.id}`}
                    plan={plan}
                    onJoin={onJoin}
                    onVenueClick={onVenueClick}
                  />
                ))}
              </motion.div>
            </div>
          )}

          {/* Popular Tonight */}
          {popularVenues.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <TrendUp size={12} weight="fill" />
                <span>Popular Tonight</span>
              </div>
              <motion.div variants={containerVariants} className="space-y-2">
                {popularVenues.slice(0, 3).map((pv, index) => (
                  <PopularVenueRow
                    key={pv.venue.id}
                    venue={pv}
                    rank={index + 1}
                    onVenueClick={onVenueClick}
                  />
                ))}
              </motion.div>
            </div>
          )}
        </motion.div>
      )}
    </Card>
  )
}

// ── Friend Plan Row ──────────────────────────────────────────

function FriendPlanRow({
  plan,
  onJoin,
  onVenueClick,
}: {
  plan: FriendPlan
  onJoin: (venueId: string) => void
  onVenueClick?: (venueId: string) => void
}) {
  const { user, venue, rsvp } = plan

  return (
    <motion.div
      variants={itemVariants}
      className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
      data-testid="friend-plan-row"
    >
      {/* Avatar */}
      <img
        src={user.profilePhoto ?? `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`}
        alt={user.username}
        className="w-9 h-9 rounded-full object-cover flex-shrink-0"
      />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold truncate">{user.username}</span>
          <span
            className={cn(
              'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
              rsvp.status === 'going'
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'bg-amber-500/20 text-amber-400'
            )}
          >
            {rsvp.status === 'going' ? 'Going' : 'Maybe'}
          </span>
        </div>
        <button
          onClick={() => onVenueClick?.(venue.id)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <MapPin size={10} weight="fill" />
          <span className="truncate">{venue.name}</span>
        </button>
        {rsvp.arrivalEstimate && (
          <span className="text-[10px] text-muted-foreground">{rsvp.arrivalEstimate}</span>
        )}
      </div>

      {/* Join Button */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => onJoin(venue.id)}
        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors flex-shrink-0"
        data-testid="join-button"
      >
        <CalendarCheck size={14} weight="fill" />
        Join
      </motion.button>
    </motion.div>
  )
}

// ── Popular Venue Row ────────────────────────────────────────

function PopularVenueRow({
  venue,
  rank,
  onVenueClick,
}: {
  venue: PopularVenue
  rank: number
  onVenueClick?: (venueId: string) => void
}) {
  const percentage = venue.maxCount > 0 ? (venue.goingCount / venue.maxCount) * 100 : 0

  return (
    <motion.div
      variants={itemVariants}
      className="p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors cursor-pointer"
      onClick={() => onVenueClick?.(venue.venue.id)}
      data-testid="popular-venue-row"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-muted-foreground w-4">#{rank}</span>
          <span className="text-sm font-semibold truncate">{venue.venue.name}</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
          <Users size={12} weight="fill" />
          <span>{venue.goingCount} going</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
    </motion.div>
  )
}

// ── Empty State ──────────────────────────────────────────────

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-8 text-center"
      data-testid="empty-state"
    >
      <MoonStars size={40} weight="duotone" className="text-muted-foreground/40 mb-3" />
      <p className="text-sm font-medium text-muted-foreground">No plans yet</p>
      <p className="text-xs text-muted-foreground/60 mt-1">Be the first to go out!</p>
      <ArrowRight size={16} className="text-muted-foreground/30 mt-2" />
    </motion.div>
  )
}
