import { useState } from 'react'
import { ENERGY_CONFIG } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Lightning, MapPin, Users, Fire, Compass, ArrowRight, Check } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'

interface OnboardingFlowProps {
  onComplete: (preferences: OnboardingPreferences) => void
}

export interface OnboardingPreferences {
  favoriteCategories: string[]
  preferredTimes: string[]
  enableLocation: boolean
  enableNotifications: boolean
}

const VENUE_CATEGORIES = [
  { id: 'bar', label: 'Bars & Pubs', emoji: '🍺' },
  { id: 'club', label: 'Nightclubs', emoji: '🪩' },
  { id: 'lounge', label: 'Lounges', emoji: '🍸' },
  { id: 'restaurant', label: 'Restaurants', emoji: '🍕' },
  { id: 'rooftop', label: 'Rooftop Bars', emoji: '🌆' },
  { id: 'live-music', label: 'Live Music', emoji: '🎵' },
  { id: 'sports-bar', label: 'Sports Bars', emoji: '🏈' },
  { id: 'cafe', label: 'Cafes', emoji: '☕' },
]

const TIME_PREFERENCES = [
  { id: 'happy-hour', label: 'Happy Hour', time: '4-7 PM', emoji: '🌅' },
  { id: 'dinner', label: 'Dinner Time', time: '7-9 PM', emoji: '🍽️' },
  { id: 'nightlife', label: 'Late Night', time: '9 PM - 2 AM', emoji: '🌙' },
  { id: 'weekend-brunch', label: 'Weekend Brunch', time: '10 AM - 2 PM', emoji: '🥂' },
]

