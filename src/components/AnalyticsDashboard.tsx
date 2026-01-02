import { useKV } from '@github/spark/hooks'
import { Venue, Pulse, VenueAnalytics } from '@/lib/types'
import { Card } from './ui/card'
import { Badge } from './ui/badge'
import { Separator } from './ui/separator'
import { calculateVenueAnalytics } from '@/lib/venue-trending'
import { ChartBar, TrendUp, Clock, Hash } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'

export function AnalyticsDashboard() {
  const [venues] = useKV<Venue[]>('venues', [])
  const [pulses] = useKV<Pulse[]>('pulses', [])
  const [analytics, setAnalytics] = useState<VenueAnalytics[]>([])

  useEffect(() => {
    if (venues && pulses) {
      const seededVenues = venues.filter(v => v.seeded || v.preTrending)
      const analyticsData = seededVenues.map(venue => 
        calculateVenueAnalytics(venue, pulses)
      )
      setAnalytics(analyticsData)
    }
  }, [venues, pulses])

  if (!venues || !pulses) return null

  const seededVenues = venues.filter(v => v.seeded || v.preTrending)
  const totalSeeded = seededVenues.length
  const converted = seededVenues.filter(v => !v.preTrending).length
  const conversionRate = totalSeeded > 0 ? (converted / totalSeeded * 100).toFixed(1) : '0.0'

  const avgTimeToFirstActivity = analytics
    .filter(a => a.timeToFirstRealActivity !== undefined)
    .reduce((sum, a) => sum + (a.timeToFirstRealActivity || 0), 0) / 
    Math.max(1, analytics.filter(a => a.timeToFirstRealActivity !== undefined).length)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ChartBar size={20} weight="fill" className="text-accent" />
        <h3 className="text-lg font-bold">Seeded Content Analytics</h3>
        <Badge variant="outline" className="text-xs">
          Developer View
        </Badge>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4 space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Seeded</p>
          <p className="text-2xl font-bold font-mono">{totalSeeded}</p>
        </Card>
        <Card className="p-4 space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Converted</p>
          <p className="text-2xl font-bold font-mono">{converted}</p>
        </Card>
        <Card className="p-4 space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Conv. Rate</p>
          <p className="text-2xl font-bold font-mono">{conversionRate}%</p>
        </Card>
      </div>

      {avgTimeToFirstActivity > 0 && (
        <Card className="p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Clock size={16} weight="fill" className="text-accent" />
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Avg Time to First Activity
            </p>
          </div>
          <p className="text-xl font-bold font-mono">{avgTimeToFirstActivity.toFixed(1)} hours</p>
        </Card>
      )}

      <Separator />

      <div className="space-y-3">
        <h4 className="text-sm font-bold">Seeded Venues Status</h4>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {analytics.map((analytic) => {
            const venue = venues.find(v => v.id === analytic.venueId)
            if (!venue) return null

            return (
              <Card key={analytic.venueId} className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{venue.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={venue.preTrending ? "outline" : "default"} className="text-xs">
                        {venue.preTrending ? 'Pre-Trending' : 'Converted'}
                      </Badge>
                      <span className="text-xs text-muted-foreground font-mono">
                        {analytic.totalVerifiedCheckIns} check-ins
                      </span>
                    </div>
                  </div>
                  {analytic.preTrendingConversionRate !== undefined && (
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Conv. Rate</p>
                      <p className="text-sm font-mono font-bold">
                        {(analytic.preTrendingConversionRate * 100).toFixed(0)}%
                      </p>
                    </div>
                  )}
                </div>
                {analytic.timeToFirstRealActivity !== undefined && (
                  <p className="text-xs text-muted-foreground mt-2">
                    First activity after {analytic.timeToFirstRealActivity.toFixed(1)}h
                  </p>
                )}
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
