import { useState, useMemo } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { CaretLeft, Trophy, Fire, Lightning, Crown, Warning, Clock } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import type { User } from '@/lib/types'
import type { Streak, StreakType, LeaderboardEntry, StreakReward } from '@/lib/streak-rewards'
import {
  STREAK_DEFINITIONS,
} from '@/lib/streak-rewards'
import { StreakCounter } from './StreakCounter'

interface StreakDashboardProps {
  currentUser: User
  allStreaks: Streak[]
  activeStreaks: Streak[]
  atRiskStreaks: Streak[]
  totalXP: number
  currentMultiplier: number
  recentMilestones: StreakReward[]
  leaderboard: (streakType: StreakType) => LeaderboardEntry[]
  onBack: () => void
}

function getTimeRemaining(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now()
  if (diff <= 0) return 'Expired'
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

function MultiplierBadge({ multiplier }: { multiplier: number }) {
  const prefersReducedMotion = useReducedMotion()
  if (multiplier <= 1) return null

  const color = multiplier >= 3 ? 'from-yellow-500 to-amber-400' : multiplier >= 2 ? 'from-purple-500 to-pink-400' : 'from-blue-500 to-cyan-400'

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { scale: 0 }}
      animate={prefersReducedMotion ? false : { scale: 1 }}
      transition={prefersReducedMotion ? { duration: 0 } : undefined}
      role="status"
      aria-label={`${multiplier}x XP multiplier active`}
      className={cn(
        'flex items-center gap-1 px-2.5 py-1 rounded-full bg-gradient-to-r text-white text-xs font-bold shadow-lg',
        color
      )}
    >
      <Lightning size={12} weight="fill" aria-hidden="true" />
      {multiplier}x XP
    </motion.div>
  )
}