const STEPS = ['welcome', 'categories', 'times', 'permissions', 'ready'] as const
type Step = typeof STEPS[number]

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [step, setStep] = useState<Step>('welcome')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedTimes, setSelectedTimes] = useState<string[]>([])
  const [locationEnabled, setLocationEnabled] = useState(false)
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)

  const currentStepIndex = STEPS.indexOf(step)

  const nextStep = () => {
    const nextIndex = currentStepIndex + 1
    if (nextIndex < STEPS.length) {
      setStep(STEPS[nextIndex])
    }
  }

  const handleComplete = () => {
    onComplete({
      favoriteCategories: selectedCategories,
      preferredTimes: selectedTimes,
      enableLocation: locationEnabled,
      enableNotifications: notificationsEnabled,
    })
  }

  const toggleCategory = (id: string) => {
    setSelectedCategories(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    )
  }

  const toggleTime = (id: string) => {
    setSelectedTimes(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    )
  }

  return (
    <main className="min-h-screen bg-background flex flex-col" aria-live="polite">
      {/* Progress bar */}
      {step !== 'welcome' && (
        <div className="px-6 pt-4">
          <div className="flex gap-1.5">
            {STEPS.slice(1).map((s, i) => (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i <= currentStepIndex - 1 ? 'bg-primary' : 'bg-secondary'
                }`}
              />
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 flex items-center justify-center p-6">
        <AnimatePresence mode="wait">
          {step === 'welcome' && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, x: -100 }}
              className="text-center space-y-8 max-w-sm"
            >
              <div className="space-y-2">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-accent mx-auto flex items-center justify-center">
                  <Lightning size={40} weight="fill" className="text-white" />
                </div>
                <h1 className="text-3xl font-bold mt-6">Welcome to Pulse</h1>
                <p className="text-foreground/75">
                  Real-time energy ratings for your city's best spots
                </p>
              </div>

              <div className="space-y-4">
                {Object.entries(ENERGY_CONFIG).map(([key, config]) => (
                  <div key={key} className="flex items-center gap-3 text-left">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: config.color }}
                    />
                    <span className="text-sm">
                      <span className="font-medium">{config.emoji} {config.label}</span>
                    </span>
                  </div>
                ))}
              </div>

              <Button size="lg" className="w-full" onClick={nextStep}>
                Get Started
                <ArrowRight size={18} className="ml-2" />
              </Button>
            </motion.div>
          )}

          {step === 'categories' && (
            <motion.div
              key="categories"
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              className="space-y-6 max-w-sm w-full"
            >
              <div className="text-center space-y-2">
                <Compass size={32} weight="fill" className="text-primary mx-auto" />
                <h2 className="text-2xl font-bold">What's your scene?</h2>
                <p className="text-sm text-foreground/75">
                  Pick your favorite types of venues (select at least 1)
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {VENUE_CATEGORIES.map(cat => {
                  const isSelected = selectedCategories.includes(cat.id)
                  return (
                    <motion.button
                      key={cat.id}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => toggleCategory(cat.id)}
                      className={`p-4 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/10'
                          : 'border-border bg-card hover:border-primary/30'
                      }`}
                    >
                      <span className="text-2xl">{cat.emoji}</span>
                      <p className="text-sm font-medium mt-2">{cat.label}</p>
                      {isSelected && (
                        <Check size={16} className="text-primary absolute top-2 right-2" />
                      )}
                    </motion.button>
                  )
                })}
              </div>

              <Button
                size="lg"
                className="w-full"
                onClick={nextStep}
                disabled={selectedCategories.length === 0}
              >
                Continue
                <ArrowRight size={18} className="ml-2" />
              </Button>
            </motion.div>
          )}

          {step === 'times' && (
            <motion.div
              key="times"
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              className="space-y-6 max-w-sm w-full"
            >
              <div className="text-center space-y-2">
                <Fire size={32} weight="fill" className="text-accent mx-auto" />
                <h2 className="text-2xl font-bold">When do you go out?</h2>
                <p className="text-sm text-foreground/75">
                  We'll tailor recommendations to your schedule
                </p>
              </div>

              <div className="space-y-3">
                {TIME_PREFERENCES.map(time => {
                  const isSelected = selectedTimes.includes(time.id)
                  return (
                    <motion.button
                      key={time.id}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => toggleTime(time.id)}
                      className={`w-full p-4 rounded-xl border flex items-center gap-4 transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/10'
                          : 'border-border bg-card hover:border-primary/30'
                      }`}
                    >
                      <span className="text-2xl">{time.emoji}</span>
                      <div className="text-left flex-1">
                        <p className="font-medium text-sm">{time.label}</p>
                        <p className="text-xs text-muted-foreground">{time.time}</p>
                      </div>
                      {isSelected && <Check size={18} className="text-primary" />}
                    </motion.button>
                  )
                })}
              </div>

              <Button size="lg" className="w-full" onClick={nextStep}>
                {selectedTimes.length > 0 ? 'Continue' : 'Skip'}
                <ArrowRight size={18} className="ml-2" />
              </Button>
            </motion.div>
          )}

          {step === 'permissions' && (
            <motion.div
              key="permissions"
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              className="space-y-6 max-w-sm w-full"
            >
              <div className="text-center space-y-2">
                <MapPin size={32} weight="fill" className="text-primary mx-auto" />
                <h2 className="text-2xl font-bold">Enable permissions</h2>
                <p className="text-sm text-foreground/75">
                  These help us show you the best nearby spots
                </p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => setLocationEnabled(!locationEnabled)}
                  className={`w-full p-4 rounded-xl border flex items-center gap-4 transition-all ${
                    locationEnabled
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-card'
                  }`}
                >
                  <div className={`p-3 rounded-full ${locationEnabled ? 'bg-primary/20' : 'bg-secondary'}`}>
                    <MapPin size={24} weight="fill" className={locationEnabled ? 'text-primary' : 'text-muted-foreground'} />
                  </div>
                  <div className="text-left flex-1">
                    <p className="font-medium text-sm">Location Access</p>
                    <p className="text-xs text-muted-foreground">Find venues near you</p>
                  </div>
                  {locationEnabled && <Check size={18} className="text-primary" />}
                </button>

                <button
                  onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                  className={`w-full p-4 rounded-xl border flex items-center gap-4 transition-all ${
                    notificationsEnabled
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-card'
                  }`}
                >
                  <div className={`p-3 rounded-full ${notificationsEnabled ? 'bg-accent/20' : 'bg-secondary'}`}>
                    <Users size={24} weight="fill" className={notificationsEnabled ? 'text-accent' : 'text-muted-foreground'} />
                  </div>
                  <div className="text-left flex-1">
                    <p className="font-medium text-sm">Notifications</p>
                    <p className="text-xs text-muted-foreground">Know when friends or venues are popping</p>
                  </div>
                  {notificationsEnabled && <Check size={18} className="text-primary" />}
                </button>
              </div>

              <Button size="lg" className="w-full" onClick={nextStep}>
                Continue
                <ArrowRight size={18} className="ml-2" />
              </Button>
            </motion.div>
          )}

          {step === 'ready' && (
            <motion.div
              key="ready"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="text-center space-y-6 max-w-sm"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.2, stiffness: 200 }}
                className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-accent mx-auto flex items-center justify-center"
              >
                <Check size={48} weight="bold" className="text-white" />
              </motion.div>

              <div className="space-y-2">
                <h2 className="text-2xl font-bold">You're all set!</h2>
                <p className="text-foreground/75">
                  Time to discover what's buzzing near you
                </p>
              </div>

              <div className="space-y-2 text-sm text-foreground/75">
                {selectedCategories.length > 0 && (
                  <p>{selectedCategories.length} venue type{selectedCategories.length > 1 ? 's' : ''} selected</p>
                )}
                {selectedTimes.length > 0 && (
                  <p>{selectedTimes.length} time preference{selectedTimes.length > 1 ? 's' : ''} set</p>
                )}
              </div>

              <Button size="lg" className="w-full" onClick={handleComplete}>
                <Lightning size={20} weight="fill" className="mr-2" />
                Start Exploring
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  )
}
