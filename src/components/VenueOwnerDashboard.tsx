import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendUp, TrendDown, Minus, Users, Lightning, Clock, Megaphone, ChartBar, Path, CalendarBlank } from '@phosphor-icons/react'
import type { VenueOwnerDashboard as DashboardData, VenueAnnouncement } from '@/lib/venue-owner'
import type { CompetitorBenchmark, CustomerFlow, TimingRecommendation } from '@/lib/venue-analytics-pro'
import { ENERGY_CONFIG } from '@/lib/types'
import type { EnergyRating } from '@/lib/types'

interface VenueOwnerDashboardProps {
  dashboard: DashboardData
  announcements: VenueAnnouncement[]
  onCreateAnnouncement: () => void
  competitorBenchmarks?: CompetitorBenchmark[]
  customerFlow?: CustomerFlow
  timingRecommendations?: TimingRecommendation[]
}

export function VenueOwnerDashboard({ dashboard, announcements, onCreateAnnouncement, competitorBenchmarks, customerFlow, timingRecommendations }: VenueOwnerDashboardProps) {
  const TrendIcon = dashboard.trend === 'up' ? TrendUp : dashboard.trend === 'down' ? TrendDown : Minus
  const trendColor = dashboard.trend === 'up' ? 'text-green-400' : dashboard.trend === 'down' ? 'text-red-400' : 'text-muted-foreground'

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">{dashboard.venueName}</h2>
          <p className="text-xs text-muted-foreground">Owner Dashboard</p>
        </div>
        <Badge variant="outline" className="text-accent border-accent/50">
          Verified Owner
        </Badge>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="p-3 bg-card/80 border-border text-center">
          <p className="text-2xl font-bold text-foreground">{dashboard.currentScore}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Pulse Score</p>
          <div className={`flex items-center justify-center gap-0.5 mt-1 text-xs ${trendColor}`}>
            <TrendIcon size={12} weight="bold" />
            <span>{dashboard.scoreDelta > 0 ? '+' : ''}{dashboard.scoreDelta}</span>
          </div>
        </Card>

        <Card className="p-3 bg-card/80 border-border text-center">
          <p className="text-2xl font-bold text-foreground">{dashboard.pulsesLast24h}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Pulses (24h)</p>
          <p className="text-[10px] text-muted-foreground mt-1">{dashboard.pulsesLast7d} this week</p>
        </Card>

        <Card className="p-3 bg-card/80 border-border text-center">
          <div className="flex items-center justify-center gap-1">
            <Users size={16} weight="fill" className="text-accent" />
            <p className="text-2xl font-bold text-foreground">{dashboard.uniqueVisitors7d}</p>
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">Visitors (7d)</p>
        </Card>
      </div>

      {/* Energy distribution */}
      <Card className="p-3 bg-card/80 border-border">
        <div className="flex items-center gap-2 mb-2">
          <Lightning size={14} weight="fill" className="text-accent" />
          <p className="text-xs font-bold text-foreground">Energy Distribution</p>
          <span className="text-[10px] text-muted-foreground ml-auto">
            Avg: {dashboard.averageEnergy.toFixed(1)}/3
          </span>
        </div>
        <div className="flex gap-1 h-6 rounded-full overflow-hidden">
          {(['electric', 'buzzing', 'chill', 'dead'] as EnergyRating[]).map(rating => {
            const count = dashboard.energyDistribution[rating]
            const total = Object.values(dashboard.energyDistribution).reduce((a, b) => a + b, 0)
            const pct = total > 0 ? (count / total) * 100 : 0
            if (pct === 0) return null
            return (
              <div
                key={rating}
                style={{
                  width: `${pct}%`,
                  backgroundColor: ENERGY_CONFIG[rating].color,
                }}
                className="h-full"
                title={`${ENERGY_CONFIG[rating].label}: ${count} (${Math.round(pct)}%)`}
              />
            )
          })}
        </div>
        <div className="flex justify-between mt-1">
          {(['electric', 'buzzing', 'chill', 'dead'] as EnergyRating[]).map(rating => (
            <span key={rating} className="text-[9px] text-muted-foreground">
              {ENERGY_CONFIG[rating].emoji} {dashboard.energyDistribution[rating]}
            </span>
          ))}
        </div>
      </Card>

      {/* Peak hours */}
      {dashboard.peakHours.length > 0 && (
        <Card className="p-3 bg-card/80 border-border">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={14} weight="fill" className="text-accent" />
            <p className="text-xs font-bold text-foreground">Peak Hours</p>
          </div>
          <div className="space-y-1">
            {dashboard.peakHours.slice(0, 5).map((ph, i) => {
              const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
              const hour = ph.hour > 12 ? `${ph.hour - 12}PM` : ph.hour === 0 ? '12AM' : `${ph.hour}AM`
              return (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{days[ph.dayOfWeek]} {hour}</span>
                  <span className="text-foreground font-medium">{ph.averagePulseCount} pulses</span>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Competitor Benchmarks (Pro) */}
      {competitorBenchmarks && competitorBenchmarks.length > 0 && (
        <Card className="p-3 bg-card/80 border-border">
          <div className="flex items-center gap-2 mb-2">
            <ChartBar size={14} weight="fill" className="text-accent" />
            <p className="text-xs font-bold text-foreground">Competitor Benchmark</p>
          </div>
          <div className="space-y-1.5">
            {competitorBenchmarks.slice(0, 5).map((cb) => {
              const isOwn = cb.venueId === dashboard.venueId
              return (
                <div key={cb.venueId} className={`flex items-center justify-between text-xs ${isOwn ? 'font-bold text-accent' : 'text-muted-foreground'}`}>
                  <span className="truncate flex-1">#{cb.rank} {cb.venueName}</span>
                  <span className="ml-2">{cb.score} pts</span>
                  <span className="ml-2 text-[10px]">({cb.percentile}th %ile)</span>
                </div>
              )
            })}
          </div>
          {competitorBenchmarks.length > 0 && (
            <p className="text-[10px] text-muted-foreground mt-2">
              Nearby avg: {competitorBenchmarks[0].nearbyAverage} pts
            </p>
          )}
        </Card>
      )}

      {/* Customer Flow (Pro) */}
      {customerFlow && (customerFlow.before.length > 0 || customerFlow.after.length > 0) && (
        <Card className="p-3 bg-card/80 border-border">
          <div className="flex items-center gap-2 mb-2">
            <Path size={14} weight="fill" className="text-accent" />
            <p className="text-xs font-bold text-foreground">Customer Flow</p>
          </div>
          {customerFlow.before.length > 0 && (
            <div className="mb-2">
              <p className="text-[10px] text-muted-foreground mb-1">Where they come from</p>
              {customerFlow.before.slice(0, 3).map((entry) => (
                <div key={entry.venueId} className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="truncate flex-1">{entry.venueName || entry.venueId}</span>
                  <span className="ml-2">{entry.percentage}%</span>
                </div>
              ))}
            </div>
          )}
          {customerFlow.after.length > 0 && (
            <div>
              <p className="text-[10px] text-muted-foreground mb-1">Where they go after</p>
              {customerFlow.after.slice(0, 3).map((entry) => (
                <div key={entry.venueId} className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="truncate flex-1">{entry.venueName || entry.venueId}</span>
                  <span className="ml-2">{entry.percentage}%</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Timing Recommendations (Pro) */}
      {timingRecommendations && timingRecommendations.length > 0 && (
        <Card className="p-3 bg-card/80 border-border">
          <div className="flex items-center gap-2 mb-2">
            <CalendarBlank size={14} weight="fill" className="text-accent" />
            <p className="text-xs font-bold text-foreground">Event Timing Suggestions</p>
          </div>
          <div className="space-y-1.5">
            {timingRecommendations.slice(0, 3).map((rec, i) => {
              const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
              const hour = rec.hour > 12 ? `${rec.hour - 12}PM` : rec.hour === 0 ? '12AM' : `${rec.hour}AM`
              return (
                <div key={i} className="text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-foreground font-medium">{days[rec.dayOfWeek]} {hour}</span>
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                      {ENERGY_CONFIG[rec.expectedEnergy].emoji} {rec.expectedEnergy}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground">{rec.reason}</p>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Announcements */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Megaphone size={14} weight="fill" className="text-accent" />
          <p className="text-xs font-bold text-foreground">Announcements ({announcements.length})</p>
        </div>
        <button
          onClick={onCreateAnnouncement}
          className="text-xs text-accent hover:underline"
        >
          + New
        </button>
      </div>
    </div>
  )
}
