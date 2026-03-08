import { Sparkle } from '@phosphor-icons/react'
import { RecommendationCard } from './RecommendationCard'
import type { Recommendation } from '@/lib/venue-recommendations'
import type { Venue } from '@/lib/types'
import { motion } from 'framer-motion'

interface RecommendationsSectionProps {
  recommendations: Recommendation[]
  onVenueClick: (venue: Venue) => void
}

export function RecommendationsSection({ recommendations, onVenueClick }: RecommendationsSectionProps) {
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
        {recommendations.slice(0, 5).map((rec) => (
          <RecommendationCard
            key={rec.venue.id}
            recommendation={rec}
            onClick={() => onVenueClick(rec.venue)}
          />
        ))}
      </div>
    </motion.div>
  )
}
