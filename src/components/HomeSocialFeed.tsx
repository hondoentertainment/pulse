import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { Sparkle, TrendUp, Users } from '@phosphor-icons/react'
import type { Pulse, Venue } from '@/lib/types'
import type { Recommendation } from '@/lib/venue-recommendations'
import type { TrendingSection } from '@/lib/venue-trending'
import type { PromotedVenue } from '@/lib/promoted-discoveries'
import { RecommendationCard } from '@/components/RecommendationCard'
import { TrendingSections } from '@/components/TrendingSections'
import { LiveActivityFeed } from '@/components/LiveActivityFeed'
import type { User } from '@/lib/types'

interface HomeSocialFeedProps {
  recommendations: Recommendation[]
  sections: TrendingSection[]
  venues: Venue[]
  pulses: Pulse[]
  currentUser: User
  allUsers: User[]
  userLocation: { lat: number; lng: number } | null
  promotions: PromotedVenue[]
  onVenueClick: (venue: Venue) => void
  onPromotionClick?: (promotionId: string) => void
  isFavorite: (venueId: string) => boolean
  onToggleFavorite: (venueId: string) => void
}

export function HomeSocialFeed({
  recommendations,
  sections,
  venues,
  pulses,
  currentUser,
  allUsers,
  userLocation,
  promotions,
  onVenueClick,
  onPromotionClick,
  isFavorite,
  onToggleFavorite,
}: HomeSocialFeedProps) {
  const promotedByVenueId = new Map(promotions.map(promo => [promo.venueId, promo.id]))

  return (
    <div className="mx-auto max-w-2xl px-4 py-5">
      <div className="space-y-5">
        <FeedBlock icon={<Sparkle size={18} weight="fill" />} title="For you tonight" kicker="Ranked by your taste, friends, and live intel">
          {recommendations.length > 0 ? (
            <div className="space-y-2">
              {recommendations.slice(0, 3).map(rec => (
                <RecommendationCard
                  key={rec.venue.id}
                  recommendation={rec}
                  isSponsored={promotedByVenueId.has(rec.venue.id)}
                  onClick={() => {
                    const promoId = promotedByVenueId.get(rec.venue.id)
                    if (promoId) onPromotionClick?.(promoId)
                    onVenueClick(rec.venue)
                  }}
                />
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
              Save a few venues or post a pulse and this feed will tune itself to your night.
            </p>
          )}
        </FeedBlock>

        <FeedBlock icon={<Users size={18} weight="fill" />} title="Friends are moving" kicker="Fresh check-ins and social proof">
          <LiveActivityFeed
            currentUser={currentUser}
            allUsers={allUsers}
            venues={venues}
            pulses={pulses}
            onVenueClick={onVenueClick}
          />
        </FeedBlock>

        <FeedBlock icon={<TrendUp size={18} weight="fill" />} title="City pulse" kicker="Verified momentum, live reports, and likely surges">
          <div className="-mx-4">
            <TrendingSections
              sections={sections}
              pulses={pulses}
              userLocation={userLocation}
              onVenueClick={onVenueClick}
              isFavorite={isFavorite}
              onToggleFavorite={onToggleFavorite}
            />
          </div>
        </FeedBlock>
      </div>
    </div>
  )
}

function FeedBlock({
  icon,
  title,
  kicker,
  children,
}: {
  icon: ReactNode
  title: string
  kicker: string
  children: ReactNode
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3"
    >
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-accent">
            {icon}
            <h2 className="text-lg font-bold text-foreground">{title}</h2>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{kicker}</p>
        </div>
      </div>
      {children}
    </motion.section>
  )
}
