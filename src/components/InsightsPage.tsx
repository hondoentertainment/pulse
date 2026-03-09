import { useMemo } from 'react'
import { User, Pulse, Venue, EnergyRating } from '@/lib/types'
import { generateWeeklyInsights, determineVibeType, generateActivityHeatmap, getInsightHighlights } from '@/lib/personal-insights'
import { CaretLeft, ChartBar, Lightning, MapPin, Fire, Clock } from '@phosphor-icons/react'
import { motion } from 'framer-motion'

interface InsightsPageProps {
  currentUser: User
  pulses: Pulse[]
  venues: Venue[]
  onBack: () => void
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const HOURS = ['12a', '3a', '6a', '9a', '12p', '3p', '6p', '9p']

export function InsightsPage({ currentUser, pulses, venues, onBack }: InsightsPageProps) {
  const userPulses = useMemo(() => pulses.filter(p => p.userId === currentUser.id), [pulses, currentUser.id])

  const weekStart = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    return d.toISOString()
  }, [])

  const insights = useMemo(
    () => generateWeeklyInsights(currentUser.id, pulses, venues, weekStart),
    [currentUser.id, pulses, venues, weekStart]
  )

  const vibeResult = useMemo(() => determineVibeType(userPulses, currentUser), [userPulses, currentUser])
  const heatmap = useMemo(() => generateActivityHeatmap(currentUser.id, pulses), [currentUser.id, pulses])
  const highlights = useMemo(() => getInsightHighlights(insights), [insights])

  const energyEntries = Object.entries(insights.energyContributed) as [EnergyRating, number][]
  const totalEnergy = energyEntries.reduce((sum, [, count]) => sum + count, 0)

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="flex items-center gap-3 px-4 py-3 max-w-2xl mx-auto">
          <button onClick={onBack} className="p-2 -ml-2 hover:bg-muted rounded-lg">
            <CaretLeft size={24} />
          </button>
          <div className="flex items-center gap-2">
            <ChartBar size={24} weight="fill" className="text-primary" />
            <h1 className="text-xl font-bold">Your Insights</h1>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-primary/20 to-accent/20 rounded-2xl p-6 text-center border border-primary/20"
        >
          <span className="text-5xl">{vibeResult.emoji}</span>
          <h2 className="text-2xl font-bold mt-3">{vibeResult.type}</h2>
          <p className="text-sm text-muted-foreground mt-1">{vibeResult.description}</p>
        </motion.div>

        <div className="grid grid-cols-2 gap-3">
          <StatCard icon={<MapPin size={20} weight="fill" />} label="Venues Visited" value={insights.uniqueVenues} />
          <StatCard icon={<Lightning size={20} weight="fill" />} label="Pulses Posted" value={insights.totalPulses} />
          <StatCard icon={<Fire size={20} weight="fill" />} label="High Energy" value={totalEnergy > 0 ? `${Math.round((insights.energyContributed.electric + insights.energyContributed.buzzing) / totalEnergy * 100)}%` : '0%'} />
          <StatCard icon={<Clock size={20} weight="fill" />} label="Miles Explored" value={insights.milesExplored.toFixed(1)} />
        </div>

        <div className="bg-card rounded-xl p-4 border border-border space-y-3">
          <h3 className="font-bold">Energy Breakdown</h3>
          <div className="space-y-2">
            {energyEntries.map(([level, count]) => {
              const pct = totalEnergy > 0 ? (count / totalEnergy) * 100 : 0
              return (
                <div key={level} className="flex items-center gap-3">
                  <span className="text-sm w-16 capitalize">{level}</span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.5, delay: 0.2 }}
                      className="h-full rounded-full bg-primary"
                    />
                  </div>
                  <span className="text-xs text-muted-foreground w-8 text-right">{count}</span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="bg-card rounded-xl p-4 border border-border space-y-3">
          <h3 className="font-bold">Activity Heatmap</h3>
          <div className="overflow-x-auto">
            <div className="grid gap-px" style={{ gridTemplateColumns: `40px repeat(${HOURS.length}, 1fr)` }}>
              <div />
              {HOURS.map(h => (
                <div key={h} className="text-[10px] text-muted-foreground text-center">{h}</div>
              ))}
              {DAYS.map((day, dayIdx) => (
                <div key={day} className="contents">
                  <div className="text-[10px] text-muted-foreground flex items-center">{day}</div>
                  {Array.from({ length: 8 }).map((_, hourIdx) => {
                    const slot = heatmap.cells.find(g => g.dayOfWeek === dayIdx && Math.floor(g.hour / 3) === hourIdx)
                    const count = slot?.count || 0
                    const maxCount = Math.max(...heatmap.cells.map(g => g.count), 1)
                    const intensity = count / maxCount
                    return (
                      <div
                        key={`${dayIdx}-${hourIdx}`}
                        className="aspect-square rounded-sm"
                        style={{
                          backgroundColor: count > 0
                            ? `oklch(0.65 0.28 340 / ${0.15 + intensity * 0.85})`
                            : 'oklch(0.2 0.01 270 / 0.3)'
                        }}
                        title={`${day} ${HOURS[hourIdx]}: ${count} pulses`}
                      />
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {highlights.length > 0 && (
          <div className="bg-card rounded-xl p-4 border border-border space-y-3">
            <h3 className="font-bold">Highlights</h3>
            <div className="space-y-2">
              {highlights.map((h, i) => (
                <p key={i} className="text-sm text-muted-foreground">✨ {h}</p>
              ))}
            </div>
          </div>
        )}

        {userPulses.length === 0 && (
          <div className="text-center py-8">
            <ChartBar size={48} className="mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">Post some pulses to see your insights!</p>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-card rounded-xl p-4 border border-border"
    >
      <div className="text-primary mb-2">{icon}</div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </motion.div>
  )
}
