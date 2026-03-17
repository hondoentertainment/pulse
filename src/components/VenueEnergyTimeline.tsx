import { useMemo } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  TrendUp,
  TrendDown,
  Star,
  Lightning,
  Clock,
  Minus,
} from '@phosphor-icons/react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { motion } from 'framer-motion'
import type { Venue } from '@/lib/types'
import { useVenueEnergyHistory } from '@/hooks/use-venue-energy-history'
import type { EnergyDataPoint, EnergyTrend } from '@/lib/venue-energy-history'

interface VenueEnergyTimelineProps {
  venue: Venue
  compact?: boolean
}

function formatHourLabel(hour: number): string {
  if (hour === 0 || hour === 24) return '12AM'
  if (hour === 12) return '12PM'
  if (hour < 12) return `${hour}AM`
  return `${hour - 12}PM`
}

function getScoreColor(score: number): string {
  if (score >= 75) return 'oklch(0.65 0.28 340)' // electric pink
  if (score >= 50) return 'oklch(0.70 0.22 60)' // buzzing orange
  if (score >= 25) return 'oklch(0.75 0.18 90)' // yellow-green
  return 'oklch(0.60 0.15 150)' // chill green
}

function getTrendIcon(trend: EnergyTrend) {
  switch (trend) {
    case 'rising':
      return <TrendUp size={14} weight="bold" className="text-green-400" />
    case 'falling':
      return <TrendDown size={14} weight="bold" className="text-orange-400" />
    case 'peaking':
      return <Lightning size={14} weight="fill" className="text-yellow-400" />
    case 'quiet':
      return <Minus size={14} weight="bold" className="text-muted-foreground" />
  }
}

function getTrendLabel(trend: EnergyTrend): string {
  switch (trend) {
    case 'rising':
      return 'Rising'
    case 'falling':
      return 'Winding down'
    case 'peaking':
      return 'Peaking'
    case 'quiet':
      return 'Quiet'
  }
}

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ payload: EnergyDataPoint }>
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.[0]) return null
  const dp = payload[0].payload
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-lg text-xs">
      <p className="font-bold text-foreground">{formatHourLabel(dp.timestamp)}</p>
      <p className="text-muted-foreground">
        Energy: <span className="text-foreground font-semibold" style={{ color: getScoreColor(dp.score) }}>{dp.score}</span>
      </p>
      <p className="text-muted-foreground">
        Check-ins: <span className="text-foreground font-semibold">{dp.checkinCount}</span>
      </p>
      {dp.label && (
        <p className="text-accent font-medium mt-0.5">{dp.label}</p>
      )}
    </div>
  )
}

export function VenueEnergyTimeline({ venue, compact = false }: VenueEnergyTimelineProps) {
  const { history, isLoading } = useVenueEnergyHistory(venue)

  const chartData = useMemo(() => {
    if (!history) return []
    return history.dataPoints.map(dp => ({
      ...dp,
      hourLabel: formatHourLabel(dp.timestamp),
    }))
  }, [history])

  const currentHour = useMemo(() => new Date().getHours(), [])

  if (isLoading || !history) {
    return (
      <Card className="p-4 bg-card/80 border-border" data-testid="energy-timeline-loading">
        <div className="flex items-center gap-2 animate-pulse">
          <div className="w-4 h-4 rounded bg-muted" />
          <div className="h-3 w-32 rounded bg-muted" />
        </div>
        <div className="h-32 mt-3 rounded bg-muted/50 animate-pulse" />
      </Card>
    )
  }

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        data-testid="energy-timeline-compact"
      >
        <div className="h-16">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 2, right: 2, bottom: 0, left: 2 }}>
              <defs>
                <linearGradient id={`energyGradientCompact-${venue.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.65 0.28 340)" stopOpacity={0.6} />
                  <stop offset="50%" stopColor="oklch(0.70 0.22 60)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="oklch(0.60 0.15 150)" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="score"
                stroke="oklch(0.70 0.22 60)"
                strokeWidth={1.5}
                fill={`url(#energyGradientCompact-${venue.id})`}
                isAnimationActive={true}
                animationDuration={1000}
              />
              <ReferenceLine x={currentHour} stroke="hsl(var(--primary))" strokeDasharray="3 3" strokeWidth={1} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      data-testid="energy-timeline-full"
    >
      <Card className="p-4 bg-card/80 border-border">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Clock size={16} weight="fill" className="text-accent" />
            <h3 className="text-sm font-bold text-foreground">Energy Timeline</h3>
          </div>

          <div className="flex items-center gap-2">
            {/* Trend badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
            >
              <Badge variant="outline" className="flex items-center gap-1 text-[10px]" data-testid="trend-badge">
                {getTrendIcon(history.trend)}
                <span>{getTrendLabel(history.trend)}</span>
              </Badge>
            </motion.div>

            {/* Compared to last week */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5 }}
            >
              <Badge
                variant="secondary"
                className="text-[10px]"
                data-testid="week-comparison"
              >
                {history.comparedToLastWeek}
              </Badge>
            </motion.div>
          </div>
        </div>

        {/* Chart */}
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 5, bottom: 5, left: -15 }}>
              <defs>
                <linearGradient id={`energyGradient-${venue.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.65 0.28 340)" stopOpacity={0.5} />
                  <stop offset="40%" stopColor="oklch(0.70 0.22 60)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="oklch(0.60 0.15 150)" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="timestamp"
                tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(hour: number) => {
                  // Show fewer labels to avoid crowding
                  if (hour % 3 === 0) return formatHourLabel(hour)
                  return ''
                }}
                interval={0}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                tickCount={5}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="score"
                stroke="oklch(0.70 0.22 60)"
                strokeWidth={2}
                fill={`url(#energyGradient-${venue.id})`}
                isAnimationActive={true}
                animationDuration={1200}
                animationEasing="ease-out"
              />
              {/* Current time marker */}
              <ReferenceLine
                x={currentHour}
                stroke="hsl(var(--primary))"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{
                  value: 'Now',
                  position: 'top',
                  fill: 'hsl(var(--primary))',
                  fontSize: 10,
                  fontWeight: 'bold',
                }}
              />
              {/* Peak hour marker */}
              <ReferenceLine
                x={history.peakHour}
                stroke="oklch(0.70 0.22 60)"
                strokeDasharray="2 2"
                strokeWidth={1}
                label={{
                  value: 'Peak',
                  position: 'top',
                  fill: 'oklch(0.70 0.22 60)',
                  fontSize: 9,
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between mt-2 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1">
            <Star size={12} weight="fill" className="text-yellow-400" />
            <span>Best time: <span className="text-foreground font-semibold">{formatHourLabel(history.bestTimeToVisit)}</span></span>
          </div>
          <div className="flex items-center gap-1">
            <Lightning size={12} weight="fill" className="text-accent" />
            <span>Current: <span className="text-foreground font-semibold">{history.currentScore}</span></span>
          </div>
        </div>
      </Card>
    </motion.div>
  )
}
