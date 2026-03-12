import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Clock, Users, MusicNotes, Ticket, TShirt, ChartBar,
  ArrowsClockwise, PencilSimple
} from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { formatTimeAgo } from '@/lib/pulse-engine'
import type { VenueLiveData, ConfidenceLevel } from '@/lib/live-intelligence'

interface VenueLivePanelProps {
  liveData: VenueLiveData
  onReport: () => void
  onRefresh?: () => void
}

function ConfidenceBadge({ level }: { level: ConfidenceLevel }) {
  const config = {
    low: { label: 'Low', className: 'bg-muted text-muted-foreground border-border' },
    medium: { label: 'Med', className: 'bg-accent/10 text-accent border-accent/20' },
    high: { label: 'High', className: 'bg-green-500/10 text-green-400 border-green-500/20' },
  }
  const c = config[level]
  return (
    <span className={cn('text-[9px] font-mono uppercase px-1.5 py-0.5 rounded-md border', c.className)}>
      {c.label}
    </span>
  )
}

function CrowdBar({ percentFull }: { percentFull: number }) {
  const getColor = (pct: number) => {
    if (pct >= 90) return 'bg-red-500'
    if (pct >= 70) return 'bg-orange-500'
    if (pct >= 50) return 'bg-yellow-500'
    if (pct >= 30) return 'bg-green-500'
    return 'bg-blue-500'
  }

  return (
    <div className="w-full">
      <div className="relative h-2.5 bg-muted rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentFull}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className={cn('h-full rounded-full', getColor(percentFull))}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-muted-foreground">Empty</span>
        <span className="text-[10px] text-muted-foreground">Packed</span>
      </div>
    </div>
  )
}

export function VenueLivePanel({ liveData, onReport, onRefresh }: VenueLivePanelProps) {
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = () => {
    if (onRefresh) {
      setIsRefreshing(true)
      onRefresh()
      setTimeout(() => setIsRefreshing(false), 1000)
    }
  }

  const hasAnyData =
    liveData.waitTime !== null ||
    liveData.coverCharge !== null ||
    liveData.nowPlaying !== null ||
    liveData.crowdLevel > 0 ||
    liveData.dressCode !== null ||
    liveData.ageRange !== null

  if (!hasAnyData) {
    return (
      <Card className="p-4 bg-card border-border">
        <div className="text-center space-y-3">
          <p className="text-sm text-muted-foreground">No live intel yet</p>
          <Button size="sm" variant="outline" onClick={onReport}>
            <PencilSimple size={16} className="mr-2" />
            Be first to report
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <Card className="bg-card border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <h3 className="text-sm font-bold uppercase tracking-wide">Live Intel</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground font-mono">
            {formatTimeAgo(liveData.lastUpdated)}
          </span>
          {onRefresh && (
            <button
              onClick={handleRefresh}
              className="p-1 rounded hover:bg-secondary transition-colors"
            >
              <ArrowsClockwise
                size={14}
                className={cn(
                  'text-muted-foreground transition-transform',
                  isRefreshing && 'animate-spin'
                )}
              />
            </button>
          )}
        </div>
      </div>

      <div className="px-4 pb-4 space-y-3">
        {/* Wait Time */}
        {liveData.waitTime !== null && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock size={16} weight="fill" className="text-orange-400" />
              <span className="text-sm">Wait</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold">
                {liveData.waitTime === 0 ? 'No wait' : `~${liveData.waitTime} min`}
              </span>
              <ConfidenceBadge level={liveData.confidence.waitTime} />
            </div>
          </div>
        )}

        {/* Cover Charge */}
        {liveData.coverCharge !== null || liveData.coverChargeNote ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Ticket size={16} weight="fill" className="text-green-400" />
              <span className="text-sm">Cover</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold">
                {liveData.coverCharge === null
                  ? liveData.coverChargeNote || 'Free'
                  : `$${liveData.coverCharge}`}
              </span>
              <ConfidenceBadge level={liveData.confidence.coverCharge} />
            </div>
          </div>
        ) : null}

        {/* Now Playing */}
        {liveData.nowPlaying && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
              >
                <MusicNotes size={16} weight="fill" className="text-purple-400" />
              </motion.div>
              <span className="text-sm">Playing</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold truncate max-w-[160px]">
                {liveData.nowPlaying.track} - {liveData.nowPlaying.artist}
              </span>
              <ConfidenceBadge level={liveData.confidence.nowPlaying} />
            </div>
          </div>
        )}

        {/* Crowd Level */}
        {liveData.crowdLevel > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users size={16} weight="fill" className="text-blue-400" />
                <span className="text-sm">Crowd</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold">{liveData.crowdLevel}% full</span>
                <ConfidenceBadge level={liveData.confidence.crowdLevel} />
              </div>
            </div>
            <CrowdBar percentFull={liveData.crowdLevel} />
          </div>
        )}

        {/* Dress Code */}
        {liveData.dressCode && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TShirt size={16} weight="fill" className="text-pink-400" />
              <span className="text-sm">Dress Code</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold capitalize">{liveData.dressCode.replace('-', ' ')}</span>
              <ConfidenceBadge level={liveData.confidence.dressCode} />
            </div>
          </div>
        )}

        {/* Age Range */}
        {liveData.ageRange && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ChartBar size={16} weight="fill" className="text-cyan-400" />
              <span className="text-sm">Age Range</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold">
                {liveData.ageRange.min}-{liveData.ageRange.max}
              </span>
              <ConfidenceBadge level={liveData.confidence.ageRange} />
            </div>
          </div>
        )}

        {/* Music Genre */}
        {liveData.musicGenre && !liveData.nowPlaying && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MusicNotes size={16} weight="fill" className="text-purple-400" />
              <span className="text-sm">Music</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold">{liveData.musicGenre}</span>
              <ConfidenceBadge level={liveData.confidence.musicGenre} />
            </div>
          </div>
        )}

        {/* Report Button */}
        <Button
          variant="outline"
          size="sm"
          className="w-full mt-2 border-primary/20 text-primary hover:bg-primary/10"
          onClick={onReport}
        >
          <PencilSimple size={16} className="mr-2" />
          Report What You See
        </Button>
      </div>
    </Card>
  )
}
