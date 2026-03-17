import { useMemo } from 'react'
import { useKV } from '@github/spark/hooks'
import type { Pulse, User } from '@/lib/types'
import {
  checkStreakProgress,
  getStreakMultiplier,
  calculateTotalXP,
  isAtRisk,
  getAchievedMilestones,
  buildFriendLeaderboard,
  type Streak,
  type StreakType,
  type StreakReward,
  type LeaderboardEntry,
} from '@/lib/streak-rewards'

export interface UseStreakRewardsResult {
  /** All calculated streaks for the current user */
  activeStreaks: Streak[]
  /** Streaks that will expire within 24 hours */
  atRiskStreaks: Streak[]
  /** Build a friend leaderboard for a given streak type */
  leaderboard: (streakType: StreakType) => LeaderboardEntry[]
  /** Cumulative XP from all streak milestones */
  totalXP: number
  /** Active XP multiplier based on active streak count */
  currentMultiplier: number
  /** Recently achieved milestones across all streaks */
  recentMilestones: StreakReward[]
  /** All streaks (active and inactive) */
  allStreaks: Streak[]
}

export function useStreakRewards(currentUser: User): UseStreakRewardsResult {
  const [pulses] = useKV<Pulse[]>('pulses', [])
  const [allUsers] = useKV<User[]>('users', [])

  const streaks = useMemo(
    () => checkStreakProgress(currentUser.id, pulses),
    [currentUser.id, pulses]
  )

  const activeStreaks = useMemo(
    () => streaks.filter(s => s.isActive),
    [streaks]
  )

  const atRiskStreaks = useMemo(
    () => activeStreaks.filter(s => isAtRisk(s)),
    [activeStreaks]
  )

  const totalXP = useMemo(
    () => calculateTotalXP(streaks),
    [streaks]
  )

  const currentMultiplier = useMemo(
    () => getStreakMultiplier(activeStreaks),
    [activeStreaks]
  )

  const recentMilestones = useMemo(() => {
    const milestones: StreakReward[] = []
    for (const streak of streaks) {
      milestones.push(...getAchievedMilestones(streak))
    }
    return milestones
  }, [streaks])

  const friends = useMemo(() => {
    const friendSet = new Set(currentUser.friends)
    return allUsers.filter(u => friendSet.has(u.id))
  }, [allUsers, currentUser.friends])

  // Compute all friend streaks for leaderboard use
  const allFriendStreaks = useMemo(() => {
    const allStreakEntries: Streak[] = [...streaks]
    for (const friend of friends) {
      allStreakEntries.push(...checkStreakProgress(friend.id, pulses))
    }
    return allStreakEntries
  }, [friends, pulses, streaks])

  const leaderboard = useMemo(() => {
    return (streakType: StreakType) =>
      buildFriendLeaderboard(currentUser.id, friends, allFriendStreaks, streakType)
  }, [currentUser.id, friends, allFriendStreaks])

  return {
    activeStreaks,
    atRiskStreaks,
    leaderboard,
    totalXP,
    currentMultiplier,
    recentMilestones,
    allStreaks: streaks,
  }
}
