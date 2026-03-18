import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  ArrowLeft, BeerStein, MusicNotes, Confetti, Clock,
  Sparkle, Star, Rocket, Check,
} from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { Venue } from '@/lib/types'
import {
  type BoostType,
  type ActiveBoost,
  BOOST_CONFIGS,
  formatBoostDuration,
  estimateReach,
  simulateBoostAnalytics,
} from '@/lib/venue-quick-boost'

// ─── Icon Map ───────────────────────────────────────────────────

const BOOST_ICONS: Record<string, React.ComponentType<{ size?: number; weight?: 'fill' | 'regular' | 'bold'; className?: string }>> = {
  BeerStein,
  MusicNotes,
  Confetti,
  Clock,
  Sparkle,
  Star,
}

// ─── Props ──────────────────────────────────────────────────────

interface QuickBoostFlowProps {
  venue: Venue
  recommendedType: BoostType | null
  canBoost: boolean
  onCreateBoost: (venueId: string, type: BoostType, duration: number) => ActiveBoost | null
  onBack: () => void
}

// ─── Step Animation Variants ────────────────────────────────────

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 200 : -200,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -200 : 200,
    opacity: 0,
  }),
}

// ─── Component ──────────────────────────────────────────────────

export function QuickBoostFlow({
  venue,
  recommendedType,
  canBoost,
  onCreateBoost,
  onBack,
}: QuickBoostFlowProps) {
  const [step, setStep] = useState(1)
  const [direction, setDirection] = useState(1)
  const [selectedType, setSelectedType] = useState<BoostType | null>(null)
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null)
  const [createdBoost, setCreatedBoost] = useState<ActiveBoost | null>(null)
  const [liveImpressions, setLiveImpressions] = useState(0)
  const prefersReducedMotion = useReducedMotion()

  // Auto-increment impressions in success state
  useEffect(() => {
    if (!createdBoost) return
    const interval = setInterval(() => {
      setLiveImpressions(prev => prev + Math.floor(Math.random() * 3) + 1)
    }, 2000)
    return () => clearInterval(interval)
  }, [createdBoost])

  const config = selectedType ? BOOST_CONFIGS[selectedType] : null

  const estimatedImpressions = useMemo(() => {
    if (!selectedType || !selectedDuration) return 0
    return estimateReach(selectedType, selectedDuration, venue.pulseScore)
  }, [selectedType, selectedDuration, venue.pulseScore])

  const goNext = () => {
    setDirection(1)
    setStep(s => s + 1)
  }

  const goBack = () => {
    if (step === 1) {
      onBack()
      return
    }
    setDirection(-1)
    setStep(s => s - 1)
  }

  const handleSelectType = (type: BoostType) => {
    setSelectedType(type)
    setSelectedDuration(BOOST_CONFIGS[type].defaultDuration)
    goNext()
  }

  const handleSelectDuration = (duration: number) => {
    setSelectedDuration(duration)
    goNext()
  }

  const handleConfirm = () => {
    if (!selectedType || !selectedDuration) return
    const boost = onCreateBoost(venue.id, selectedType, selectedDuration)
    if (boost) {
      setCreatedBoost(boost)
      setDirection(1)
      setStep(4)
    }
  }

  // ─── Success State ──────────────────────────────────────────

  if (step === 4 && createdBoost) {
    const analytics = simulateBoostAnalytics(createdBoost, venue.pulseScore)
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border px-4 py-3">
          <div className="flex items-center gap-3 max-w-2xl mx-auto">
            <button onClick={onBack} className="p-1 hover:bg-muted/50 rounded-md transition-colors" aria-label="Go back to dashboard">
              <ArrowLeft size={20} className="text-foreground" aria-hidden="true" />
            </button>
            <h1 className="text-sm font-bold text-foreground">Boost Active</h1>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-6 max-w-2xl mx-auto w-full">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            className="mb-6"
          >
            <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center">
              <Rocket size={40} weight="fill" className="text-green-400" />
            </div>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg font-bold text-foreground mb-1"
          >
            Your venue is now boosted!
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-xs text-muted-foreground mb-6"
          >
            {BOOST_CONFIGS[createdBoost.type].label} boost is live for {venue.name}
          </motion.p>

          {/* Live impression counter */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="p-6 bg-card/80 border-border text-center mb-4 w-full">
              <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">Live Impressions</p>
              <p className="text-3xl font-bold text-foreground tabular-nums" aria-live="polite" aria-atomic="true">
                {liveImpressions.toLocaleString()}
              </p>
              <div className="flex items-center justify-center gap-1 mt-1">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-[10px] text-green-400">Boosting now</span>
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="grid grid-cols-3 gap-3 w-full"
          >
            <div className="text-center">
              <p className="text-sm font-bold text-foreground">{analytics.totalImpressions.toLocaleString()}</p>
              <p className="text-[9px] text-muted-foreground">Est. Reach</p>
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-foreground">{analytics.totalTaps}</p>
              <p className="text-[9px] text-muted-foreground">Est. Taps</p>
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-foreground">+{analytics.comparedToAverage}%</p>
              <p className="text-[9px] text-muted-foreground">vs Average</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-8 w-full"
          >
            <button
              onClick={onBack}
              className="w-full py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Back to Dashboard
            </button>
          </motion.div>

          {/* Confetti particles */}
          {!prefersReducedMotion && Array.from({ length: 12 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 rounded-full"
              style={{
                backgroundColor: ['oklch(0.70 0.22 60)', 'oklch(0.65 0.28 340)', 'oklch(0.70 0.18 80)', 'oklch(0.65 0.25 300)'][i % 4],
                left: `${20 + Math.random() * 60}%`,
                top: '30%',
              }}
              initial={{ y: 0, opacity: 1, scale: 1 }}
              animate={{
                y: [0, -60 - Math.random() * 80, 200 + Math.random() * 100],
                x: [(Math.random() - 0.5) * 100, (Math.random() - 0.5) * 150],
                opacity: [1, 1, 0],
                scale: [1, 1.2, 0.5],
                rotate: [0, Math.random() * 360],
              }}
              transition={{ duration: 1.5 + Math.random(), delay: i * 0.05, ease: 'easeOut' }}
            />
          ))}
        </div>
      </div>
    )
  }

  // ─── Wizard Steps ─────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border px-4 py-3">
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <button onClick={goBack} className="p-1 hover:bg-muted/50 rounded-md transition-colors" aria-label={step === 1 ? 'Go back' : 'Go to previous step'}>
            <ArrowLeft size={20} className="text-foreground" aria-hidden="true" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold text-foreground">Quick Boost</h1>
            <p className="text-[10px] text-muted-foreground">{venue.name}</p>
          </div>
        </div>
      </div>

      {/* Progress Dots */}
      <div
        className="flex items-center justify-center gap-2 py-4"
        role="progressbar"
        aria-valuenow={step}
        aria-valuemin={1}
        aria-valuemax={3}
        aria-label={`Step ${step} of 3`}
      >
        {[1, 2, 3].map(s => (
          <div
            key={s}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              s === step
                ? 'bg-primary w-6'
                : s < step
                  ? 'bg-primary/60'
                  : 'bg-muted'
            }`}
            aria-hidden="true"
          />
        ))}
      </div>

      {/* Step Content */}
      <div className="flex-1 px-4 max-w-2xl mx-auto w-full overflow-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          {/* Step 1: Select Type */}
          {step === 1 && (
            <motion.div
              key="step1"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="space-y-3"
            >
              <div className="mb-4">
                <h2 className="text-base font-bold text-foreground">Choose Boost Type</h2>
                <p className="text-xs text-muted-foreground">Select how you want to promote your venue</p>
              </div>

              {!canBoost && (
                <Card className="p-3 bg-destructive/10 border-destructive/20">
                  <p className="text-xs text-destructive">
                    Maximum 2 active boosts per venue. Cancel an existing boost first.
                  </p>
                </Card>
              )}

              <div className="grid grid-cols-2 gap-3">
                {(Object.keys(BOOST_CONFIGS) as BoostType[]).map(type => {
                  const cfg = BOOST_CONFIGS[type]
                  const Icon = BOOST_ICONS[cfg.icon] ?? Star
                  const isRecommended = type === recommendedType

                  return (
                    <motion.button
                      key={type}
                      whileTap={{ scale: 0.95 }}
                      disabled={!canBoost}
                      onClick={() => handleSelectType(type)}
                      className={`relative p-4 rounded-xl border text-left transition-colors ${
                        canBoost
                          ? 'bg-card/80 border-border hover:border-primary/50 hover:bg-card'
                          : 'bg-card/40 border-border/50 opacity-50 cursor-not-allowed'
                      }`}
                    >
                      {isRecommended && (
                        <Badge className="absolute -top-2 -right-2 bg-accent text-accent-foreground text-[8px] px-1.5">
                          Suggested
                        </Badge>
                      )}
                      <Icon size={24} weight="fill" className="mb-2" style={{ color: cfg.pinColor }} />
                      <p className="text-xs font-bold text-foreground">{cfg.label}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{cfg.description}</p>
                    </motion.button>
                  )
                })}
              </div>
            </motion.div>
          )}

          {/* Step 2: Select Duration */}
          {step === 2 && config && (
            <motion.div
              key="step2"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="space-y-4"
            >
              <div className="mb-4">
                <h2 className="text-base font-bold text-foreground">Select Duration</h2>
                <p className="text-xs text-muted-foreground">How long should the {config.label} boost run?</p>
              </div>

              <div className="flex flex-wrap gap-2">
                {config.durationOptions.map(duration => {
                  const isSelected = selectedDuration === duration
                  const reach = estimateReach(config.type, duration, venue.pulseScore)

                  return (
                    <motion.button
                      key={duration}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleSelectDuration(duration)}
                      className={`flex-1 min-w-[100px] py-3 px-4 rounded-xl border transition-all ${
                        isSelected
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card/80 border-border text-foreground hover:border-primary/50'
                      }`}
                    >
                      <p className="text-sm font-bold">{formatBoostDuration(duration)}</p>
                      <p className={`text-[10px] mt-0.5 ${isSelected ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                        ~{reach.toLocaleString()} reach
                      </p>
                    </motion.button>
                  )
                })}
              </div>
            </motion.div>
          )}

          {/* Step 3: Confirm */}
          {step === 3 && config && selectedDuration && (
            <motion.div
              key="step3"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="space-y-4"
            >
              <div className="mb-4">
                <h2 className="text-base font-bold text-foreground">Confirm Boost</h2>
                <p className="text-xs text-muted-foreground">Review your boost details before launching</p>
              </div>

              <Card className="p-4 bg-card/80 border-border space-y-3">
                <div className="flex items-center gap-3">
                  {(() => {
                    const Icon = BOOST_ICONS[config.icon] ?? Star
                    return <Icon size={28} weight="fill" style={{ color: config.pinColor }} />
                  })()}
                  <div>
                    <p className="text-sm font-bold text-foreground">{config.label}</p>
                    <p className="text-[10px] text-muted-foreground">{venue.name}</p>
                  </div>
                </div>

                <div className="h-px bg-border" />

                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Duration</span>
                    <span className="text-foreground font-medium">{formatBoostDuration(selectedDuration)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Est. Impressions</span>
                    <span className="text-foreground font-medium">{estimatedImpressions.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Starts</span>
                    <span className="text-foreground font-medium">Immediately</span>
                  </div>
                </div>
              </Card>

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleConfirm}
                className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
              >
                <Rocket size={18} weight="fill" />
                Boost Now
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default QuickBoostFlow
