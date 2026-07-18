import { memo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { MapPin, NavigationArrow, BookmarkSimple, ShareNetwork } from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getEnergyColor, getEnergyLabel } from '@/lib/pulse-engine'
import { buildLiveReviewProof, getLatestVenuePulsePhoto } from '@/lib/live-reviews'
import type { TonightPick } from '@/lib/tonight-feed'
import type { Pulse } from '@/lib/types'
import { cn } from '@/lib/utils'

interface TonightRecommendationCardProps {
  pick: TonightPick
  pulses?: Pulse[]
  isSaved?: boolean
  onGo: () => void
  onDirections: () => void
  onSave: () => void
  onShare?: () => void
  onExpand?: () => void
}

const WORTH_LABELS = {
  yes: { text: 'Worth going', className: 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10' },
  maybe: { text: 'Maybe', className: 'border-amber-500/40 text-amber-300 bg-amber-500/10' },
  caution: { text: 'Caution', className: 'border-orange-500/40 text-orange-300 bg-orange-500/10' },
  unknown: { text: 'No live reviews', className: 'border-muted-foreground/40 text-muted-foreground bg-muted/30' },
} as const

export const TonightRecommendationCard = memo(function TonightRecommendationCard({
  pick,
  pulses = [],
  isSaved = false,
  onGo,
  onDirections,
  onSave,
  onShare,
  onExpand,
}: TonightRecommendationCardProps) {
  const reduceMotion = useReducedMotion()
  const { venue } = pick.recommendation
  const energy = getEnergyLabel(venue.pulseScore)
  const color = getEnergyColor(venue.pulseScore)
  const worth = WORTH_LABELS[pick.explanation.worthGoing]
  const photo = getLatestVenuePulsePhoto(venue.id, pulses)
  const proof = buildLiveReviewProof(venue, pulses)

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={reduceMotion ? undefined : { y: -2 }}
      whileTap={reduceMotion ? undefined : { scale: 0.99 }}
      transition={{ duration: 0.28 }}
    >
      <article
        className="overflow-hidden rounded-2xl border border-border bg-card/95 shadow-lg shadow-black/20"
        data-testid="tonight-pick-card"
      >
        <button
          type="button"
          className="relative block w-full aspect-[16/10] overflow-hidden text-left touch-manipulation"
          onClick={onGo}
          aria-label={`Open ${venue.name}`}
        >
          {photo ? (
            <img
              src={photo}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div
              className="absolute inset-0"
              style={{
                background: `radial-gradient(circle at 30% 20%, ${color}55, transparent 55%), linear-gradient(160deg, ${color}33, oklch(0.18 0.04 300))`,
              }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/10" />

          <div className="absolute inset-x-0 bottom-0 p-4 space-y-2">
            <div className="flex items-end justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-lg font-bold text-white tracking-tight">{venue.name}</h3>
                  {pick.isSponsored && (
                    <Badge variant="outline" className="shrink-0 border-white/30 text-[10px] uppercase tracking-wide text-white/90">
                      Sponsored
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-white/70 truncate">
                  {venue.category}
                  {venue.city ? ` · ${venue.city}` : ''}
                  {pick.distanceMiles !== null ? ` · ${pick.distanceMiles.toFixed(1)} mi` : ''}
                </p>
              </div>
              <span
                className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold"
                style={{ color, backgroundColor: `${color}30` }}
              >
                {energy}
              </span>
            </div>
          </div>
        </button>

        <div className="space-y-3 p-4">
          <p className="text-sm font-medium leading-snug">{pick.explanation.headline}</p>

          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className={cn('text-[10px]', worth.className)}>
              {worth.text}
            </Badge>
            <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
              {proof.proofChip}
            </Badge>
          </div>

          {pick.explanation.frictionNotes.length > 0 && (
            <button
              type="button"
              className="text-left text-xs text-muted-foreground underline-offset-2 hover:underline min-h-9"
              onClick={onExpand}
            >
              {pick.explanation.frictionNotes.join(' · ')}
            </button>
          )}

          <div className="flex flex-wrap gap-2 pt-0.5">
            <Button size="sm" className="min-h-11 touch-manipulation" data-testid="tonight-go" onClick={onGo}>
              Go
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="min-h-11 gap-1 touch-manipulation"
              onClick={onDirections}
            >
              <NavigationArrow size={14} weight="bold" />
              Directions
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="min-h-11 gap-1 touch-manipulation"
              aria-pressed={isSaved}
              aria-label={isSaved ? 'Remove from shortlist' : 'Save to shortlist'}
              onClick={onSave}
            >
              <BookmarkSimple size={14} weight={isSaved ? 'fill' : 'regular'} />
              {isSaved ? 'Saved' : 'Save'}
            </Button>
            {onShare && (
              <Button
                size="sm"
                variant="ghost"
                className="min-h-11 gap-1 touch-manipulation"
                aria-label="Share venue"
                onClick={onShare}
              >
                <ShareNetwork size={14} />
              </Button>
            )}
            {pick.distanceMiles !== null && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground ml-auto self-center">
                <MapPin size={12} />
                {pick.distanceMiles.toFixed(1)} mi
              </span>
            )}
          </div>
        </div>
      </article>
    </motion.div>
  )
})
