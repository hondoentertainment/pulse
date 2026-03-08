import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendUp, TrendDown, Minus, Users, Lightning, Clock, Megaphone } from '@phosphor-icons/react'
import type { VenueOwnerDashboard as DashboardData, VenueAnnouncement } from '@/lib/venue-owner'
import { ENERGY_CONFIG } from '@/lib/types'
import type { EnergyRating } from '@/lib/types'

interface VenueOwnerDashboardProps {
  dashboard: DashboardData
  announcements: VenueAnnouncement[]
  onCreateAnnouncement: () => void
}

export function VenueOwnerDashboard({ dashboard, announcements, onCreateAnnouncement }: VenueOwnerDashboardProps) {
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
