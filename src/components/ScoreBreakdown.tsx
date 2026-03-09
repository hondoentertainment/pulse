import { useState } from 'react'
import { Pulse, Venue } from '@/lib/types'
import { Info, CaretDown, CaretUp, TrendUp, TrendDown } from '@phosphor-icons/react'
import { formatTimeAgo } from '@/lib/pulse-engine'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

interface ScoreBreakdownProps {
  venue: Venue
  pulses: Pulse[]
}

export function ScoreBreakdown({ venue, pulses }: ScoreBreakdownProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const recentPulses = pulses.filter(p => {
    const age = Date.now() - new Date(p.createdAt).getTime()
    return age < 90 * 60 * 1000
  })

  const veryRecentPulses = pulses.filter(p => {
    const age = Date.now() - new Date(p.createdAt).getTime()
    return age < 10 * 60 * 1000
  })

  const oldScore = venue.pulseScore - (veryRecentPulses.length * 8)
  const scoreChange = venue.pulseScore - oldScore

  const _energyRatingCounts = recentPulses.reduce((acc, p) => {
    acc[p.energyRating] = (acc[p.energyRating] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const avgEnergy = recentPulses.length > 0
    ? recentPulses.reduce((sum, p) => {
        const values = { dead: 0, chill: 1, buzzing: 2, electric: 3 }
        return sum + values[p.energyRating]
      }, 0) / recentPulses.length
    : 0

  const avgEnergyLabel = avgEnergy >= 2.5 ? 'Electric' : avgEnergy >= 1.5 ? 'Buzzing' : avgEnergy >= 0.5 ? 'Chill' : 'Dead'

  return (
    <div className="space-y-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
      >
        <Info size={16} className="group-hover:text-accent transition-colors" />
        <span className="font-mono uppercase tracking-wide">Why this score?</span>
        {isExpanded ? <CaretUp size={16} /> : <CaretDown size={16} />}
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="bg-card border border-border rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-mono uppercase tracking-wide">
                    Recent Activity
                  </p>
                  <p className="text-2xl font-bold">
                    {recentPulses.length} {recentPulses.length === 1 ? 'pulse' : 'pulses'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    in last 90 minutes
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-mono uppercase tracking-wide">
                    Avg Energy
                  </p>
                  <p className="text-2xl font-bold">
                    {avgEnergyLabel}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    from recent posts
                  </p>
                </div>
              </div>

              {scoreChange !== 0 && (
                <div className={cn(
                  "flex items-center gap-2 p-2 rounded-md",
                  scoreChange > 0 ? "bg-accent/20" : "bg-destructive/20"
                )}>
                  {scoreChange > 0 ? (
                    <TrendUp size={20} className="text-accent" weight="bold" />
                  ) : (
                    <TrendDown size={20} className="text-destructive" weight="bold" />
                  )}
                  <div>
                    <p className={cn(
                      "text-sm font-bold",
                      scoreChange > 0 ? "text-accent" : "text-destructive"
                    )}>
                      {scoreChange > 0 ? '+' : ''}{Math.round(scoreChange)} points
                    </p>
                    <p className="text-xs text-muted-foreground">
                      in last 10 minutes
                    </p>
                  </div>
                </div>
              )}

              {venue.lastPulseAt && (
                <div className="pt-2 border-t border-border">
                  <p className="text-xs text-muted-foreground">
                    Last pulse <span className="text-foreground font-medium">{formatTimeAgo(venue.lastPulseAt)}</span>
                  </p>
                </div>
              )}

              <div className="pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Score updates every few seconds based on pulse count, energy ratings, and recency. Pulses expire after 90 minutes.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
