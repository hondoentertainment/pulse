import { useState, type ReactNode } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Clock, Users, MusicNotes, Ticket, TShirt, ChartBar,
  ArrowsClockwise, PencilSimple
} from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { formatTimeAgo } from '@/lib/pulse-engine'
import type { VenueLiveData, ConfidenceLevel, SignalConfidenceDetail } from '@/lib/live-intelligence'

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
  const signalDetails = Object.values(liveData.confidenceDetails)
  const ownerConfirmedCount = signalDetails.filter(detail => detail.operatorVerified).length
  const guestReportCount = signalDetails.filter(detail => detail.reportCount > 0).length
  const trustSummary = ownerConfirmedCount > 0
    ? `${ownerConfirmedCount} owner-confirmed update${ownerConfirmedCount === 1 ? '' : 's'} live now`
    : guestReportCount > 0
      ? `${guestReportCount} guest-reported signal${guestReportCount === 1 ? '' : 's'} in the last 30 min`
      : 'Early live intel - add a report to strengthen trust'

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
      <div className="px-4 pb-1">
        <p className="text-[11px] text-muted-foreground">{trustSummary}</p>
      </div>

      <div className="px-4 pb-4 space-y-3">
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users size={16} weight="fill" className="text-primary" />
              <span className="text-sm font-semibold">Door Mode</span>
            </div>
            <span className="text-xs font-mono text-primary">
              {liveData.doorMode.entryConfidence}% confidence
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium capitalize">
              {liveData.doorMode.lineStatus.replace(/-/g, ' ')}
            </span>
            {liveData.doorMode.guestListStatus && (
              <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium capitalize">
                Guest list {liveData.doorMode.guestListStatus}
              </span>
            )}
            {liveData.doorMode.tableMinimum !== null && (
              <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium">
                Tables from ${liveData.doorMode.tableMinimum}
              </span>
            )}
          </div>
          {liveData.doorMode.reasons.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {liveData.doorMode.reasons.slice(0, 2).join(' • ')}
            </p>
          )}
          {(liveData.operatorNote || liveData.special || liveData.djStatus) && (
            <div className="rounded-lg bg-background/70 px-3 py-2 text-xs text-muted-foreground">
              {liveData.special && <p>{liveData.special}</p>}
              {liveData.djStatus && <p>{liveData.djStatus}</p>}
              {liveData.operatorNote && <p>{liveData.operatorNote}</p>}
            </div>
          )}
        </div>

        {/* Wait Time */}
        {liveData.waitTime !== null && (
          <SignalRow
            icon={<Clock size={16} weight="fill" className="text-orange-400" />}
            label="Wait"
            value={liveData.waitTime === 0 ? 'No wait' : `~${liveData.waitTime} min`}
            level={liveData.confidence.waitTime}
            detail={liveData.confidenceDetails.waitTime}
          />
        )}

        {/* Cover Charge */}
        {liveData.coverCharge !== null || liveData.coverChargeNote ? (
          <SignalRow
            icon={<Ticket size={16} weight="fill" className="text-green-400" />}
            label="Cover"
            value={liveData.coverCharge === null
              ? liveData.coverChargeNote || 'Free'
              : `$${liveData.coverCharge}`}
            level={liveData.confidence.coverCharge}
            detail={liveData.confidenceDetails.coverCharge}
          />
        ) : null}

        {/* Now Playing */}
        {liveData.nowPlaying && (
          <SignalRow
            icon={(
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
              >
                <MusicNotes size={16} weight="fill" className="text-purple-400" />
              </motion.div>
            )}
            label="Playing"
            value={`${liveData.nowPlaying.track} - ${liveData.nowPlaying.artist}`}
            level={liveData.confidence.nowPlaying}
            detail={liveData.confidenceDetails.nowPlaying}
          />
        )}

        {/* Crowd Level */}
        {liveData.crowdLevel > 0 && (
          <div className="space-y-1.5">
            <SignalRow
              icon={<Users size={16} weight="fill" className="text-blue-400" />}
              label="Crowd"
              value={`${liveData.crowdLevel}% full`}
              level={liveData.confidence.crowdLevel}
              detail={liveData.confidenceDetails.crowdLevel}
            />
            <CrowdBar percentFull={liveData.crowdLevel} />
          </div>
        )}

        {/* Dress Code */}
        {liveData.dressCode && (
          <SignalRow
            icon={<TShirt size={16} weight="fill" className="text-pink-400" />}
            label="Dress Code"
            value={liveData.dressCode.replace('-', ' ')}
            level={liveData.confidence.dressCode}
            detail={liveData.confidenceDetails.dressCode}
            capitalizeValue
          />
        )}

        {/* Age Range */}
        {liveData.ageRange && (
          <SignalRow
            icon={<ChartBar size={16} weight="fill" className="text-cyan-400" />}
            label="Age Range"
            value={`${liveData.ageRange.min}-${liveData.ageRange.max}`}
            level={liveData.confidence.ageRange}
            detail={liveData.confidenceDetails.ageRange}
          />
        )}

        {/* Music Genre */}
        {liveData.musicGenre && !liveData.nowPlaying && (
          <SignalRow
            icon={<MusicNotes size={16} weight="fill" className="text-purple-400" />}
            label="Music"
            value={liveData.musicGenre}
            level={liveData.confidence.musicGenre}
            detail={liveData.confidenceDetails.musicGenre}
          />
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

function SourceBadge({ detail }: { detail: SignalConfidenceDetail }) {
  if (detail.operatorVerified) {
    return (
      <span className="rounded-md border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-mono uppercase text-emerald-300">
        Venue Verified
      </span>
    )
  }

  if (detail.reportCount > 0) {
    return (
      <span className="rounded-md border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-[9px] font-mono uppercase text-primary">
        Guest Reports
      </span>
    )
  }

  return (
    <span className="rounded-md border border-border bg-muted px-1.5 py-0.5 text-[9px] font-mono uppercase text-muted-foreground">
      Unverified
    </span>
  )
}

function SignalRow({
  icon,
  label,
  value,
  level,
  detail,
  capitalizeValue,
}: {
  icon: ReactNode
  label: string
  value: string
  level: ConfidenceLevel
  detail: SignalConfidenceDetail
  capitalizeValue?: boolean
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm">{label}</span>
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn('text-sm font-bold truncate max-w-[180px]', capitalizeValue && 'capitalize')}>
            {value}
          </span>
          <SourceBadge detail={detail} />
          <ConfidenceBadge level={level} />
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">{detail.summary}</p>
    </div>
  )
}
