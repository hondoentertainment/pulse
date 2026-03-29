import { motion, useSpring, useTransform } from 'framer-motion'
import { useEffect } from 'react'
import { getEnergyLabel } from '@/lib/pulse-engine'

function getIGColor(score: number): string {
  if (score >= 80) return '#E1306C'
  if (score >= 60) return '#F77737'
  if (score >= 30) return '#FCAF45'
  return '#833AB4'
}

interface PulseScoreProps {
  score: number
  size?: 'xs' | 'sm' | 'md' | 'lg'
  showLabel?: boolean
}

export function PulseScore({ score, size = 'md', showLabel = true }: PulseScoreProps) {
  const springScore = useSpring(0, { stiffness: 100, damping: 20 })
  const displayScore = useTransform(springScore, (value) => Math.round(value))

  useEffect(() => {
    springScore.set(score)
  }, [score, springScore])

  const color = getIGColor(score)
  const label = getEnergyLabel(score)
  const isHighScore = score >= 80

  const sizeClasses = {
    xs: 'text-xs',
    sm: 'text-2xl',
    md: 'text-5xl',
    lg: 'text-7xl'
  }

  const glowSize = {
    xs: 8,
    sm: 15,
    md: 25,
    lg: 35
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        {isHighScore && (
          <motion.div
            className="absolute -inset-2 rounded-full"
            style={{
              background: 'linear-gradient(135deg, #833AB4, #E1306C, #F77737, #FCAF45)',
              padding: '2px',
            }}
            animate={{
              rotate: [0, 360],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: 'linear',
            }}
          >
            <div className="w-full h-full rounded-full bg-card" />
          </motion.div>
        )}
        <motion.div
          className="absolute inset-0 rounded-full blur-xl opacity-50"
          style={{ backgroundColor: color }}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3]
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut'
          }}
        />

        <motion.div
          className={`relative font-bold ${sizeClasses[size]} tabular-nums`}
          style={{
            color,
            textShadow: `0 0 ${glowSize[size]}px ${color}`
          }}
          animate={{
            textShadow: [
              `0 0 ${glowSize[size]}px ${color}`,
              `0 0 ${glowSize[size] * 1.5}px ${color}`,
              `0 0 ${glowSize[size]}px ${color}`
            ]
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut'
          }}
        >
          <motion.span>{displayScore}</motion.span>
        </motion.div>
      </div>
      
      {showLabel && (
        <motion.div
          key={label}
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-sm font-mono uppercase tracking-wider text-muted-foreground"
        >
          {label}
        </motion.div>
      )}
    </div>
  )
}
