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
    <div className="fixed inset-0 z-50 bg-background overflow-hidden">
      <div 
        className="absolute inset-0 opacity-30"
        style={{
          background: `
            radial-gradient(circle at 20% 30%, oklch(0.65 0.25 300 / 0.3) 0%, transparent 50%),
            radial-gradient(circle at 80% 70%, oklch(0.75 0.18 195 / 0.25) 0%, transparent 50%),
            radial-gradient(circle at 50% 50%, oklch(0.65 0.25 300 / 0.15) 0%, transparent 70%)
          `
        }}
      />
      
      <AnimatePresence mode="wait">
        {step === 'welcome' && (
          <motion.div
            key="welcome"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="h-full flex flex-col items-center justify-center px-8 relative z-10"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5, type: "spring" }}
              className="relative mb-12"
            >
              <motion.div 
                className="absolute inset-0 rounded-full blur-3xl opacity-60"
                style={{ background: 'radial-gradient(circle, oklch(0.65 0.25 300) 0%, transparent 70%)' }}
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.6, 0.4, 0.6]
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
              <div 
                className="w-32 h-32 rounded-full flex items-center justify-center relative z-10"
                style={{
                  background: 'linear-gradient(135deg, oklch(0.65 0.25 300) 0%, oklch(0.75 0.18 195) 50%, oklch(0.65 0.25 300) 100%)',
                  boxShadow: '0 0 60px oklch(0.65 0.25 300 / 0.5), inset 0 0 20px oklch(0.98 0 0 / 0.1)'
                }}
              >
                <Lightning size={64} weight="fill" className="text-background drop-shadow-lg" />
              </div>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.2, 1] }}
                transition={{ delay: 0.5, duration: 0.6 }}
                className="absolute -top-2 -right-2 w-12 h-12 rounded-full flex items-center justify-center"
                style={{
                  background: 'oklch(0.75 0.18 195)',
                  boxShadow: '0 0 30px oklch(0.75 0.18 195 / 0.6)'
                }}
              >
                <MapPin size={24} weight="fill" className="text-background" />
              </motion.div>
            </motion.div>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="text-center space-y-6 mb-12"
            >
              <h1 className="text-6xl font-bold tracking-tight">
                <span 
                  className="bg-clip-text text-transparent"
                  style={{
                    backgroundImage: 'linear-gradient(90deg, oklch(0.65 0.25 300) 0%, oklch(0.75 0.18 195) 50%, oklch(0.65 0.25 300) 100%)',
                    backgroundSize: '200% auto',
                    animation: 'gradient-shift 3s ease infinite'
                  }}
                >
                  Pulse
                </span>
              </h1>
              <p className="text-xl text-foreground font-semibold">
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
                className="w-full text-lg font-bold h-14 rounded-xl relative overflow-hidden group"
                style={{
                  background: 'oklch(0.65 0.25 300)',
                  color: 'oklch(0.98 0 0)',
                  boxShadow: '0 0 40px oklch(0.65 0.25 300 / 0.4)'
                }}
              >
                <span className="relative z-10">Get Started</span>
                <div 
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{
                    background: 'linear-gradient(90deg, oklch(0.70 0.28 300) 0%, oklch(0.65 0.25 300) 100%)'
                  }}
                />
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
            className="h-full flex flex-col items-center justify-center px-8 relative z-10"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.5 }}
              className="mb-12 relative"
            >
              <motion.div 
                className="absolute inset-0 rounded-full blur-3xl opacity-50"
                style={{ background: 'radial-gradient(circle, oklch(0.75 0.18 195) 0%, transparent 70%)' }}
                animate={{
                  scale: [1, 1.3, 1],
                  opacity: [0.5, 0.3, 0.5]
                }}
                transition={{
                  duration: 2.5,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
              <div 
                className="w-32 h-32 rounded-full flex items-center justify-center relative z-10"
                style={{
                  background: 'linear-gradient(135deg, oklch(0.75 0.18 195) 0%, oklch(0.65 0.25 300) 100%)',
                  boxShadow: '0 0 50px oklch(0.75 0.18 195 / 0.5)'
                }}
              >
                <MapPin size={64} weight="fill" className="text-background drop-shadow-lg" />
                <motion.div
                  animate={{
                    scale: [1, 1.3, 1],
                    opacity: [0.6, 0.2, 0.6]
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                  className="absolute inset-0 rounded-full border-4"
                  style={{ borderColor: 'oklch(0.75 0.18 195)' }}
                />
                <motion.div
                  animate={{
                    scale: [1, 1.6, 1],
                    opacity: [0.4, 0, 0.4]
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: 0.5
                  }}
                  className="absolute inset-0 rounded-full border-4"
                  style={{ borderColor: 'oklch(0.75 0.18 195)' }}
                />
              </div>
            </motion.div>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="text-center space-y-6 mb-12"
            >
              <h2 className="text-3xl font-bold text-foreground">
                Enable Location
              </h2>
              <p className="text-base text-muted-foreground max-w-sm leading-relaxed">
                Pulse needs your location to show nearby venues and verify check-ins. Your location is only used when the app is open.
              </p>
              <div className="flex flex-col gap-3 text-sm text-muted-foreground pt-4">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: 'oklch(0.65 0.25 300 / 0.2)' }}
                  >
                    <MapPin size={16} weight="fill" style={{ color: 'oklch(0.65 0.25 300)' }} />
                  </div>
                  <p className="text-left">Find venues near you</p>
                </div>
                <div className="flex items-center gap-3">
                  <div 
                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: 'oklch(0.75 0.18 195 / 0.2)' }}
                  >
                    <Lightning size={16} weight="fill" style={{ color: 'oklch(0.75 0.18 195)' }} />
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
                className="w-full text-lg font-bold h-14 rounded-xl relative overflow-hidden group"
                style={{
                  background: 'oklch(0.65 0.25 300)',
                  color: 'oklch(0.98 0 0)',
                  boxShadow: '0 0 40px oklch(0.65 0.25 300 / 0.4)'
                }}
              >
                <span className="relative z-10">
                  {isRequesting ? 'Requesting...' : 'Allow Location'}
                </span>
                <div 
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{
                    background: 'linear-gradient(90deg, oklch(0.70 0.28 300) 0%, oklch(0.65 0.25 300) 100%)'
                  }}
                />
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
      
      <style>{`
        @keyframes gradient-shift {
          0%, 100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }
      `}</style>
    </div>
  )
}
