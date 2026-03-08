import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { Achievement, UserAchievement } from '@/lib/achievements'
import { getAchievementById } from '@/lib/achievements'
import { motion } from 'framer-motion'

interface AchievementBadgeProps {
  userAchievement: UserAchievement
  onClick?: () => void
  size?: 'small' | 'medium' | 'large'
}

const TIER_COLORS = {
  bronze: 'from-amber-700 to-amber-500',
  silver: 'from-slate-400 to-slate-200',
  gold: 'from-yellow-500 to-amber-300',
}

const TIER_BORDERS = {
  bronze: 'border-amber-600/40',
  silver: 'border-slate-300/40',
  gold: 'border-yellow-400/40',
}

export function AchievementBadge({ userAchievement, onClick, size = 'medium' }: AchievementBadgeProps) {
  const achievement = getAchievementById(userAchievement.achievementId)
  if (!achievement) return null

  const isUnlocked = userAchievement.unlockedAt !== ''
  const progress = Math.min(userAchievement.progress / achievement.requirement, 1)

  const sizeClass = size === 'small' ? 'w-12 h-12' : size === 'large' ? 'w-20 h-20' : 'w-16 h-16'
  const iconSize = size === 'small' ? 'text-lg' : size === 'large' ? 'text-3xl' : 'text-2xl'

  return (
    <motion.button
      onClick={onClick}
      whileHover={isUnlocked ? { scale: 1.05 } : undefined}
      whileTap={isUnlocked ? { scale: 0.95 } : undefined}
      className={cn(
        "flex flex-col items-center gap-1.5 text-center",
        !isUnlocked && "opacity-40"
      )}
      aria-label={`${achievement.name}: ${achievement.description}. ${isUnlocked ? 'Unlocked' : `${Math.round(progress * 100)}% progress`}`}
    >
      <div
        className={cn(
          "rounded-full flex items-center justify-center border-2",
          sizeClass,
          isUnlocked
            ? `bg-gradient-to-br ${TIER_COLORS[achievement.tier]} ${TIER_BORDERS[achievement.tier]}`
            : "bg-muted border-muted-foreground/20"
        )}
      >
        <span className={iconSize}>{achievement.icon}</span>
      </div>
      {size !== 'small' && (
        <>
          <p className="text-[10px] font-medium text-foreground leading-tight max-w-[80px]">
            {achievement.name}
          </p>
          {!isUnlocked && (
            <div className="w-12 h-1 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          )}
        </>
      )}
    </motion.button>
  )
}

interface AchievementShowcaseProps {
  achievements: UserAchievement[]
}

export function AchievementShowcase({ achievements }: AchievementShowcaseProps) {
  const showcased = achievements.filter(a => a.showcased && a.unlockedAt !== '')

  if (showcased.length === 0) return null

  return (
    <div className="flex gap-2 justify-center">
      {showcased.map(a => (
        <AchievementBadge key={a.achievementId} userAchievement={a} size="small" />
      ))}
    </div>
  )
}
