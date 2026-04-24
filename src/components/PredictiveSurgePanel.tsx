import { useMemo } from 'react'
import { Venue, Pulse } from '@/lib/types'
import { analyzeVenuePatterns, getVenuesThatWillSurge, generateSmartNotification, VenuePattern } from '@/lib/predictive-surge'
import { Lightning, Clock, TrendUp } from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import type { VenueEvent } from '@/lib/events'

interface PredictiveSurgePanelProps {
  venues: Venue[]
  pulses: Pulse[]
  events?: VenueEvent[]
  onVenueClick: (venue: Venue) => void
}

export function PredictiveSurgePanel({ venues, pulses, events = [], onVenueClick }: PredictiveSurgePanelProps) {
  const now = new Date()
  const currentHour = now.getHours()
  const dayOfWeek = now.getDay()

  const patterns = useMemo(() => {
    const allPatterns: VenuePattern[] = []
    for (const v of venues) {
      allPatterns.push(...analyzeVenuePatterns(v.id, pulses))
    }
    return allPatterns
  }, [venues, pulses])

  const surgeVenues = useMemo(() => {
    return getVenuesThatWillSurge(venues, patterns, currentHour, dayOfWeek, 3, events, now)
  }, [venues, patterns, currentHour, dayOfWeek, events, now])

  if (surgeVenues.length === 0) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Lightning size={20} weight="fill" className="text-yellow-400" />
        <h3 className="font-bold text-sm">Predicted to Surge</h3>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
        {surgeVenues.map((prediction, i) => {
          const venue = venues.find(v => v.id === prediction.venueId)
          if (!venue) return null
          const notification = generateSmartNotification(venue.name, prediction)
          return (
            <motion.button
              key={prediction.venueId}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              onClick={() => onVenueClick(venue)}
              className="flex-shrink-0 w-48 bg-gradient-to-br from-yellow-500/10 to-orange-500/10 rounded-xl p-3 border border-yellow-500/20 text-left"
            >
              <div className="flex items-center gap-1.5 mb-2">
                <TrendUp size={14} weight="bold" className="text-yellow-400" />
                <span className="text-xs font-medium text-yellow-400">
                  {Math.round(prediction.confidence * 100)}% likely
                </span>
                <span className="text-[10px] text-muted-foreground">
                  · {prediction.momentumScore} momentum
                </span>
              </div>
              <p className="font-medium text-sm truncate">{venue.name}</p>
              <p className="text-xs text-muted-foreground mt-1">{notification}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {prediction.signals.slice(0, 2).map(signal => (
                  <span
                    key={`${prediction.venueId}-${signal.source}`}
                    className="rounded-full border border-yellow-500/20 bg-yellow-500/10 px-2 py-0.5 text-[10px] text-yellow-200"
                  >
                    {signal.label}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-1 mt-2">
                <Clock size={12} className="text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground">
                  Peak at {prediction.predictedPeakTime}
                </span>
              </div>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
