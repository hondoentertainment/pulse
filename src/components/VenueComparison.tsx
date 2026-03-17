import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  ArrowsLeftRight,
  Lightning,
  MapPin,
  Users,
  CurrencyDollar,
  Clock,
  TrendUp,
  TrendDown,
  Minus,
  Trophy,
  Sparkle,
  MusicNotes,
  Martini,
  Coffee,
  ForkKnife,
} from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { getEnergyColor } from '@/lib/pulse-engine'
import {
  getComparisonVerdict,
  getWinner,
  type VenueComparisonResult,
  type ComparisonPreference,
  type MetricWinner,
  type TrendDirection,
} from '@/lib/venue-comparison'
import type { Venue } from '@/lib/types'

// --- Sub-components ---

function CategoryIcon({ category }: { category: string }) {
  const cat = category.toLowerCase()
  if (cat.includes('club') || cat.includes('dance') || cat.includes('lounge'))
    return <Martini size={16} weight="fill" />
  if (cat.includes('music') || cat.includes('concert'))
    return <MusicNotes size={16} weight="fill" />
  if (cat.includes('cafe') || cat.includes('coffee'))
    return <Coffee size={16} weight="fill" />
  if (cat.includes('restaurant') || cat.includes('food') || cat.includes('grill'))
    return <ForkKnife size={16} weight="fill" />
  return <Sparkle size={16} weight="fill" />
}

function TrendingArrow({ direction }: { direction: TrendDirection }) {
  if (direction === 'up')
    return <TrendUp size={14} weight="bold" className="text-green-400" />
  if (direction === 'down')
    return <TrendDown size={14} weight="bold" className="text-red-400" />
  return <Minus size={12} className="text-muted-foreground" />
}

function ScoreBadge({ score }: { score: number }) {
  const color = getEnergyColor(score)
  return (
    <div
      className="inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-sm font-bold text-white"
      style={{ backgroundColor: color }}
    >
      {score}
    </div>
  )
}

function ComparisonBar({
  winner,
  label,
  valueA,
  valueB,
  icon,
  index,
}: {
  winner: MetricWinner
  label: string
  valueA: string
  valueB: string
  icon: React.ReactNode
  index: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 + index * 0.08 }}
      className="grid grid-cols-[1fr_auto_1fr] items-center gap-2"
    >
      {/* Value A */}
      <div
        className={cn(
          'text-right text-sm font-medium px-2 py-1.5 rounded-lg',
          winner === 'a'
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground'
        )}
      >
        {valueA}
        {winner === 'a' && (
          <Trophy
            size={10}
            weight="fill"
            className="inline ml-1 text-yellow-500"
          />
        )}
      </div>

      {/* Label */}
      <div className="flex flex-col items-center gap-0.5 min-w-[72px]">
        <div className="text-muted-foreground">{icon}</div>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
          {label}
        </span>
      </div>

      {/* Value B */}
      <div
        className={cn(
          'text-left text-sm font-medium px-2 py-1.5 rounded-lg',
          winner === 'b'
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground'
        )}
      >
        {winner === 'b' && (
          <Trophy
            size={10}
            weight="fill"
            className="inline mr-1 text-yellow-500"
          />
        )}
        {valueB}
      </div>
    </motion.div>
  )
}

function VenueCard({
  venue,
  energyLabel,
  trending,
  category,
  side,
  isWinner,
  onRemove,
}: {
  venue: Venue
  energyLabel: string
  trending: TrendDirection
  category: string
  side: 'left' | 'right'
  isWinner: boolean
  onRemove: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: side === 'left' ? -40 : 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: side === 'left' ? -40 : 40 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
    >
      <Card
        className={cn(
          'relative p-3 text-center',
          isWinner && 'border-primary/40 bg-primary/5'
        )}
      >
        <button
          onClick={onRemove}
          className="absolute top-1.5 right-1.5 p-0.5 rounded-full hover:bg-muted/50 text-muted-foreground"
          aria-label={`Remove ${venue.name}`}
        >
          <X size={12} />
        </button>

        <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
          <CategoryIcon category={category} />
          <span className="text-[10px] uppercase tracking-wider font-mono">
            {category}
          </span>
        </div>

        <p className="text-sm font-bold truncate">{venue.name}</p>

        <div className="flex items-center justify-center gap-2 mt-1.5">
          <ScoreBadge score={venue.pulseScore} />
          <TrendingArrow direction={trending} />
        </div>

        {isWinner && (
          <Badge className="mt-1.5 bg-primary/10 text-primary text-[10px]">
            Best pick
          </Badge>
        )}
      </Card>
    </motion.div>
  )
}

