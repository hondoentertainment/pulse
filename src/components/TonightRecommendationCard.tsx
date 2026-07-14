import { memo } from 'react'
import { motion } from 'framer-motion'
import { MapPin, NavigationArrow, BookmarkSimple, ShareNetwork } from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getEnergyColor, getEnergyLabel } from '@/lib/pulse-engine'
import type { TonightPick } from '@/lib/tonight-feed'

interface TonightRecommendationCardProps {
  pick: TonightPick
  isSaved?: boolean
  onGo: () => void
  onDirections: () => void
  onSave: () => void
  onShare?: () => void
  onExpand?: () => void
}

const WORTH_LABELS = {
  yes: { text: 'Worth going', className: 'border-green-500/40 text-green-400' },
  maybe: { text: 'Maybe — check details', className: 'border-yellow-500/40 text-yellow-400' },
  caution: { text: 'Proceed with caution', className: 'border-orange-500/40 text-orange-400' },
  unknown: { text: 'No live signal', className: 'border-muted-foreground/40 text-muted-foreground' },
} as const

export const TonightRecommendationCard = memo(function TonightRecommendationCard({
  pick,
  isSaved = false,
  onGo,
  onDirections,
  onSave,
  onShare,
  onExpand,
}: TonightRecommendationCardProps) {
  const { venue } = pick.recommendation
  const energy = getEnergyLabel(venue.pulseScore)
  const color = getEnergyColor(venue.pulseScore)
  const worth = WORTH_LABELS[pick.explanation.worthGoing]

  return (
    <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.99 }}>
      <Card className="p-4 bg-card/90 border-border space-y-3" data-testid="tonight-pick-card">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="font-bold text-base truncate">{venue.name}</p>
              {pick.isSponsored && (
                <Badge variant="outline" className="shrink-0 text-[10px] uppercase tracking-wide">
                  Sponsored
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {venue.category}
              {venue.city ? ` · ${venue.city}` : ''}
            </p>
          </div>
          <Badge
            variant="outline"
            className="shrink-0 border-0 font-bold text-[11px]"
            style={{ color, backgroundColor: `${color}20` }}
          >
            {energy}
          </Badge>
        </div>

        <p className="text-sm font-medium leading-snug">{pick.explanation.headline}</p>
        <p className="text-sm text-muted-foreground leading-relaxed">{pick.explanation.explanation}</p>

        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className={`text-[10px] ${worth.className}`}>
            {worth.text}
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            {pick.explanation.confidenceLabel}
          </Badge>
        </div>

        {pick.explanation.frictionNotes.length > 0 && (
          <button
            type="button"
            className="text-left text-xs text-muted-foreground underline-offset-2 hover:underline"
            onClick={onExpand}
          >
            {pick.explanation.frictionNotes.join(' · ')}
          </button>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" className="min-h-9" data-testid="tonight-go" onClick={onGo}>
            Go
          </Button>
          <Button size="sm" variant="secondary" className="min-h-9 gap-1" onClick={onDirections}>
            <NavigationArrow size={14} weight="bold" />
            Directions
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="min-h-9 gap-1"
            aria-pressed={isSaved}
            onClick={onSave}
          >
            <BookmarkSimple size={14} weight={isSaved ? 'fill' : 'regular'} />
            {isSaved ? 'Saved' : 'Save'}
          </Button>
          {onShare && (
            <Button size="sm" variant="ghost" className="min-h-9 gap-1" onClick={onShare}>
              <ShareNetwork size={14} />
              Share
            </Button>
          )}
          {pick.distanceMiles !== null && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground ml-auto self-center">
              <MapPin size={12} />
              {pick.distanceMiles.toFixed(1)} mi
            </span>
          )}
        </div>
      </Card>
    </motion.div>
  )
})
