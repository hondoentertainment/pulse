import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { ArrowRight, CaretLeft, CheckCircle, Target } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { trapFocus, saveFocus, onEscape } from '@/lib/a11y/focus-trap'
import { trackEvent } from '@/lib/analytics'
import { useHaptics } from '@/hooks/use-haptics'
import { GOAL_OPTIONS, TRACKING_OPTIONS, useSignalStore } from '@/stores/use-signal-store'
import { SignalCheckIn } from '@/components/signal/SignalCheckIn'
import type { SignalGoal, TrackingFocus } from '@/lib/signal-insights'

const ease = [0.22, 1, 0.36, 1] as const

const slideVariants = {
  initial: (dir: number) => ({ x: dir * 20, opacity: 0 }),
  animate: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir * -20, opacity: 0 }),
}

interface SignalOnboardingProps {
  userId: string
  onFinished: () => void
}

export function SignalOnboarding({ userId, onFinished }: SignalOnboardingProps) {
  const reduceMotion = useReducedMotion()
  const { triggerSelection } = useHaptics()
  const [step, setStep] = useState(0)
  const [slideDir, setSlideDir] = useState(1)
  const onboardingStartedAt = useRef(Date.now())
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    trackEvent({ type: 'signal_onboarding_step', timestamp: Date.now(), step: step as 0 | 1 | 2, action: 'view' })
  }, [step])
  const [trackingFocus, setTrackingFocus] = useState<TrackingFocus>('energy')
  const [goal, setGoal] = useState<SignalGoal>('more_energy')
  const setProfile = useSignalStore((state) => state.setProfile)
  const saveEntry = useSignalStore((state) => state.saveEntry)

  const progress = ((step + 1) / 3) * 100

  const goNext = () => {
    trackEvent({ type: 'signal_onboarding_step', timestamp: Date.now(), step: step as 0 | 1 | 2, action: 'next' })
    setSlideDir(1)
    setStep((s) => Math.min(2, s + 1))
  }

  const goBack = () => {
    trackEvent({ type: 'signal_onboarding_step', timestamp: Date.now(), step: step as 0 | 1 | 2, action: 'back' })
    setSlideDir(-1)
    setStep((s) => Math.max(0, s - 1))
  }

  useEffect(() => {
    const container = dialogRef.current
    if (!container) return
    const restoreFocus = saveFocus()
    const releaseTrap = trapFocus(container)
    const releaseEscape = onEscape(container, () => {
      if (step > 0) goBack()
    })
    return () => {
      releaseTrap()
      releaseEscape()
      restoreFocus()
    }
  }, [step])

  const finish = () => {
    const wasFirst = useSignalStore.getState().entries.length === 0
    setProfile(userId, { trackingFocus, goal, reminderTime: '09:00' })
    saveEntry(userId, trackingFocus)
    trackEvent({
      type: 'signal_onboarding_complete',
      timestamp: Date.now(),
      durationMs: Date.now() - onboardingStartedAt.current,
      trackingFocus,
    })
    const score = useSignalStore.getState().entries[0]?.score ?? 0
    const scoreBucket: 'low' | 'mid' | 'high' = score < 40 ? 'low' : score < 70 ? 'mid' : 'high'
    trackEvent({ type: 'signal_check_in_saved', timestamp: Date.now(), isFirstEntry: wasFirst, scoreBucket })
    onFinished()
  }

  const slideTransition = { duration: reduceMotion ? 0 : 0.22, ease }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-dialog-title"
      className="fixed inset-0 z-50 overflow-y-auto bg-background/98 px-4 pb-8 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] backdrop-blur-xl"
    >
      <div className="mx-auto flex min-h-full w-full max-w-xl flex-col justify-center">
        <div className="mb-4">
          <div className="mb-3 flex items-center gap-2">
            {step > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="-ml-2 h-10 shrink-0 gap-1 rounded-xl px-2 text-muted-foreground hover:text-foreground"
                onClick={goBack}
                aria-label="Back"
              >
                <CaretLeft size={22} weight="bold" aria-hidden />
              </Button>
            ) : (
              <span className="w-10 shrink-0" aria-hidden />
            )}
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p id="onboarding-dialog-title" className="truncate text-sm font-bold text-primary">
                  Step {step + 1} of 3 — set up Pulse Signal
                </p>
                <p className="shrink-0 text-xs text-muted-foreground">Under 30s</p>
              </div>
              <Progress value={progress} className="h-1.5" />
              <div className="mt-3 flex justify-center gap-2" role="list" aria-label="Onboarding progress">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    role="listitem"
                    className={cn('h-2 w-2 rounded-full transition-colors', i === step ? 'bg-primary' : 'bg-muted')}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <AnimatePresence mode="wait" custom={slideDir}>
          {step === 0 && (
            <motion.section
              key="tracking"
              role="group"
              aria-labelledby="onboarding-tracking-title"
              custom={slideDir}
              variants={slideVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={slideTransition}
              className="space-y-5"
            >
              <div>
                <p className="mb-2 text-sm font-bold text-primary">What are you tracking?</p>
                <h1 id="onboarding-tracking-title" className="text-3xl font-black tracking-tight sm:text-4xl">
                  Pick your daily signal.
                </h1>
                <p className="mt-2 text-sm text-muted-foreground sm:text-base">Choose one state to understand first.</p>
              </div>
              <div className="grid gap-3">
                {TRACKING_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      triggerSelection()
                      setTrackingFocus(option.id)
                    }}
                    className={cn(
                      'rounded-3xl border p-4 text-left transition-all touch-manipulation tap-highlight-none active:scale-[0.99]',
                      trackingFocus === option.id
                        ? 'border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                        : 'border-border bg-card hover:bg-secondary',
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-lg font-black">{option.label}</p>
                        <p
                          className={cn(
                            'mt-1 text-sm',
                            trackingFocus === option.id ? 'text-primary-foreground/75' : 'text-muted-foreground',
                          )}
                        >
                          {option.description}
                        </p>
                      </div>
                      {trackingFocus === option.id && <CheckCircle size={24} weight="fill" />}
                    </div>
                  </button>
                ))}
              </div>
              <Button size="lg" className="h-14 w-full rounded-2xl text-base font-black" onClick={goNext}>
                Continue
                <ArrowRight size={18} weight="bold" className="ml-2" />
              </Button>
            </motion.section>
          )}

          {step === 1 && (
            <motion.section
              key="goal"
              role="group"
              aria-labelledby="onboarding-goal-title"
              custom={slideDir}
              variants={slideVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={slideTransition}
              className="space-y-5"
            >
              <div>
                <p className="mb-2 text-sm font-bold text-primary">Why does it matter?</p>
                <h1 id="onboarding-goal-title" className="text-3xl font-black tracking-tight sm:text-4xl">
                  Choose the outcome.
                </h1>
                <p className="mt-2 text-sm text-muted-foreground sm:text-base">We&apos;ll tailor tips to this goal.</p>
              </div>
              <div className="grid gap-3">
                {GOAL_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      triggerSelection()
                      setGoal(option.id)
                    }}
                    className={cn(
                      'rounded-3xl border p-4 text-left transition-all touch-manipulation tap-highlight-none active:scale-[0.99]',
                      goal === option.id
                        ? 'border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                        : 'border-border bg-card hover:bg-secondary',
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          'rounded-full p-2',
                          goal === option.id ? 'bg-primary-foreground/15' : 'bg-primary/10 text-primary',
                        )}
                      >
                        <Target size={18} weight="fill" />
                      </span>
                      <div>
                        <p className="font-black">{option.label}</p>
                        <p className={cn('mt-1 text-sm', goal === option.id ? 'text-primary-foreground/75' : 'text-muted-foreground')}>
                          {option.description}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              <Button size="lg" className="h-14 w-full rounded-2xl text-base font-black" onClick={goNext}>
                Last step
                <ArrowRight size={18} weight="bold" className="ml-2" />
              </Button>
            </motion.section>
          )}

          {step === 2 && (
            <motion.div
              key="input"
              custom={slideDir}
              variants={slideVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={slideTransition}
              className="space-y-4"
            >
              <SignalCheckIn onSave={finish} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