function EmptySlot({ label }: { label: string }) {
  return (
    <Card className="p-6 text-center border-dashed border-muted-foreground/30">
      <p className="text-sm text-muted-foreground">{label}</p>
    </Card>
  )
}

// --- Props ---

interface VenueComparisonProps {
  selectedVenues: [Venue | null, Venue | null]
  comparisonResult: VenueComparisonResult | null
  onRemoveVenue: (index: 0 | 1) => void
  onSwapVenues: () => void
  onClear: () => void
}

// --- Main Component ---

export function VenueComparison({
  selectedVenues,
  comparisonResult,
  onRemoveVenue,
  onSwapVenues,
  onClear,
}: VenueComparisonProps) {
  const [pickForMe, setPickForMe] = useState<ComparisonPreference | null>(null)
  const [venueA, venueB] = selectedVenues

  // Empty state
  if (!venueA && !venueB) {
    return (
      <div
        data-testid="comparison-empty"
        className="text-center py-8 text-muted-foreground"
      >
        <ArrowsLeftRight size={32} className="mx-auto mb-2 opacity-40" />
        <p className="text-sm">Select two venues to compare</p>
      </div>
    )
  }

  const pickedWinner =
    pickForMe && comparisonResult
      ? getWinner(comparisonResult, pickForMe)
      : null

  return (
    <div data-testid="venue-comparison" className="space-y-4">
      {/* Header with controls */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Compare
        </h3>
        <div className="flex items-center gap-1">
          {venueA && venueB && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onSwapVenues}
              aria-label="Swap venues"
              className="h-7 w-7 p-0"
            >
              <ArrowsLeftRight size={14} />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            aria-label="Clear comparison"
            className="h-7 w-7 p-0"
          >
            <X size={14} />
          </Button>
        </div>
      </div>

      {/* Venue cards */}
      <div className="grid grid-cols-2 gap-3 max-[360px]:grid-cols-1">
        <AnimatePresence mode="wait">
          {venueA && comparisonResult ? (
            <VenueCard
              key={venueA.id}
              venue={venueA}
              energyLabel={comparisonResult.venueA.energyLabel}
              trending={comparisonResult.venueA.trending}
              category={comparisonResult.venueA.category}
              side="left"
              isWinner={pickedWinner === 'a'}
              onRemove={() => onRemoveVenue(0)}
            />
          ) : venueA ? (
            <VenueCard
              key={venueA.id}
              venue={venueA}
              energyLabel=""
              trending="stable"
              category={venueA.category ?? 'Venue'}
              side="left"
              isWinner={false}
              onRemove={() => onRemoveVenue(0)}
            />
          ) : (
            <EmptySlot label="Pick venue 1" />
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {venueB && comparisonResult ? (
            <VenueCard
              key={venueB.id}
              venue={venueB}
              energyLabel={comparisonResult.venueB.energyLabel}
              trending={comparisonResult.venueB.trending}
              category={comparisonResult.venueB.category}
              side="right"
              isWinner={pickedWinner === 'b'}
              onRemove={() => onRemoveVenue(1)}
            />
          ) : venueB ? (
            <VenueCard
              key={venueB.id}
              venue={venueB}
              energyLabel=""
              trending="stable"
              category={venueB.category ?? 'Venue'}
              side="right"
              isWinner={false}
              onRemove={() => onRemoveVenue(1)}
            />
          ) : (
            <EmptySlot label="Pick venue 2" />
          )}
        </AnimatePresence>
      </div>

      {/* Comparison metrics */}
      {comparisonResult && (
        <>
          <Separator />

          <div className="space-y-2">
            <ComparisonBar
              winner={comparisonResult.metrics.energy.winner}
              label="Energy"
              valueA={comparisonResult.venueA.energyLabel}
              valueB={comparisonResult.venueB.energyLabel}
              icon={<Lightning size={14} weight="fill" className="text-yellow-500" />}
              index={0}
            />
            {comparisonResult.venueA.distance !== null &&
              comparisonResult.venueB.distance !== null && (
                <ComparisonBar
                  winner={comparisonResult.metrics.distance.winner}
                  label="Distance"
                  valueA={`${comparisonResult.venueA.distance.toFixed(1)} mi`}
                  valueB={`${comparisonResult.venueB.distance.toFixed(1)} mi`}
                  icon={<MapPin size={14} weight="fill" className="text-accent" />}
                  index={1}
                />
              )}
            <ComparisonBar
              winner={comparisonResult.metrics.crowd.winner}
              label="Crowd"
              valueA={comparisonResult.venueA.crowdVibeTags.join(', ')}
              valueB={comparisonResult.venueB.crowdVibeTags.join(', ')}
              icon={<Users size={14} weight="fill" className="text-blue-400" />}
              index={2}
            />
            <ComparisonBar
              winner={comparisonResult.metrics.friends.winner}
              label="Friends"
              valueA={String(comparisonResult.venueA.friendsPresentCount)}
              valueB={String(comparisonResult.venueB.friendsPresentCount)}
              icon={<Users size={14} weight="fill" className="text-pink-400" />}
              index={3}
            />
            <ComparisonBar
              winner={comparisonResult.metrics.price.winner}
              label="Price"
              valueA={'$'.repeat(comparisonResult.venueA.priceLevel)}
              valueB={'$'.repeat(comparisonResult.venueB.priceLevel)}
              icon={<CurrencyDollar size={14} weight="fill" className="text-green-400" />}
              index={4}
            />
            <ComparisonBar
              winner={comparisonResult.metrics.wait.winner}
              label="Wait"
              valueA={
                comparisonResult.venueA.estimatedWait !== null
                  ? comparisonResult.venueA.estimatedWait === 0
                    ? 'No wait'
                    : `~${comparisonResult.venueA.estimatedWait} min`
                  : '--'
              }
              valueB={
                comparisonResult.venueB.estimatedWait !== null
                  ? comparisonResult.venueB.estimatedWait === 0
                    ? 'No wait'
                    : `~${comparisonResult.venueB.estimatedWait} min`
                  : '--'
              }
              icon={<Clock size={14} weight="fill" className="text-orange-400" />}
              index={5}
            />
          </div>

          <Separator />

          {/* Verdict */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="text-center"
          >
            <p
              data-testid="comparison-verdict"
              className="text-sm text-muted-foreground italic"
            >
              {getComparisonVerdict(comparisonResult)}
            </p>
          </motion.div>

          {/* Pick for me */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="space-y-2"
          >
            <p className="text-xs text-muted-foreground text-center uppercase tracking-wider">
              Pick for me by:
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {(
                [
                  { key: 'energy', label: 'Energy', icon: <Lightning size={12} weight="fill" /> },
                  { key: 'proximity', label: 'Closest', icon: <MapPin size={12} weight="fill" /> },
                  { key: 'social', label: 'Friends', icon: <Users size={12} weight="fill" /> },
                  { key: 'price', label: 'Cheapest', icon: <CurrencyDollar size={12} weight="fill" /> },
                ] as const
              ).map(({ key, label, icon }) => (
                <Button
                  key={key}
                  variant={pickForMe === key ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() =>
                    setPickForMe((prev) =>
                      prev === key ? null : key
                    )
                  }
                  data-testid={`pick-${key}`}
                >
                  {icon}
                  {label}
                </Button>
              ))}
            </div>

            {pickForMe && pickedWinner && pickedWinner !== 'tie' && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                data-testid="pick-result"
                className="text-center text-sm font-bold text-primary"
              >
                Go to{' '}
                {pickedWinner === 'a'
                  ? comparisonResult.venueA.venue.name
                  : comparisonResult.venueB.venue.name}
                !
              </motion.p>
            )}
            {pickForMe && pickedWinner === 'tie' && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                data-testid="pick-result"
                className="text-center text-sm font-medium text-muted-foreground"
              >
                It&apos;s a tie! Both are great picks.
              </motion.p>
            )}
          </motion.div>
        </>
      )}
    </div>
  )
}
