import { useState, useMemo } from 'react'
import type { Venue, Pulse, User, EnergyRating } from '@/lib/types'
import { ENERGY_CONFIG } from '@/lib/types'
import type { Crew } from '@/lib/crew-mode'
import { getUserCrews } from '@/lib/crew-mode'
import {
  generateNightPlan,
  getTotalEstimatedSpend,
  PLANNER_VIBES,
  VENUE_TYPES,
} from '@/lib/night-planner'
import type { NightPlan, PlanStop, PlanPreferences } from '@/lib/night-planner'
import { LivePlanTracker } from '@/components/LivePlanTracker'
import { CaretLeft, UsersThree, Sparkle, CurrencyDollar, Clock, ArrowsClockwise, LockSimple, ShareNetwork, MapPin, Car, PersonSimpleWalk, ChatCircleDots, ShieldCheck } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { Slider } from '@/components/ui/slider'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'

type PlannerStep = 'who' | 'vibe' | 'budget' | 'plan'

interface NightPlannerPageProps {
  currentUser: User
  allUsers: User[]
  venues: Venue[]
  pulses: Pulse[]
  crews: Crew[]
  userLocation?: { lat: number; lng: number } | null
  onBack: () => void
  onVenueClick: (venue: Venue) => void
}

export function NightPlannerPage({
  currentUser,
  allUsers,
  venues,
  pulses,
  crews,
  userLocation,
  onBack,
  onVenueClick,
}: NightPlannerPageProps) {
  const [step, setStep] = useState<PlannerStep>('who')
  const [groupSize, setGroupSize] = useState(2)
  const [selectedCrewId, setSelectedCrewId] = useState<string | null>(null)
  const [selectedVibes, setSelectedVibes] = useState<string[]>([])
  const [selectedVenueTypes, setSelectedVenueTypes] = useState<string[]>([])
  const [budget, setBudget] = useState(100)
  const [startHour, setStartHour] = useState(20)
  const [endHour, setEndHour] = useState(2)
  const [generatedPlan, setGeneratedPlan] = useState<NightPlan | null>(null)
  const [lockedStops, setLockedStops] = useState<Set<number>>(new Set())
  const [showTracker, setShowTracker] = useState(false)

  const userCrews = useMemo(
    () => getUserCrews(crews, currentUser.id),
    [crews, currentUser.id]
  )

  const handleVibeToggle = (vibeId: string) => {
    setSelectedVibes(prev =>
      prev.includes(vibeId) ? prev.filter(v => v !== vibeId) : [...prev, vibeId]
    )
  }

  const handleVenueTypeToggle = (typeId: string) => {
    setSelectedVenueTypes(prev =>
      prev.includes(typeId) ? prev.filter(t => t !== typeId) : [...prev, typeId]
    )
  }

  const handleCrewSelect = (crewId: string) => {
    if (selectedCrewId === crewId) {
      setSelectedCrewId(null)
      setGroupSize(2)
    } else {
      const crew = crews.find(c => c.id === crewId)
      if (crew) {
        setSelectedCrewId(crewId)
        setGroupSize(crew.memberIds.length)
      }
    }
  }

  const buildStartTime = (): string => {
    const now = new Date()
    const date = new Date(now)
    date.setHours(startHour, 0, 0, 0)
    if (startHour < 12 && now.getHours() >= 12) {
      // If start is AM and current is PM, it's tomorrow
      date.setDate(date.getDate() + 1)
    }
    return date.toISOString()
  }

  const buildEndTime = (): string => {
    const start = new Date(buildStartTime())
    const end = new Date(start)
    end.setHours(endHour, 0, 0, 0)
    if (endHour <= startHour) {
      // End is next day
      end.setDate(end.getDate() + 1)
    }
    return end.toISOString()
  }

  const handleGenerate = () => {
    const location = userLocation ?? { lat: 40.7128, lng: -74.006 }

    const preferences: PlanPreferences = {
      vibes: selectedVibes,
      musicGenres: [],
      venueTypes: selectedVenueTypes,
      avoidCategories: [],
    }

    const locked = generatedPlan
      ? generatedPlan.stops.filter((_, i) => lockedStops.has(i))
      : undefined

    const plan = generateNightPlan(
      {
        groupSize,
        budget,
        preferences,
        location,
        startTime: buildStartTime(),
        endTime: buildEndTime(),
        userId: currentUser.id,
        crewId: selectedCrewId ?? undefined,
        lockedStops: locked,
      },
      venues,
      pulses,
      currentUser
    )

    setGeneratedPlan(plan)
    setStep('plan')
  }

  const handleShuffle = () => {
    // Keep locked stops, regenerate others
    handleGenerate()
    toast.success('Plan shuffled!')
  }

  const handleToggleLock = (index: number) => {
    setLockedStops(prev => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  const handleSharePlan = () => {
    toast.success('Plan shared with your crew!', {
      description: 'Votes, ETAs, and split ride costs are ready to compare.',
    })
  }

  const handleActivatePlan = () => {
    if (generatedPlan) {
      setGeneratedPlan({ ...generatedPlan, status: 'active' })
      setShowTracker(true)
    }
  }

  const formatHour = (h: number): string => {
    if (h === 0 || h === 24) return '12 AM'
    if (h === 12) return '12 PM'
    if (h > 12) return `${h - 12} PM`
    return `${h} AM`
  }

  const formatTime = (iso: string): string => {
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  if (showTracker && generatedPlan) {
    return (
      <LivePlanTracker
        plan={generatedPlan}
        venues={venues}
        pulses={pulses}
        currentUser={currentUser}
        onBack={() => setShowTracker(false)}
        onVenueClick={onVenueClick}
      />
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={step === 'who' ? onBack : () => {
            const steps: PlannerStep[] = ['who', 'vibe', 'budget', 'plan']
            const idx = steps.indexOf(step)
            if (idx > 0) setStep(steps[idx - 1])
          }} className="p-1">
            <CaretLeft size={24} weight="bold" />
          </button>
          <div className="flex-1">
            <h1 className="font-bold text-lg flex items-center gap-2">
              <Sparkle size={22} weight="fill" className="text-primary" />
              Night Planner
            </h1>
          </div>
          {/* Step indicator */}
          <div className="flex gap-1.5">
            {(['who', 'vibe', 'budget', 'plan'] as PlannerStep[]).map((s, i) => (
              <div
                key={s}
                className={`w-2 h-2 rounded-full transition-colors ${
                  s === step ? 'bg-primary' : i < ['who', 'vibe', 'budget', 'plan'].indexOf(step) ? 'bg-primary/50' : 'bg-muted'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        <AnimatePresence mode="wait">
          {step === 'who' && (
            <motion.div
              key="who"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div>
                <h2 className="text-2xl font-bold mb-1">Who's Coming?</h2>
                <p className="text-muted-foreground text-sm">Select your crew or set group size</p>
              </div>

              {/* Crew Selection */}
              {userCrews.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Your Crews</h3>
                  <div className="space-y-2">
                    {userCrews.map(crew => (
                      <motion.button
                        key={crew.id}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleCrewSelect(crew.id)}
                        className={`w-full p-4 rounded-xl border text-left transition-colors ${
                          selectedCrewId === crew.id
                            ? 'bg-primary/10 border-primary/50'
                            : 'bg-card border-border hover:border-primary/30'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            selectedCrewId === crew.id ? 'bg-primary/20' : 'bg-muted'
                          }`}>
                            <UsersThree size={20} weight="fill" className={selectedCrewId === crew.id ? 'text-primary' : 'text-muted-foreground'} />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">{crew.name}</p>
                            <p className="text-xs text-muted-foreground">{crew.memberIds.length} members</p>
                          </div>
                          {selectedCrewId === crew.id && (
                            <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                              <span className="text-xs text-primary-foreground font-bold">&#10003;</span>
                            </div>
                          )}
                        </div>
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}

              {/* Manual Group Size */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                  {userCrews.length > 0 ? 'Or set group size' : 'Group Size'}
                </h3>
                <div className="flex items-center gap-3">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                    <motion.button
                      key={n}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => { setGroupSize(n); setSelectedCrewId(null) }}
                      className={`w-10 h-10 rounded-full font-bold text-sm transition-colors ${
                        groupSize === n && !selectedCrewId
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-card border border-border text-foreground hover:border-primary/30'
                      }`}
                    >
                      {n}
                    </motion.button>
                  ))}
                </div>
              </div>

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => setStep('vibe')}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm"
              >
                Next: Set the Vibe
              </motion.button>
            </motion.div>
          )}

          {step === 'vibe' && (
            <motion.div
              key="vibe"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div>
                <h2 className="text-2xl font-bold mb-1">What's the Vibe?</h2>
                <p className="text-muted-foreground text-sm">Pick your mood for tonight</p>
              </div>

              {/* Vibe Pills */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Mood</h3>
                <div className="flex flex-wrap gap-2">
                  {PLANNER_VIBES.map(vibe => (
                    <motion.button
                      key={vibe.id}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleVibeToggle(vibe.id)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                        selectedVibes.includes(vibe.id)
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-card border border-border text-foreground hover:border-primary/30'
                      }`}
                    >
                      {vibe.emoji} {vibe.label}
                    </motion.button>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Venue Types */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Venue Types</h3>
                <div className="flex flex-wrap gap-2">
                  {VENUE_TYPES.map(type => (
                    <motion.button
                      key={type.id}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleVenueTypeToggle(type.id)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                        selectedVenueTypes.includes(type.id)
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-card border border-border text-foreground hover:border-primary/30'
                      }`}
                    >
                      {type.label}
                    </motion.button>
                  ))}
                </div>
              </div>

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => setStep('budget')}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm"
              >
                Next: Budget & Time
              </motion.button>
            </motion.div>
          )}

          {step === 'budget' && (
            <motion.div
              key="budget"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div>
                <h2 className="text-2xl font-bold mb-1">Budget & Time</h2>
                <p className="text-muted-foreground text-sm">Set your spending and schedule</p>
              </div>

              {/* Budget Slider */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Budget per Person</h3>
                  <span className="text-xl font-bold text-primary">${budget}</span>
                </div>
                <Slider
                  value={[budget]}
                  onValueChange={([val]) => setBudget(val)}
                  min={50}
                  max={500}
                  step={10}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>$50</span>
                  <span>$500</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Total for {groupSize} people: <span className="font-bold text-foreground">${budget * groupSize}</span>
                </p>
              </div>

              <Separator />

              {/* Time Selection */}
              <div className="space-y-4">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Time Window</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground flex items-center gap-1">
                      <Clock size={14} />
                      Start Time
                    </label>
                    <select
                      value={startHour}
                      onChange={e => setStartHour(Number(e.target.value))}
                      className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm"
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 16).map(h => {
                        const displayH = h > 23 ? h - 24 : h
                        return (
                          <option key={h} value={displayH}>{formatHour(displayH)}</option>
                        )
                      })}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground flex items-center gap-1">
                      <Clock size={14} />
                      End Time
                    </label>
                    <select
                      value={endHour}
                      onChange={e => setEndHour(Number(e.target.value))}
                      className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm"
                    >
                      {[22, 23, 0, 1, 2, 3, 4].map(h => (
                        <option key={h} value={h}>{formatHour(h)}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleGenerate}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2"
              >
                <Sparkle size={18} weight="fill" />
                Generate Night Plan
              </motion.button>
            </motion.div>
          )}

          {step === 'plan' && generatedPlan && (
            <motion.div
              key="plan"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold mb-1">Your Night Plan</h2>
                  <p className="text-muted-foreground text-sm">
                    {generatedPlan.stops.length} stops &middot; {groupSize} people &middot; ~${getTotalEstimatedSpend(generatedPlan)}/person
                  </p>
                </div>
                <div className="flex gap-2">
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={handleShuffle}
                    className="p-2 rounded-lg bg-card border border-border hover:border-primary/30"
                    title="Shuffle plan"
                  >
                    <ArrowsClockwise size={20} />
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={handleSharePlan}
                    className="p-2 rounded-lg bg-card border border-border hover:border-primary/30"
                    title="Share plan"
                  >
                    <ShareNetwork size={20} />
                  </motion.button>
                </div>
              </div>

              {/* Timeline */}
              <div className="relative">
                {generatedPlan.stops.map((stop, i) => (
                  <div key={`${stop.venueId}-${i}`}>
                    {/* Transit indicator (between stops) */}
                    {i > 0 && (
                      <TransitIndicator stop={stop} />
                    )}
                    {/* Stop card */}
                    <StopCard
                      stop={stop}
                      index={i}
                      isLocked={lockedStops.has(i)}
                      onToggleLock={() => handleToggleLock(i)}
                      onVenueClick={() => {
                        const venue = venues.find(v => v.id === stop.venueId)
                        if (venue) onVenueClick(venue)
                      }}
                      formatTime={formatTime}
                    />
                  </div>
                ))}
              </div>

              {/* Total */}
              <div className="bg-card rounded-xl p-4 border border-border">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Estimated Cost</span>
                  <div className="text-right">
                    <p className="font-bold text-lg">${getTotalEstimatedSpend(generatedPlan) * groupSize}</p>
                    <p className="text-xs text-muted-foreground">${getTotalEstimatedSpend(generatedPlan)} per person</p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleActivatePlan}
                  className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2"
                >
                  <Sparkle size={18} weight="fill" />
                  Start This Night
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleShuffle}
                  className="w-full py-3 rounded-xl bg-card border border-border text-foreground font-bold text-sm flex items-center justify-center gap-2"
                >
                  <ArrowsClockwise size={18} />
                  Shuffle Plan
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function StopCard({
  stop,
  index,
  isLocked,
  onToggleLock,
  onVenueClick,
  formatTime,
}: {
  stop: PlanStop
  index: number
  isLocked: boolean
  onToggleLock: () => void
  onVenueClick: () => void
  formatTime: (iso: string) => string
}) {
  const purposeLabels: Record<string, string> = {
    dinner: 'Dinner',
    drinks: 'Drinks',
    dancing: 'Dancing',
    latenight: 'Late Night',
  }

  const purposeColors: Record<string, string> = {
    dinner: 'from-orange-500/20 to-amber-500/20 border-orange-500/20',
    drinks: 'from-blue-500/20 to-cyan-500/20 border-blue-500/20',
    dancing: 'from-purple-500/20 to-pink-500/20 border-purple-500/20',
    latenight: 'from-indigo-500/20 to-violet-500/20 border-indigo-500/20',
  }

  const energyConfig = ENERGY_CONFIG[stop.energyPrediction]

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="relative"
    >
      {/* Timeline dot */}
      <div className="flex gap-3">
        <div className="flex flex-col items-center">
          <div className="w-8 h-8 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center text-xs font-bold text-primary">
            {index + 1}
          </div>
          {/* Timeline line continues below via TransitIndicator */}
        </div>

        <div className={`flex-1 bg-gradient-to-br ${purposeColors[stop.purpose] ?? purposeColors.drinks} rounded-xl p-4 border mb-2`}>
          <div className="flex items-start justify-between mb-2">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {purposeLabels[stop.purpose] ?? stop.purpose}
              </span>
              <button onClick={onVenueClick} className="block">
                <h3 className="font-bold text-base hover:text-primary transition-colors">{stop.venueName}</h3>
              </button>
            </div>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={onToggleLock}
              className={`p-1.5 rounded-lg transition-colors ${
                isLocked ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
              title={isLocked ? 'Unlock this stop' : 'Lock this stop'}
            >
              <LockSimple size={16} weight={isLocked ? 'fill' : 'regular'} />
            </motion.button>
          </div>

          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
            <span className="flex items-center gap-1">
              <Clock size={14} />
              {formatTime(stop.arrivalTime)} - {formatTime(stop.departureTime)}
            </span>
            <span className="flex items-center gap-1">
              <CurrencyDollar size={14} />
              ~${stop.estimatedSpend}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div
              className="px-2 py-0.5 rounded-full text-xs font-medium"
              style={{
                backgroundColor: `${energyConfig.color}22`,
                color: energyConfig.color,
              }}
            >
              {energyConfig.emoji} {energyConfig.label}
            </div>
            {stop.venueCategory && (
              <span className="text-xs text-muted-foreground">
                {stop.venueCategory}
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-full bg-card/60 px-2 py-0.5 text-xs text-muted-foreground">
              <ChatCircleDots size={12} />
              {stop.groupVote.yes} yes{stop.groupVote.maybe > 0 ? ` • ${stop.groupVote.maybe} maybe` : ''}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-card/60 px-2 py-0.5 text-xs text-muted-foreground">
              <Car size={12} />
              ETA {stop.etaMinutes}m
            </span>
            {stop.rideSplitEstimate > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-card/60 px-2 py-0.5 text-xs text-muted-foreground">
                <CurrencyDollar size={12} />
                Ride split ~${stop.rideSplitEstimate}/pp
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-full bg-card/60 px-2 py-0.5 text-xs text-muted-foreground">
              <ShieldCheck size={12} />
              Entry {stop.entryConfidence}%
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

function TransitIndicator({ stop }: { stop: PlanStop }) {
  const isWalk = stop.transitMode === 'walk'

  return (
    <div className="flex gap-3 mb-2">
      <div className="flex flex-col items-center">
        <div className="w-px h-8 bg-border" />
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
        {isWalk ? (
          <PersonSimpleWalk size={14} />
        ) : (
          <Car size={14} />
        )}
        <span>{stop.transitDuration} min {isWalk ? 'walk' : 'ride'}</span>
        {stop.transitDeepLink && !isWalk && (
          <a
            href={stop.transitDeepLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary font-medium hover:underline"
            onClick={e => e.stopPropagation()}
          >
            Open Uber
          </a>
        )}
      </div>
    </div>
  )
}
