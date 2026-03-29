import { useEffect, useMemo, useRef, useState } from 'react'
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
  maxItems?: number
}

export function RecommendationsSection({
  recommendations,
  onVenueClick,
  promotions = [],
  onPromotionImpression,
  onPromotionClick,
  maxItems,
}: RecommendationsSectionProps) {
  const [showAll, setShowAll] = useState(false)
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

  if (recommendations.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <Sparkle size={18} weight="fill" className="text-accent" />
        <h3 className="text-sm font-bold text-foreground">You Might Like</h3>
        <span className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-full">
          Personalized
        </span>
      </div>

      <div className="grid gap-2">
        {recommendations.slice(0, !showAll && maxItems ? maxItems : 5).map((rec) => (
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
      {maxItems && !showAll && recommendations.length > maxItems && (
        <button
          onClick={() => setShowAll(true)}
          className="w-full text-center py-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
        >
          See more
        </button>
      )}
    </motion.div>
  )
}
