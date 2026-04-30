import { useEffect, useMemo, useRef } from 'react'
import { Sparkle } from '@phosphor-icons/react'
import { RecommendationCard } from './RecommendationCard'
import type { Recommendation } from '@/lib/venue-recommendations'
import type { Venue } from '@/lib/types'
import { motion } from 'framer-motion'
import type { PromotedVenue } from '@/lib/promoted-discoveries'

interface RecommendationsSectionProps {
  recommendations: Recommendation[]
  onVenueClick: (venue: Venue) => void
  promotions?: PromotedVenue[]
  onPromotionImpression?: (promotionId: string) => void
  onPromotionClick?: (promotionId: string) => void
}

export function RecommendationsSection({
  recommendations,
  onVenueClick,
  promotions = [],
  onPromotionImpression,
  onPromotionClick,
}: RecommendationsSectionProps) {
  const promotedByVenueId = useMemo(
    () => new Map(promotions.map(promo => [promo.venueId, promo.id])),
    [promotions]
  )
  const seenImpressions = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (recommendations.length === 0) return
    const visible = recommendations.slice(0, 5)
    for (const rec of visible) {
      const promoId = promotedByVenueId.get(rec.venue.id)
      if (!promoId || seenImpressions.current.has(promoId)) continue
      seenImpressions.current.add(promoId)
      onPromotionImpression?.(promoId)
    }
  }, [onPromotionImpression, recommendations, promotedByVenueId])

  if (recommendations.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card/70 p-4">
        <div className="flex items-center gap-2">
          <Sparkle size={18} weight="fill" className="text-accent" />
          <h3 className="text-sm font-bold text-foreground">Personalization warming up</h3>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Follow or favorite a few venues and Pulse will tune this list to your night.
        </p>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <Sparkle size={18} weight="fill" className="text-accent" />
        <h3 className="text-sm font-bold text-foreground">Best next moves</h3>
        <span className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-full">
          Personalized
        </span>
      </div>

      <div className="grid gap-2">
        {recommendations.slice(0, 5).map((rec) => (
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
    </motion.div>
  )
}