function AtRiskSection({ streaks }: { streaks: Streak[] }) {
  const prefersReducedMotion = useReducedMotion()
  if (streaks.length === 0) return null

  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={prefersReducedMotion ? { duration: 0 } : undefined}
      className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 space-y-3"
      role="alert"
      aria-label={`${streaks.length} streak${streaks.length > 1 ? 's' : ''} at risk of expiring`}
    >
      <div className="flex items-center gap-2">
        <Warning size={18} weight="fill" className="text-red-400" aria-hidden="true" />
        <h3 className="text-sm font-bold text-red-400">At Risk!</h3>
      </div>
      <div className="space-y-2">
        {streaks.map(streak => {
          const def = STREAK_DEFINITIONS.find(d => d.type === streak.type)
          return (
            <div key={streak.type} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">{def?.icon}</span>
                <span className="text-sm font-medium">{def?.label}</span>
                <span className="text-xs text-muted-foreground">({streak.currentCount} streak)</span>
              </div>
              <div className="flex items-center gap-1.5 text-red-400">
                <Clock size={12} weight="bold" />
                <span className="text-xs font-mono font-bold">{getTimeRemaining(streak.expiresAt)}</span>
              </div>
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}

function LeaderboardSection({
  streakType,
  entries,
}: {
  streakType: StreakType
  entries: LeaderboardEntry[]
}) {
  const def = STREAK_DEFINITIONS.find(d => d.type === streakType)

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-bold flex items-center gap-2">
        <span>{def?.icon}</span>
        {def?.label} Leaderboard
      </h3>
      <div className="space-y-1">
        <AnimatePresence mode="popLayout">
          {entries.slice(0, 10).map((entry, i) => (
            <motion.div
              key={entry.user.id}
              layout
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg',
                entry.isCurrentUser
                  ? 'bg-accent/10 border border-accent/30'
                  : 'bg-card border border-border'
              )}
            >
              {/* Rank */}
              <span className={cn(
                'w-6 text-center font-bold text-sm',
                entry.rank === 1 && 'text-yellow-400',
                entry.rank === 2 && 'text-slate-300',
                entry.rank === 3 && 'text-amber-600',
              )}>
                {entry.rank <= 3 ? ['', '1st', '2nd', '3rd'][entry.rank] : `#${entry.rank}`}
              </span>

              {/* Avatar */}
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold overflow-hidden">
                {entry.user.profilePhoto ? (
                  <img
                    src={entry.user.profilePhoto}
                    alt={entry.user.username}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  entry.user.username.charAt(0).toUpperCase()
                )}
              </div>

              {/* Name */}
              <span className={cn(
                'flex-1 text-sm font-medium truncate',
                entry.isCurrentUser && 'text-accent'
              )}>
                {entry.isCurrentUser ? 'You' : entry.user.username}
              </span>

              {/* Streak count */}
              <div className="flex items-center gap-1">
                <Fire size={14} weight="fill" className="text-orange-400" />
                <span className="text-sm font-bold">{entry.count}</span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}

function MilestoneTimeline({ milestones }: { milestones: StreakReward[] }) {
  if (milestones.length === 0) return null

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold flex items-center gap-2">
        <Trophy size={16} weight="fill" className="text-accent" />
        Milestones Achieved
      </h3>
      <div className="space-y-2 pl-4 border-l-2 border-accent/20">
        {milestones.slice(0, 20).map((milestone, i) => (
          <motion.div
            key={`${milestone.streakType}-${milestone.milestone}`}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.03 }}
            className="relative flex items-center gap-3 pl-4"
          >
            <div className="absolute -left-[calc(0.5rem+1px)] w-3 h-3 rounded-full bg-accent border-2 border-background" />
            <span className="text-base">{milestone.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{milestone.title}</p>
              <p className="text-[10px] text-muted-foreground truncate">{milestone.description}</p>
            </div>
            <span className="text-[10px] font-mono text-accent">+{milestone.xpBonus} XP</span>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

export function StreakDashboard({
  currentUser: _currentUser,
  allStreaks,
  activeStreaks,
  atRiskStreaks,
  totalXP,
  currentMultiplier,
  recentMilestones,
  leaderboard,
  onBack,
}: StreakDashboardProps) {
  const [selectedStreakType, setSelectedStreakType] = useState<StreakType>('weekly_checkin')

  const leaderboardEntries = useMemo(
    () => leaderboard(selectedStreakType),
    [leaderboard, selectedStreakType]
  )

  const inactiveStreaks = allStreaks.filter(s => !s.isActive)

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="flex items-center gap-3 px-4 py-3 max-w-2xl mx-auto">
          <button onClick={onBack} className="p-2 -ml-2 hover:bg-muted rounded-lg" aria-label="Go back">
            <CaretLeft size={24} aria-hidden="true" />
          </button>
          <div className="flex items-center gap-2">
            <Fire size={24} weight="fill" className="text-orange-500" />
            <h1 className="text-xl font-bold">Streaks</h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <MultiplierBadge multiplier={currentMultiplier} />
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-8">
        {/* XP & Stats Row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card rounded-xl p-4 text-center border border-border">
            <div className="flex items-center justify-center gap-1">
              <Fire size={18} weight="fill" className="text-orange-500" />
              <p className="text-2xl font-bold">{activeStreaks.length}</p>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Active</p>
          </div>
          <div className="bg-card rounded-xl p-4 text-center border border-border">
            <div className="flex items-center justify-center gap-1">
              <Lightning size={18} weight="fill" className="text-accent" />
              <p className="text-2xl font-bold">{totalXP.toLocaleString()}</p>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Total XP</p>
          </div>
          <div className="bg-card rounded-xl p-4 text-center border border-border">
            <div className="flex items-center justify-center gap-1">
              <Crown size={18} weight="fill" className="text-yellow-400" />
              <p className="text-2xl font-bold">{recentMilestones.length}</p>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Milestones</p>
          </div>
        </div>

        {/* At-Risk Section */}
        <AtRiskSection streaks={atRiskStreaks} />

        {/* Active Streaks Grid */}
        {activeStreaks.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-bold">Active Streaks</h2>
            <motion.div
              className="grid grid-cols-4 gap-4"
              initial="hidden"
              animate="visible"
              variants={{
                visible: { transition: { staggerChildren: 0.08 } },
              }}
            >
              {activeStreaks.map(streak => (
                <motion.div
                  key={streak.type}
                  variants={{
                    hidden: { opacity: 0, y: 20 },
                    visible: { opacity: 1, y: 0 },
                  }}
                >
                  <StreakCounter streak={streak} />
                </motion.div>
              ))}
            </motion.div>
          </div>
        )}

        {/* Inactive Streaks */}
        {inactiveStreaks.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-muted-foreground">Inactive Streaks</h2>
            <div className="grid grid-cols-4 gap-4">
              {inactiveStreaks.map((streak, i) => (
                <motion.div
                  key={streak.type}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <StreakCounter streak={streak} />
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Friend Leaderboard */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold">Friend Leaderboard</h2>

          {/* Streak Type Selector */}
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
            {STREAK_DEFINITIONS.map(def => (
              <button
                key={def.type}
                onClick={() => setSelectedStreakType(def.type)}
                aria-pressed={selectedStreakType === def.type}
                aria-label={`Show ${def.label} leaderboard`}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
                  selectedStreakType === def.type
                    ? 'bg-accent text-accent-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
              >
                <span>{def.icon}</span>
                {def.label}
              </button>
            ))}
          </div>

          <LeaderboardSection
            streakType={selectedStreakType}
            entries={leaderboardEntries}
          />
        </div>

        {/* Milestone History */}
        <MilestoneTimeline milestones={recentMilestones} />
      </div>
    </div>
  )
}

export default StreakDashboard
