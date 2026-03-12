import { useEffect } from 'react'
import { motion, useSpring, useTransform } from 'framer-motion'
import { MusicNote, Users, CurrencyDollar, UsersFour } from '@phosphor-icons/react'
import type { VibeMatch } from '@/lib/venue-storytelling'

interface VibeMatchMeterProps {
  match: VibeMatch
}

/** Interpolate from red (0) → yellow (50) → green (100) using oklch */
function scoreToColor(score: number): string {
  if (score <= 50) {
    // red → yellow
    const t = score / 50
    const l = 0.55 + t * 0.15
    const c = 0.2 + t * 0.02
    const h = 25 + t * 60 // 25 (red) → 85 (yellow)
    return `oklch(${l.toFixed(2)} ${c.toFixed(2)} ${h.toFixed(0)})`
  }
  // yellow → green
  const t = (score - 50) / 50
  const l = 0.7 - t * 0.1
  const c = 0.22 - t * 0.04
  const h = 85 + t * 65 // 85 (yellow) → 150 (green)
  return `oklch(${l.toFixed(2)} ${c.toFixed(2)} ${h.toFixed(0)})`
}

function CircularProgress({ score }: { score: number }) {
  const radius = 52
  const strokeWidth = 6
  const circumference = 2 * Math.PI * radius
  const color = scoreToColor(score)

  const springProgress = useSpring(0, { stiffness: 60, damping: 20 })
  const strokeDashoffset = useTransform(
    springProgress,
    (v) => circumference - (v / 100) * circumference
  )

  const springScore = useSpring(0, { stiffness: 80, damping: 25 })
  const displayScore = useTransform(springScore, (v) => Math.round(v))

  useEffect(() => {
    springProgress.set(score)
    springScore.set(score)
  }, [score, springProgress, springScore])

  return (
    <div className="relative flex items-center justify-center w-32 h-32">
      {/* Glow behind the ring */}
      <motion.div
        className="absolute inset-2 rounded-full blur-xl opacity-30"
        style={{ backgroundColor: color }}
        animate={{ opacity: [0.2, 0.35, 0.2] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      />

      <svg width={128} height={128} viewBox="0 0 128 128" className="rotate-[-90deg]">
        {/* Background track */}
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          stroke="oklch(0.25 0 0)"
          strokeWidth={strokeWidth}
        />
        {/* Progress arc */}
        <motion.circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          style={{ strokeDashoffset }}
        />
      </svg>

      {/* Center score */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className="text-3xl font-bold tabular-nums"
          style={{ color }}
        >
          <motion.span>{displayScore}</motion.span>
          <span className="text-base font-normal text-muted-foreground">%</span>
        </motion.span>
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
          Vibe Match
        </span>
      </div>
    </div>
  )
}

interface BreakdownBarProps {
  label: string
  value: number
  icon: React.ReactNode
  delay?: number
}

function BreakdownBar({ label, value, icon, delay = 0 }: BreakdownBarProps) {
  const color = scoreToColor(value)

  return (
    <div className="flex items-center gap-2">
      <div className="w-4 h-4 flex items-center justify-center text-muted-foreground">
        {icon}
      </div>
      <span className="text-[11px] text-muted-foreground w-14 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ delay: 0.3 + delay, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
      <span className="text-[10px] tabular-nums text-muted-foreground w-7 text-right">
        {value}
      </span>
    </div>
  )
}

export function VibeMatchMeter({ match }: VibeMatchMeterProps) {
  const { overall, breakdown, verdict } = match

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Circular progress ring */}
      <CircularProgress score={overall} />

      {/* Breakdown bars */}
      <div className="w-full flex flex-col gap-2">
        <BreakdownBar
          label="Music"
          value={breakdown.musicMatch}
          icon={<MusicNote size={12} weight="fill" />}
          delay={0}
        />
        <BreakdownBar
          label="Crowd"
          value={breakdown.crowdMatch}
          icon={<Users size={12} weight="fill" />}
          delay={0.05}
        />
        <BreakdownBar
          label="Price"
          value={breakdown.priceMatch}
          icon={<CurrencyDollar size={12} weight="fill" />}
          delay={0.1}
        />
        <BreakdownBar
          label="Friends"
          value={breakdown.friendOverlap}
          icon={<UsersFour size={12} weight="fill" />}
          delay={0.15}
        />
      </div>

      {/* Verdict */}
      <motion.p
        className="text-sm text-center text-muted-foreground italic"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        {verdict}
      </motion.p>
    </div>
  )
}
