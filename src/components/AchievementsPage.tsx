import { useMemo } from 'react'
import { User, Pulse, Venue } from '@/lib/types'
import type { Crew } from '@/lib/crew-mode'
import { calculateAchievementProgress, getUnlockedAchievements, ACHIEVEMENTS, calculateCheckInStreak } from '@/lib/achievements'
import { AchievementBadge } from '@/components/AchievementBadge'
import { StreakBadge } from '@/components/StreakBadge'
import { CaretLeft, Trophy, Fire } from '@phosphor-icons/react'
import { motion } from 'framer-motion'

interface AchievementsPageProps {
  currentUser: User
  pulses: Pulse[]
  venues: Venue[]
  crews?: Crew[]
  onBack: () => void
}

export function AchievementsPage({ currentUser, pulses, venues: _venues, crews = [], onBack }: AchievementsPageProps) {
  const crewsCreatedByUser = crews.filter(crew => crew.createdBy === currentUser.id).length
  const progress = useMemo(
    () => calculateAchievementProgress(currentUser, pulses, pulses, crewsCreatedByUser),
    [currentUser, pulses, crewsCreatedByUser]
  )

  const unlocked = useMemo(() => getUnlockedAchievements(progress), [progress])
  const userPulses = useMemo(() => pulses.filter(p => p.userId === currentUser.id), [pulses, currentUser.id])
  const streak = useMemo(() => calculateCheckInStreak(userPulses), [userPulses])

  const locked = progress.filter(p => !p.unlockedAt)

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="flex items-center gap-3 px-4 py-3 max-w-2xl mx-auto">
          <button onClick={onBack} className="p-2 -ml-2 hover:bg-muted rounded-lg">
            <CaretLeft size={24} />
          </button>
          <div className="flex items-center gap-2">
            <Trophy size={24} weight="fill" className="text-accent" />
            <h1 className="text-xl font-bold">Achievements</h1>
          </div>
          <div className="ml-auto">
            <StreakBadge streak={streak} />
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card rounded-xl p-4 text-center border border-border">
            <p className="text-2xl font-bold text-primary">{unlocked.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Unlocked</p>
          </div>
          <div className="bg-card rounded-xl p-4 text-center border border-border">
            <p className="text-2xl font-bold">{ACHIEVEMENTS.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Total</p>
          </div>
          <div className="bg-card rounded-xl p-4 text-center border border-border">
            <div className="flex items-center justify-center gap-1">
              <Fire size={20} weight="fill" className="text-orange-500" />
              <p className="text-2xl font-bold">{streak}</p>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Day Streak</p>
          </div>
        </div>

        {/* Unlocked */}
        {unlocked.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-bold">Unlocked</h2>
            <div className="grid grid-cols-3 gap-3">
              {unlocked.map((ua, i) => (
                <motion.div
                  key={ua.achievementId}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <AchievementBadge userAchievement={ua} />
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* In Progress */}
        {locked.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-muted-foreground">In Progress</h2>
            <div className="grid grid-cols-3 gap-3">
              {locked.map((ua, i) => (
                <motion.div
                  key={ua.achievementId}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <AchievementBadge userAchievement={ua} />
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
