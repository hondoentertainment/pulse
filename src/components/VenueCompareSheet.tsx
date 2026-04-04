import { useState, useEffect } from 'react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  ArrowRight, Clock, Users, Ticket, MusicNotes, TShirt, MapPin, Trophy, Lightning
} from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { PulseScore } from '@/components/PulseScore'
import { formatDistance } from '@/lib/units'
import { calculateDistance, getEnergyLabel } from '@/lib/pulse-engine'
import type { Venue } from '@/lib/types'
import type { VenueLiveData } from '@/lib/live-intelligence'
import { getVenueLiveData } from '@/lib/live-intelligence'

interface VenueCompareSheetProps {
  open: boolean
  onClose: () => void
  venues: Venue[]
  compareVenueIds: string[]
  userLocation: { lat: number; lng: number } | null
  unitSystem: 'imperial' | 'metric'
  onVenueClick: (venue: Venue) => void
}

interface VenueCompareData {
  venue: Venue
  liveData: VenueLiveData
  distance: number | null
}

function MetricRow({
  label,
  icon,
  values,
  bestIndex,
  formatter: _formatter,
}: {
  label: string
  icon: React.ReactNode
  values: (string | null)[]
  bestIndex: number | null
  formatter?: (v: string) => string
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className={cn('grid gap-2', values.length === 2 ? 'grid-cols-2' : 'grid-cols-3')}>
        {values.map((value, idx) => (
          <div
            key={idx}
            className={cn(
              'text-center py-2 px-3 rounded-lg border text-sm font-bold',
              bestIndex === idx
                ? 'border-primary/30 bg-primary/5 text-primary'
                : 'border-border bg-secondary/30'
            )}
          >
            {value ?? '--'}
            {bestIndex === idx && (
              <Trophy size={12} weight="fill" className="inline ml-1 text-yellow-500" />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export function VenueCompareSheet({
  open,
  onClose,
  venues,
  compareVenueIds,
  userLocation,
  unitSystem,
  onVenueClick,
}: VenueCompareSheetProps) {
  const [compareData, setCompareData] = useState<VenueCompareData[]>([])

  useEffect(() => {
    if (!open || compareVenueIds.length < 2) return

    const data: VenueCompareData[] = compareVenueIds
      .map(id => venues.find(v => v.id === id))
      .filter((v): v is Venue => v !== undefined)
      .slice(0, 3)
      .map(venue => ({
        venue,
        liveData: getVenueLiveData(venue.id),
        distance: userLocation
          ? calculateDistance(userLocation.lat, userLocation.lng, venue.location.lat, venue.location.lng)
          : null,
      }))

    setCompareData(data)
  }, [open, compareVenueIds, venues, userLocation])

  if (compareData.length < 2) return null

  // Determine "which is better right now" - simple scoring
  const scores = compareData.map((d, idx) => {
    let score = 0
    score += d.venue.pulseScore * 2 // energy matters most
    score -= (d.liveData.waitTime ?? 0) * 2 // less wait is better
    score -= (d.liveData.coverCharge ?? 0) // less cover is better
    if (d.distance !== null) score -= d.distance * 10 // closer is better
    return { idx, score }
  })
  const bestOverall = scores.sort((a, b) => b.score - a.score)[0].idx

  // Find best for individual metrics
  const bestPulse = compareData.reduce<number | null>((best, d, idx) =>
    best === null || d.venue.pulseScore > compareData[best].venue.pulseScore ? idx : best, null)
  const bestWait = compareData.reduce<number | null>((best, d, idx) => {
    if (d.liveData.waitTime === null) return best
    if (best === null) return idx
    return (d.liveData.waitTime ?? Infinity) < (compareData[best].liveData.waitTime ?? Infinity) ? idx : best
  }, null)
  const bestCover = compareData.reduce<number | null>((best, d, idx) => {
    const cover = d.liveData.coverCharge
    if (best === null) return idx
    const bestCoverVal = compareData[best].liveData.coverCharge
    if (cover === null) return idx // free is best
    if (bestCoverVal === null) return best
    return cover < bestCoverVal ? idx : best
  }, null)
  const bestDistance = compareData.reduce<number | null>((best, d, idx) => {
    if (d.distance === null) return best
    if (best === null) return idx
    return (d.distance ?? Infinity) < (compareData[best].distance ?? Infinity) ? idx : best
  }, null)

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="bottom" className="rounded-t-3xl border-t-accent/20 bg-card max-h-[90vh] overflow-y-auto">
        <SheetHeader className="pb-2">
          <div className="mx-auto w-12 h-1.5 rounded-full bg-muted/30 mb-2" />
          <SheetTitle className="text-xl font-bold">Compare Venues</SheetTitle>
          <SheetDescription className="text-sm">Side-by-side live metrics</SheetDescription>
        </SheetHeader>

        {/* Venue Headers */}
        <div className={cn('grid gap-2 mb-4', compareData.length === 2 ? 'grid-cols-2' : 'grid-cols-3')}>
          {compareData.map((d, idx) => (
            <motion.div
              key={d.venue.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
            >
              <Card
                className={cn(
                  'p-3 text-center cursor-pointer hover:border-primary/30 transition-colors',
                  bestOverall === idx && 'border-primary/30 bg-primary/5'
                )}
                onClick={() => { onClose(); onVenueClick(d.venue) }}
              >
                <p className="text-sm font-bold truncate">{d.venue.name}</p>
                <div className="flex items-center justify-center gap-1 mt-1">
                  <PulseScore score={d.venue.pulseScore} size="sm" showLabel={false} />
                  {bestOverall === idx && (
                    <Badge className="bg-primary/10 text-primary text-[10px]">Best pick</Badge>
                  )}
                </div>
                {d.venue.category && (
                  <p className="text-[10px] text-muted-foreground uppercase font-mono mt-1">
                    {d.venue.category}
                  </p>
                )}
              </Card>
            </motion.div>
          ))}
        </div>

        <Separator className="mb-4" />

        {/* Metrics Comparison */}
        <div className="space-y-4 pb-6">
          {/* Energy */}
          <MetricRow
            label="Energy"
            icon={<Lightning size={14} weight="fill" className="text-yellow-500" />}
            values={compareData.map(d => getEnergyLabel(d.venue.pulseScore))}
            bestIndex={bestPulse}
          />

          {/* Wait Time */}
          <MetricRow
            label="Wait Time"
            icon={<Clock size={14} weight="fill" className="text-orange-400" />}
            values={compareData.map(d =>
              d.liveData.waitTime !== null
                ? d.liveData.waitTime === 0 ? 'No wait' : `~${d.liveData.waitTime} min`
                : null
            )}
            bestIndex={bestWait}
          />

          {/* Cover */}
          <MetricRow
            label="Cover Charge"
            icon={<Ticket size={14} weight="fill" className="text-green-400" />}
            values={compareData.map(d =>
              d.liveData.coverCharge !== null
                ? `$${d.liveData.coverCharge}`
                : d.liveData.coverChargeNote || 'Free'
            )}
            bestIndex={bestCover}
          />

          {/* Crowd */}
          <MetricRow
            label="Crowd Level"
            icon={<Users size={14} weight="fill" className="text-blue-400" />}
            values={compareData.map(d =>
              d.liveData.crowdLevel > 0 ? `${d.liveData.crowdLevel}%` : null
            )}
            bestIndex={null} // crowd preference is subjective
          />

          {/* Music */}
          <MetricRow
            label="Music"
            icon={<MusicNotes size={14} weight="fill" className="text-purple-400" />}
            values={compareData.map(d =>
              d.liveData.nowPlaying
                ? `${d.liveData.nowPlaying.track}`
                : d.liveData.musicGenre || null
            )}
            bestIndex={null}
          />

          {/* Dress Code */}
          <MetricRow
            label="Dress Code"
            icon={<TShirt size={14} weight="fill" className="text-pink-400" />}
            values={compareData.map(d =>
              d.liveData.dressCode
                ? d.liveData.dressCode.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase())
                : null
            )}
            bestIndex={null}
          />

          {/* Distance */}
          {userLocation && (
            <MetricRow
              label="Distance"
              icon={<MapPin size={14} weight="fill" className="text-accent" />}
              values={compareData.map(d =>
                d.distance !== null ? formatDistance(d.distance, unitSystem) : null
              )}
              bestIndex={bestDistance}
            />
          )}
        </div>

        {/* Quick navigate buttons */}
        <div className={cn('grid gap-2 pb-4', compareData.length === 2 ? 'grid-cols-2' : 'grid-cols-3')}>
          {compareData.map(d => (
            <Button
              key={d.venue.id}
              variant="outline"
              size="sm"
              onClick={() => { onClose(); onVenueClick(d.venue) }}
            >
              <ArrowRight size={14} className="mr-1" />
              Go to {d.venue.name.split(' ')[0]}
            </Button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}
