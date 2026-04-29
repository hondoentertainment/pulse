import type { Recommendation } from '@/lib/venue-recommendations'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Sparkle, Users, Clock, TrendUp, Compass, MapPin, Broadcast } from '@phosphor-icons/react'
import { getEnergyLabel, getEnergyColor } from '@/lib/pulse-engine'
import { motion } from 'framer-motion'

interface RecommendationCardProps {
  recommendation: Recommendation
  isSponsored?: boolean
  onClick: () => void
}

const REASON_ICONS: Record<string, typeof Sparkle> = {
  category_match: Sparkle,
  time_appropriate: Clock,
  friend_activity: Users,
  trending: TrendUp,
  new_discovery: Compass,
  nearby: MapPin,
  live_intel: Broadcast,
}

export function RecommendationCard({ recommendation, isSponsored = false, onClick }: RecommendationCardProps) {
  const { venue, reasons } = recommendation
  const label = getEnergyLabel(venue.pulseScore)
  const color = getEnergyColor(venue.pulseScore)

  // Show top 2 reasons
  const topReasons = reasons.slice(0, 2)

  return (
    <motion.div
      whileHover={{ y: -2, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
    >
      <Card
        className="p-3 bg-card/80 border-border hover:border-accent/40 cursor-pointer transition-colors"
        onClick={onClick}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-foreground truncate">{venue.name}</p>
            <p className="text-xs text-muted-foreground truncate">
              {venue.category}{venue.city ? ` · ${venue.city}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {isSponsored && (
              <Badge variant="outline" className="text-[10px] border-yellow-500/40 text-yellow-500">
                Sponsored
              </Badge>
            )}
            <Badge
              variant="outline"
              className="text-[10px] shrink-0 border-0 font-bold"
              style={{ color, backgroundColor: `${color}20` }}
            >
              {label}
            </Badge>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 mt-2">
          {topReasons.map((reason, i) => {
            const Icon = REASON_ICONS[reason.type] ?? Sparkle
            return (
              <span
                key={i}
                className="inline-flex items-center gap-1 text-[10px] text-accent bg-accent/10 px-1.5 py-0.5 rounded-md"
              >
                <Icon size={10} weight="fill" />
                {reason.label}
              </span>
            )
          })}
        </div>
      </Card>
    </motion.div>
  )
}
