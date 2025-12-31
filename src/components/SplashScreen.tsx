import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { MapPin, Lightning } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'

interface SplashScreenProps {
  onComplete: () => void
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [step, setStep] = useState<'welcome' | 'location'>('welcome')
  const [isRequesting, setIsRequesting] = useState(false)

  const handleGetStarted = () => {
    setStep('location')
  }

  const handleRequestLocation = async () => {
    setIsRequesting(true)

    try {
      const permission = await navigator.permissions.query({ name: 'geolocation' as PermissionName })
      
      if (permission.state === 'granted') {
        setTimeout(onComplete, 800)
        return
      }

      navigator.geolocation.getCurrentPosition(
        () => {
          setTimeout(onComplete, 800)
        },
        (error) => {
          console.error('Location permission denied:', error)
          setTimeout(onComplete, 800)
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0
        }
      )
    } catch (error) {
      console.error('Permission query failed:', error)
      setTimeout(onComplete, 800)
    }
  }

  const handleSkip = () => {
    onComplete()
  }

  return (
    <div className="fixed inset-0 z-50 bg-background">
      <AnimatePresence mode="wait">
        {step === 'welcome' && (
          <motion.div
            key="welcome"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="h-full flex flex-col items-center justify-center px-8"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5, type: "spring" }}
              className="relative mb-12"
            >
              <div className="w-32 h-32 rounded-full bg-gradient-to-br from-primary via-accent to-primary animate-pulse-glow flex items-center justify-center">
                <Lightning size={64} weight="fill" className="text-background" />
              </div>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.2, 1] }}
                transition={{ delay: 0.5, duration: 0.6 }}
                className="absolute -top-2 -right-2 w-12 h-12 rounded-full bg-accent flex items-center justify-center"
              >
                <MapPin size={24} weight="fill" className="text-accent-foreground" />
              </motion.div>
            </motion.div>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="text-center space-y-6 mb-12"
            >
              <h1 className="text-5xl font-bold tracking-tight">
                <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
                  Pulse
                </span>
              </h1>
              <p className="text-xl text-foreground font-medium">
                Where the energy is
              </p>
              <p className="text-base text-muted-foreground max-w-sm leading-relaxed">
                Discover live venue energy, share the vibe, and find where it's happening right now
              </p>
            </motion.div>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.5 }}
              className="w-full max-w-sm"
            >
              <Button
                onClick={handleGetStarted}
                size="lg"
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground text-lg font-semibold h-14 rounded-xl shadow-lg shadow-primary/30"
              >
                Get Started
              </Button>
            </motion.div>
          </motion.div>
        )}

        {step === 'location' && (
          <motion.div
            key="location"
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="h-full flex flex-col items-center justify-center px-8"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.5 }}
              className="mb-12"
            >
              <div className="w-32 h-32 rounded-full bg-gradient-to-br from-accent to-primary flex items-center justify-center relative">
                <MapPin size={64} weight="fill" className="text-background" />
                <motion.div
                  animate={{
                    scale: [1, 1.3, 1],
                    opacity: [0.5, 0.2, 0.5]
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                  className="absolute inset-0 rounded-full border-4 border-accent"
                />
                <motion.div
                  animate={{
                    scale: [1, 1.6, 1],
                    opacity: [0.3, 0, 0.3]
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: 0.5
                  }}
                  className="absolute inset-0 rounded-full border-4 border-accent"
                />
              </div>
            </motion.div>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="text-center space-y-6 mb-12"
            >
              <h2 className="text-3xl font-bold">
                Enable Location
              </h2>
              <p className="text-base text-muted-foreground max-w-sm leading-relaxed">
                Pulse needs your location to show nearby venues and verify check-ins. Your location is only used when the app is open.
              </p>
              <div className="flex flex-col gap-3 text-sm text-muted-foreground pt-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <MapPin size={16} weight="fill" className="text-primary" />
                  </div>
                  <p className="text-left">Find venues near you</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                    <Lightning size={16} weight="fill" className="text-accent" />
                  </div>
                  <p className="text-left">Post authentic energy updates</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              className="w-full max-w-sm space-y-3"
            >
              <Button
                onClick={handleRequestLocation}
                disabled={isRequesting}
                size="lg"
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground text-lg font-semibold h-14 rounded-xl shadow-lg shadow-primary/30"
              >
                {isRequesting ? 'Requesting...' : 'Allow Location'}
              </Button>
              <Button
                onClick={handleSkip}
                disabled={isRequesting}
                variant="ghost"
                size="lg"
                className="w-full text-muted-foreground hover:text-foreground"
              >
                Skip for now
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
