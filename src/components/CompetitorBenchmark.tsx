import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ChartBar, Plus, Trophy, TrendUp, TrendDown, X, Lightning, Users, Fire } from '@phosphor-icons/react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line } from 'recharts'
import { motion, AnimatePresence } from 'framer-motion'
import type { Venue, Pulse } from '@/lib/types'
import { getCompetitorBenchmark, type BenchmarkComparison, type CompetitorBenchmarkResult } from '@/lib/venue-platform'

interface CompetitorBenchmarkProps {
  venue: Venue
  venues: Venue[]
  pulses: Pulse[]
  competitorIds: string[]
  onAddCompetitor: (venueId: string) => void
  onRemoveCompetitor: (venueId: string) => void
}

export function CompetitorBenchmark({
  venue,
  venues,
  pulses,
  competitorIds,
  onAddCompetitor,
  onRemoveCompetitor,
}: CompetitorBenchmarkProps) {
  const [searchQuery, setSearchQuery] = useState('')

  const benchmark = getCompetitorBenchmark(venue.id, competitorIds, venues, pulses)
  const allResults = [benchmark.yourVenue, ...benchmark.competitors]

  const searchResults = searchQuery.length >= 2
    ? venues.filter(v =>
      v.id !== venue.id &&
      !competitorIds.includes(v.id) &&
      v.name.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 5)
    : []

  const chartData = allResults.map(r => ({
    name: r.venueName.length > 12 ? r.venueName.slice(0, 12) + '...' : r.venueName,
    'Pulse Score': r.pulseScore,
    Visitors: r.visitorCount,
    'Avg Energy': Math.round(r.avgEnergy * 33.3),
    isYours: r.venueId === venue.id,
  }))

  const trendData = allResults.map(r => ({
    name: r.venueName.length > 12 ? r.venueName.slice(0, 12) + '...' : r.venueName,
    'Trending Days': r.trendingFrequency,
    'Peak Hour': r.peakHour,
  }))

  return (
    <div className="space-y-4">
      {/* Add Competitors */}
      <Card className="p-4 bg-card/80 border-border">
        <div className="flex items-center gap-2 mb-3">
          <ChartBar size={16} weight="fill" className="text-accent" />
          <h3 className="text-sm font-bold text-foreground">Competitor Tracking</h3>
          <Badge variant="outline" className="ml-auto text-[10px]">
            {competitorIds.length}/3
          </Badge>
        </div>

        {/* Current competitors */}
        <div className="flex flex-wrap gap-2 mb-3">
          {competitorIds.map(cId => {
            const v = venues.find(v => v.id === cId)
            return (
              <Badge
                key={cId}
                variant="secondary"
                className="flex items-center gap-1 pr-1"
              >
                <span className="text-xs">{v?.name ?? cId}</span>
                <button
                  onClick={() => onRemoveCompetitor(cId)}
                  className="ml-1 hover:text-destructive transition-colors"
                >
                  <X size={12} />
                </button>
              </Badge>
            )
          })}
        </div>

        {/* Search to add */}
        {competitorIds.length < 3 && (
          <div className="relative">
            <Input
              placeholder="Search venues to compare..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 text-xs bg-background"
            />
            <AnimatePresence>
              {searchResults.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute top-9 left-0 right-0 bg-card border border-border rounded-md shadow-lg z-10 overflow-hidden"
                >
                  {searchResults.map(v => (
                    <button
                      key={v.id}
                      onClick={() => {
                        onAddCompetitor(v.id)
                        setSearchQuery('')
                      }}
                      className="w-full px-3 py-2 text-left text-xs hover:bg-muted/50 flex items-center justify-between transition-colors"
                    >
                      <span className="text-foreground">{v.name}</span>
                      <Plus size={14} className="text-accent" />
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </Card>

      {/* Side-by-side Metrics */}
      {competitorIds.length > 0 && (
        <>
          <Card className="p-4 bg-card/80 border-border">
            <h3 className="text-sm font-bold text-foreground mb-3">Score Comparison</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -15 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '11px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '10px' }} />
                  <Bar dataKey="Pulse Score" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Visitors" fill="oklch(0.70 0.22 60)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Avg Energy" fill="oklch(0.65 0.28 340)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Trending Comparison */}
          <Card className="p-4 bg-card/80 border-border">
            <h3 className="text-sm font-bold text-foreground mb-3">Weekly Trends</h3>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendData} margin={{ top: 5, right: 5, bottom: 5, left: -15 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '11px',
                    }}
                  />
                  <Bar dataKey="Trending Days" fill="oklch(0.60 0.15 150)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Metric Cards */}
          <div className="space-y-2">
            {allResults.map(r => (
              <MetricRow key={r.venueId} result={r} isYours={r.venueId === venue.id} />
            ))}
          </div>

          {/* Insights */}
          {benchmark.insights.length > 0 && (
            <Card className="p-4 bg-card/80 border-border">
              <div className="flex items-center gap-2 mb-3">
                <Trophy size={16} weight="fill" className="text-yellow-400" />
                <h3 className="text-sm font-bold text-foreground">Insights</h3>
              </div>
              <div className="space-y-2">
                {benchmark.insights.slice(0, 6).map((insight, i) => {
                  const isWinning = insight.includes("You're beating")
                  return (
                    <div
                      key={i}
                      className={`flex items-start gap-2 text-xs ${isWinning ? 'text-green-400' : 'text-amber-400'}`}
                    >
                      {isWinning ? <TrendUp size={14} className="shrink-0 mt-0.5" /> : <TrendDown size={14} className="shrink-0 mt-0.5" />}
                      <span>{insight}</span>
                    </div>
                  )
                })}
              </div>
            </Card>
          )}
        </>
      )}

      {competitorIds.length === 0 && (
        <Card className="p-6 bg-card/80 border-border text-center">
          <ChartBar size={32} weight="thin" className="text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Add up to 3 competitor venues to compare metrics</p>
        </Card>
      )}
    </div>
  )
}

function MetricRow({ result, isYours }: { result: CompetitorBenchmarkResult; isYours: boolean }) {
  return (
    <Card className={`p-3 border-border ${isYours ? 'bg-primary/10 border-primary/30' : 'bg-card/80'}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-foreground truncate flex-1">
          {result.venueName}
          {isYours && <Badge variant="outline" className="ml-2 text-[9px] text-accent border-accent/50">You</Badge>}
        </span>
      </div>
      <div className="grid grid-cols-4 gap-2 text-center">
        <div>
          <Fire size={12} className="text-orange-400 mx-auto mb-0.5" />
          <p className="text-xs font-bold text-foreground">{result.pulseScore}</p>
          <p className="text-[9px] text-muted-foreground">Score</p>
        </div>
        <div>
          <Users size={12} className="text-blue-400 mx-auto mb-0.5" />
          <p className="text-xs font-bold text-foreground">{result.visitorCount}</p>
          <p className="text-[9px] text-muted-foreground">Visitors</p>
        </div>
        <div>
          <Lightning size={12} className="text-yellow-400 mx-auto mb-0.5" />
          <p className="text-xs font-bold text-foreground">{result.avgEnergy.toFixed(1)}</p>
          <p className="text-[9px] text-muted-foreground">Energy</p>
        </div>
        <div>
          <TrendUp size={12} className="text-green-400 mx-auto mb-0.5" />
          <p className="text-xs font-bold text-foreground">{result.trendingFrequency}d</p>
          <p className="text-[9px] text-muted-foreground">Trending</p>
        </div>
      </div>
    </Card>
  )
}
