import { motion } from 'framer-motion'
import { Fire, Snowflake, Trophy, Medal, Diamond } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import type { StreakData, StreakTier } from '@/lib/retention-engine'
import { getNextTierThreshold, STREAK_TIER_THRESHOLDS } from '@/lib/retention-engine'

interface StreakCalendarProps {
  streak: StreakData
  onUseFreeze?: () => void
}

const TIER_STYLES: Record<StreakTier, { color: string; bg: string; border: string; label: string }> = {
  none: { color: 'text-zinc-500', bg: 'bg-zinc-800', border: 'border-zinc-700', label: '' },
  bronze: { color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/30', label: 'Bronze' },
  silver: { color: 'text-slate-300', bg: 'bg-slate-400/10', border: 'border-slate-400/30', label: 'Silver' },
  gold: { color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', label: 'Gold' },
  diamond: { color: 'text-cyan-300', bg: 'bg-cyan-400/10', border: 'border-cyan-400/30', label: 'Diamond' },
}

function TierIcon({ tier, size = 20 }: { tier: StreakTier; size?: number }) {
  const className = TIER_STYLES[tier].color
  switch (tier) {
    case 'diamond': return <Diamond size={size} weight="fill" className={className} />
    case 'gold': return <Trophy size={size} weight="fill" className={className} />
    case 'silver': return <Medal size={size} weight="fill" className={className} />
    case 'bronze': return <Medal size={size} weight="fill" className={className} />
    default: return <Fire size={size} weight="duotone" className={className} />
  }
}

function getWeekDays(history: StreakData['history']): { date: string; status: 'active' | 'missed' | 'frozen' | 'future' }[] {
  const today = new Date()
  const dayOfWeek = today.getDay() // 0=Sun
  // Start from Monday of the current week
  const monday = new Date(today)
  monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7))

  const historyMap = new Map(history.map(h => [h.date, h.active]))
  const todayStr = today.toISOString().split('T')[0]

  const days: { date: string; status: 'active' | 'missed' | 'frozen' | 'future' }[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    const dateStr = d.toISOString().split('T')[0]

    if (dateStr > todayStr) {
      days.push({ date: dateStr, status: 'future' })
    } else if (historyMap.has(dateStr)) {
      days.push({ date: dateStr, status: historyMap.get(dateStr) ? 'active' : 'frozen' })
    } else {
      days.push({ date: dateStr, status: dateStr === todayStr ? 'future' : 'missed' })
    }
  }

  return days
}

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

export function StreakCalendar({ streak, onUseFreeze }: StreakCalendarProps) {
  const tierStyle = TIER_STYLES[streak.tier]
  const nextThreshold = getNextTierThreshold(streak.tier)
  const currentThreshold = STREAK_TIER_THRESHOLDS[streak.tier]
  const progress = nextThreshold
    ? (streak.currentStreak - currentThreshold) / (nextThreshold - currentThreshold)
    : 1
  const weekDays = getWeekDays(streak.history)

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-2xl border border-white/10 bg-zinc-900/80 backdrop-blur-sm p-5"
    >
      {/* Streak count + tier */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 3 }}
          >
            <Fire size={32} weight="fill" className="text-orange-500" />
          </motion.div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-bold text-white">
                {streak.currentStreak}
              </span>
              <span className="text-sm text-zinc-500 font-medium">
                day{streak.currentStreak !== 1 ? 's' : ''}
              </span>
            </div>
            <p className="text-xs text-zinc-500">
              Best: {streak.longestStreak} day{streak.longestStreak !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Tier badge */}
        {streak.tier !== 'none' && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full border',
              tierStyle.bg,
              tierStyle.border
            )}
          >
            <TierIcon tier={streak.tier} size={16} />
            <span className={cn('text-xs font-semibold', tierStyle.color)}>
              {tierStyle.label}
            </span>
          </motion.div>
        )}
      </div>

      {/* 7-day calendar row */}
      <div className="grid grid-cols-7 gap-2 mb-4">
        {weekDays.map((day, i) => (
          <div key={day.date} className="flex flex-col items-center gap-1.5">
            <span className="text-[10px] text-zinc-600 font-medium">
              {DAY_LABELS[i]}
            </span>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: i * 0.05, type: 'spring', stiffness: 400, damping: 20 }}
              className={cn(
                'w-9 h-9 rounded-full flex items-center justify-center border-2 transition-colors',
                day.status === 'active' && 'bg-orange-500/20 border-orange-500 text-orange-500',
                day.status === 'frozen' && 'bg-cyan-500/10 border-cyan-500/40 text-cyan-400',
                day.status === 'missed' && 'bg-zinc-800/50 border-zinc-700/50 text-zinc-600',
                day.status === 'future' && 'bg-zinc-800/30 border-zinc-800 text-zinc-700',
              )}
            >
              {day.status === 'active' && (
                <Fire size={16} weight="fill" />
              )}
              {day.status === 'frozen' && (
                <Snowflake size={16} weight="fill" />
              )}
              {day.status === 'missed' && (
                <span className="text-xs">-</span>
              )}
              {day.status === 'future' && (
                <span className="text-xs">{new Date(day.date).getDate()}</span>
              )}
            </motion.div>
          </div>
        ))}
      </div>

      {/* Progress to next tier */}
      {nextThreshold && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wide">
              Next: {TIER_STYLES[getNextTierName(streak.tier)].label}
            </span>
            <span className="text-[10px] text-zinc-500">
              {streak.currentStreak}/{nextThreshold} days
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(Math.max(progress, 0), 1) * 100}%` }}
              transition={{ duration: 0.6, delay: 0.3, ease: 'easeOut' }}
              className={cn(
                'h-full rounded-full',
                streak.tier === 'none' && 'bg-amber-500',
                streak.tier === 'bronze' && 'bg-slate-300',
                streak.tier === 'silver' && 'bg-yellow-400',
                streak.tier === 'gold' && 'bg-cyan-300',
              )}
            />
          </div>
        </div>
      )}

      {/* Streak freeze */}
      <div className="flex items-center justify-between pt-3 border-t border-zinc-800">
        <div className="flex items-center gap-2">
          <Snowflake size={16} weight="fill" className="text-cyan-400" />
          <span className="text-xs text-zinc-400">
            {streak.freezesRemaining} freeze{streak.freezesRemaining !== 1 ? 's' : ''} remaining
          </span>
        </div>
        {streak.freezesRemaining > 0 && onUseFreeze && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onUseFreeze}
            className="text-[10px] font-semibold text-cyan-400 hover:text-cyan-300 uppercase tracking-wide transition-colors"
          >
            Use freeze
          </motion.button>
        )}
      </div>
    </motion.div>
  )
}

function getNextTierName(tier: StreakTier): StreakTier {
  switch (tier) {
    case 'none': return 'bronze'
    case 'bronze': return 'silver'
    case 'silver': return 'gold'
    case 'gold': return 'diamond'
    case 'diamond': return 'diamond'
  }
}
