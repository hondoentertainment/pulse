import { useMemo } from 'react'
import { useKV } from '@github/spark/hooks'
import { User, Pulse, Venue } from '@/lib/types'
import type { Crew } from '@/lib/crew-mode'
import {
  calculateAchievementProgress,
  getUnlockedAchievements,
  ACHIEVEMENTS,
  calculateCheckInStreak,
  getDefaultWeeklyChallenges,
  calculateChallengeProgress,
  isSeasonalAchievementActive,
  getAchievementById,
  toggleShowcase,
  type AchievementId,
  type UserAchievement,
} from '@/lib/achievements'
import { AchievementBadge } from '@/components/AchievementBadge'
import { StreakBadge } from '@/components/StreakBadge'
import { CaretLeft, Trophy, Fire, Target } from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

interface AchievementsPageProps {
  currentUser: User
  pulses: Pulse[]
  venues: Venue[]
  crews?: Crew[]
  onBack: () => void
}

export function AchievementsPage({ currentUser, pulses, venues: _venues, crews = [], onBack }: AchievementsPageProps) {
  const [storedShowcasedIds, setShowcasedIds] = useKV<AchievementId[]>(`achievement-showcase-${currentUser.id}`, [])
  const showcasedIds = useMemo(() => storedShowcasedIds ?? [], [storedShowcasedIds])
  const crewsCreatedByUser = crews.filter(crew => crew.createdBy === currentUser.id).length

  const baseProgress = useMemo(
    () => calculateAchievementProgress(currentUser, pulses, pulses, crewsCreatedByUser),
    [currentUser, pulses, crewsCreatedByUser]
  )

  const progress = useMemo<UserAchievement[]>(
    () => baseProgress.map(item => ({
      ...item,
      showcased: showcasedIds.includes(item.achievementId) && item.unlockedAt !== '',
    })),
    [baseProgress, showcasedIds]
  )

  const weeklyChallenges = useMemo(() => getDefaultWeeklyChallenges(), [])
  const challengeProgress = useMemo(
    () => weeklyChallenges.map(challenge => ({
      challenge,
      progress: calculateChallengeProgress(challenge, currentUser.id, pulses),
    })),
    [weeklyChallenges, currentUser.id, pulses]
  )

  const unlocked = useMemo(() => getUnlockedAchievements(progress), [progress])
  const userPulses = useMemo(() => pulses.filter(p => p.userId === currentUser.id), [pulses, currentUser.id])
  const streak = useMemo(() => calculateCheckInStreak(userPulses), [userPulses])

  const seasonal = useMemo(
    () => ACHIEVEMENTS.filter(a => a.seasonal && isSeasonalAchievementActive(a)),
    []
  )
  const seasonalProgress = progress.filter(p =>
    seasonal.some(a => a.id === p.achievementId)
  )

  const locked = progress.filter(p => {
    const meta = getAchievementById(p.achievementId)
    if (meta?.seasonal && !isSeasonalAchievementActive(meta)) return false
    return !p.unlockedAt
  })

  const handleToggleShowcase = (achievementId: AchievementId) => {
    const wasShowcased = showcasedIds.includes(achievementId)
    const updated = toggleShowcase(progress, achievementId)
    const nextIds = updated.filter(p => p.showcased).map(p => p.achievementId)
    if (!wasShowcased && nextIds.length === showcasedIds.length) {
      toast.error('Showcase full', { description: 'Remove one badge before adding another' })
      return
    }
    setShowcasedIds(nextIds)
    toast.message(wasShowcased ? 'Removed from profile showcase' : 'Pinned to profile showcase')
  }

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

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Target size={20} weight="fill" className="text-primary" />
            <h2 className="text-lg font-bold">Weekly Challenges</h2>
          </div>
          <div className="space-y-3">
            {challengeProgress.map(({ challenge, progress: cp }) => (
              <div key={challenge.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold">{challenge.title}</p>
                    <p className="text-sm text-muted-foreground">{challenge.description}</p>
                  </div>
                  {cp.completed && <Badge className="shrink-0">Complete</Badge>}
                </div>
                <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${Math.min(100, (cp.current / cp.target) * 100)}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {cp.current}/{cp.target} · Reward: {challenge.reward.xp} XP
                </p>
              </div>
            ))}
          </div>
        </div>

        {seasonalProgress.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-bold">Seasonal</h2>
            <div className="grid grid-cols-3 gap-3">
              {seasonalProgress.map((ua, i) => (
                <motion.div key={ua.achievementId} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                  <AchievementBadge
                    userAchievement={ua}
                    onClick={ua.unlockedAt ? () => handleToggleShowcase(ua.achievementId) : undefined}
                  />
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {unlocked.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-bold">Unlocked</h2>
            <p className="text-xs text-muted-foreground">Tap a badge to pin it to your profile (max 4).</p>
            <div className="grid grid-cols-3 gap-3">
              {unlocked.map((ua, i) => (
                <motion.div
                  key={ua.achievementId}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <AchievementBadge
                    userAchievement={ua}
                    onClick={() => handleToggleShowcase(ua.achievementId)}
                  />
                </motion.div>
              ))}
            </div>
          </div>
        )}

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
