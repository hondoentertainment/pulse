import { useState, useEffect, useMemo } from 'react'
import type { Venue, Pulse, User, EnergyRating } from '@/lib/types'
import { ENERGY_CONFIG } from '@/lib/types'
import type { NightPlan, SwapSuggestion } from '@/lib/night-planner'
import { getCurrentStopIndex, adaptPlan, swapStop } from '@/lib/night-planner'
import { CaretLeft, MapPin, Clock, Lightning, Warning, CheckCircle, Car, PersonSimpleWalk, ChatCircleDots, CurrencyDollar, ShieldCheck } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'

interface LivePlanTrackerProps {
  plan: NightPlan
  venues: Venue[]
  pulses: Pulse[]
  currentUser: User
  onBack: () => void
  onVenueClick: (venue: Venue) => void
}

export function LivePlanTracker({
  plan: initialPlan,
  venues,
  pulses,
  currentUser,
  onBack,
  onVenueClick,
}: LivePlanTrackerProps) {
  const [plan, setPlan] = useState(initialPlan)
  const [now, setNow] = useState(new Date().toISOString())
  const [swapSuggestions, setSwapSuggestions] = useState<SwapSuggestion[]>([])
  const [dismissedSwaps, setDismissedSwaps] = useState<Set<number>>(new Set())

  // Update current time every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date().toISOString())
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  const currentStopIndex = useMemo(
    () => getCurrentStopIndex(plan, now),
    [plan, now]
  )

  const currentStop = currentStopIndex >= 0 ? plan.stops[currentStopIndex] : null
  const nextStop = currentStopIndex < plan.stops.length - 1 ? plan.stops[currentStopIndex + 1] : null

  // Build live energy scores from venue data
  const liveEnergyScores = useMemo(() => {
    const scores: Record<string, { energy: EnergyRating; score: number }> = {}
    const ENERGY_LABELS: EnergyRating[] = ['dead', 'chill', 'buzzing', 'electric']

    for (const venue of venues) {
      const energy = ENERGY_LABELS[Math.min(3, Math.round(venue.pulseScore / 33))]
      scores[venue.id] = { energy, score: venue.pulseScore }
    }
    return scores
  }, [venues])

  // Check for adaptation opportunities every minute
  useEffect(() => {
    const result = adaptPlan(plan, now, liveEnergyScores, venues, pulses, currentUser)
    setPlan(result.plan)

    const newSuggestions = result.swapSuggestions.filter(s => !dismissedSwaps.has(s.stopIndex))
    setSwapSuggestions(newSuggestions)
  }, [now, liveEnergyScores]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleAcceptSwap = (suggestion: SwapSuggestion) => {
    const updated = swapStop(plan, suggestion.stopIndex, suggestion.suggestedVenue, pulses)
    setPlan(updated)
    setSwapSuggestions(prev => prev.filter(s => s.stopIndex !== suggestion.stopIndex))
    toast.success(`Swapped to ${suggestion.suggestedVenue.name}!`)
  }

  const handleDismissSwap = (stopIndex: number) => {
    setDismissedSwaps(prev => new Set([...prev, stopIndex]))
    setSwapSuggestions(prev => prev.filter(s => s.stopIndex !== stopIndex))
  }

  // Calculate countdown to next stop departure
  const getCountdown = (): string | null => {
    if (!currentStop) return null
    const departureMs = new Date(currentStop.departureTime).getTime()
    const nowMs = new Date(now).getTime()
    const remaining = departureMs - nowMs
    if (remaining <= 0) return null

    const minutes = Math.floor(remaining / 60000)
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60

    if (hours > 0) return `${hours}h ${mins}m`
    return `${mins}m`
  }

  const countdown = getCountdown()

  const formatTime = (iso: string): string => {
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  // Determine plan status message
  const getStatusMessage = (): { text: string; type: 'good' | 'warning' | 'info' } => {
    if (currentStopIndex === -1) {
      return { text: 'Your night starts soon', type: 'info' }
    }
    if (!currentStop) {
      return { text: 'Night complete!', type: 'good' }
    }

    const liveData = liveEnergyScores[currentStop.venueId]
    if (liveData) {
      const ENERGY_VALUES: Record<EnergyRating, number> = { dead: 0, chill: 1, buzzing: 2, electric: 3 }
      if (ENERGY_VALUES[liveData.energy] >= 2) {
        return { text: 'Plan is on track', type: 'good' }
      }
      if (ENERGY_VALUES[liveData.energy] <= 0) {
        return { text: 'Consider switching spots', type: 'warning' }
      }
    }
    return { text: 'Plan is on track', type: 'good' }
  }

  const status = getStatusMessage()

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={onBack} className="p-1">
            <CaretLeft size={24} weight="bold" />
          </button>
          <div className="flex-1">
            <h1 className="font-bold text-lg">Live Plan</h1>
            <p className="text-xs text-muted-foreground">
              {plan.stops.length} stops &middot; {plan.groupSize} people
            </p>
          </div>
          {countdown && (
            <div className="bg-primary/10 border border-primary/20 rounded-lg px-3 py-1.5">
              <p className="text-xs text-muted-foreground">Next move in</p>
              <p className="text-sm font-bold text-primary">{countdown}</p>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* Status Banner */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-xl p-3 flex items-center gap-3 ${
            status.type === 'good'
              ? 'bg-green-500/10 border border-green-500/20'
              : status.type === 'warning'
              ? 'bg-amber-500/10 border border-amber-500/20'
              : 'bg-blue-500/10 border border-blue-500/20'
          }`}
        >
          {status.type === 'good' && <CheckCircle size={20} weight="fill" className="text-green-500" />}
          {status.type === 'warning' && <Warning size={20} weight="fill" className="text-amber-500" />}
          {status.type === 'info' && <Clock size={20} weight="fill" className="text-blue-500" />}
          <span className="text-sm font-medium">{status.text}</span>
        </motion.div>

        {/* Swap Suggestions */}
        <AnimatePresence>
          {swapSuggestions.map(suggestion => (
            <motion.div
              key={suggestion.stopIndex}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 space-y-3"
            >
              <div className="flex items-start gap-2">
                <Warning size={18} weight="fill" className="text-amber-500 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{suggestion.reason}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleAcceptSwap(suggestion)}
                  className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium"
                >
                  Switch to {suggestion.suggestedVenue.name}
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleDismissSwap(suggestion.stopIndex)}
                  className="px-4 py-2 rounded-lg bg-card border border-border text-sm"
                >
                  Keep
                </motion.button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Current Stop (highlighted) */}
        {currentStop && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Now</h3>
            <TrackerStopCard
              stop={currentStop}
              isCurrent={true}
              isCompleted={false}
              liveEnergy={liveEnergyScores[currentStop.venueId]}
              formatTime={formatTime}
              onVenueClick={() => {
                const venue = venues.find(v => v.id === currentStop.venueId)
                if (venue) onVenueClick(venue)
              }}
            />
          </div>
        )}

        {/* Next Stop Preview */}
        {nextStop && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {nextStop.transitMode === 'walk' ? (
                <PersonSimpleWalk size={14} />
              ) : (
                <Car size={14} />
              )}
              <span>{nextStop.transitDuration} min {nextStop.transitMode === 'walk' ? 'walk' : 'ride'}</span>
              {nextStop.transitDeepLink && nextStop.transitMode !== 'walk' && (
                <a
                  href={nextStop.transitDeepLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary font-medium hover:underline ml-1"
                >
                  Open Uber
                </a>
              )}
            </div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Up Next</h3>
            <TrackerStopCard
              stop={nextStop}
              isCurrent={false}
              isCompleted={false}
              liveEnergy={liveEnergyScores[nextStop.venueId]}
              formatTime={formatTime}
              onVenueClick={() => {
                const venue = venues.find(v => v.id === nextStop.venueId)
                if (venue) onVenueClick(venue)
              }}
            />
          </div>
        )}

        {/* Full Timeline */}
        <div className="space-y-2 pt-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Full Timeline</h3>
          <div className="space-y-1">
            {plan.stops.map((stop, i) => {
              const isCompleted = i < currentStopIndex
              const isCurrent = i === currentStopIndex

              return (
                <div
                  key={`${stop.venueId}-${i}`}
                  className={`flex items-center gap-3 py-2 px-3 rounded-lg transition-colors ${
                    isCurrent ? 'bg-primary/10' : isCompleted ? 'opacity-50' : ''
                  }`}
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    isCurrent
                      ? 'bg-primary text-primary-foreground'
                      : isCompleted
                      ? 'bg-green-500/20 text-green-500'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {isCompleted ? '✓' : i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${isCurrent ? 'text-primary' : ''}`}>
                      {stop.venueName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatTime(stop.arrivalTime)} - {formatTime(stop.departureTime)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <EnergyDot energy={liveEnergyScores[stop.venueId]?.energy ?? stop.energyPrediction} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function TrackerStopCard({
  stop,
  isCurrent,
  isCompleted: _isCompleted,
  liveEnergy,
  formatTime,
  onVenueClick,
}: {
  stop: import('@/lib/night-planner').PlanStop
  isCurrent: boolean
  isCompleted: boolean
  liveEnergy?: { energy: EnergyRating; score: number }
  formatTime: (iso: string) => string
  onVenueClick: () => void
}) {
  const energy = liveEnergy?.energy ?? stop.energyPrediction
  const energyConfig = ENERGY_CONFIG[energy]

  const purposeLabels: Record<string, string> = {
    dinner: 'Dinner',
    drinks: 'Drinks',
    dancing: 'Dancing',
    latenight: 'Late Night',
  }

  return (
    <motion.div
      layout
      className={`rounded-xl p-4 border transition-colors ${
        isCurrent
          ? 'bg-primary/5 border-primary/30 shadow-lg shadow-primary/10'
          : 'bg-card border-border'
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {purposeLabels[stop.purpose] ?? stop.purpose}
          </span>
          <button onClick={onVenueClick} className="block">
            <h3 className="font-bold text-lg hover:text-primary transition-colors">{stop.venueName}</h3>
          </button>
        </div>
        {isCurrent && (
          <div className="bg-primary/20 rounded-full px-2.5 py-1 flex items-center gap-1">
            <Lightning size={12} weight="fill" className="text-primary" />
            <span className="text-xs font-bold text-primary">HERE</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
        <span className="flex items-center gap-1">
          <Clock size={14} />
          {formatTime(stop.arrivalTime)} - {formatTime(stop.departureTime)}
        </span>
        <span className="flex items-center gap-1">
          <MapPin size={14} />
          ~${stop.estimatedSpend}
        </span>
      </div>

      {/* Live Energy Indicator */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">
          {liveEnergy ? 'Live Vibe:' : 'Predicted:'}
        </span>
        <div
          className="px-2.5 py-1 rounded-full text-xs font-medium"
          style={{
            backgroundColor: `${energyConfig.color}22`,
            color: energyConfig.color,
          }}
        >
          {energyConfig.emoji} {energyConfig.label}
        </div>
        {liveEnergy && (
          <span className="text-xs text-muted-foreground">
            Score: {liveEnergy.score}
          </span>
        )}
        <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs text-muted-foreground">
          <ChatCircleDots size={12} />
          {stop.groupVote.yes} yes
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs text-muted-foreground">
          <ShieldCheck size={12} />
          Entry {stop.entryConfidence}%
        </span>
        {stop.rideSplitEstimate > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs text-muted-foreground">
            <CurrencyDollar size={12} />
            Ride split ~${stop.rideSplitEstimate}/pp
          </span>
        )}
      </div>
    </motion.div>
  )
}

function EnergyDot({ energy }: { energy: EnergyRating }) {
  const config = ENERGY_CONFIG[energy]
  return (
    <div
      className="w-2.5 h-2.5 rounded-full"
      style={{ backgroundColor: config.color }}
      title={config.label}
    />
  )
}
