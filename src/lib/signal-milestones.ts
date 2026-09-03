/**
 * Streak milestones. The streak itself comes from `getStreakCount` in
 * signal-insights; this module only decides which milestone a streak has
 * reached, what comes next, and whether it should be celebrated.
 */

export const STREAK_MILESTONES = [3, 7, 14, 30, 100] as const
export type StreakMilestone = (typeof STREAK_MILESTONES)[number]

export interface MilestoneProgress {
  /** Highest milestone reached, or null before the first. */
  current: StreakMilestone | null
  /** Next milestone ahead, or null once past the last one. */
  next: StreakMilestone | null
  /** Days still needed to reach `next` (0 when there is no next). */
  remaining: number
  /** 0–100 progress from `current` (or 0) toward `next`. */
  percent: number
}

export function milestoneForStreak(streak: number): StreakMilestone | null {
  let reached: StreakMilestone | null = null
  for (const milestone of STREAK_MILESTONES) {
    if (streak >= milestone) reached = milestone
  }
  return reached
}

export function nextMilestone(streak: number): StreakMilestone | null {
  return STREAK_MILESTONES.find((milestone) => milestone > streak) ?? null
}

export function milestoneProgress(streak: number): MilestoneProgress {
  const current = milestoneForStreak(streak)
  const next = nextMilestone(streak)
  if (next === null) {
    return { current, next, remaining: 0, percent: 100 }
  }
  const floor = current ?? 0
  const span = next - floor
  const done = Math.max(0, streak - floor)
  return {
    current,
    next,
    remaining: next - streak,
    percent: Math.max(0, Math.min(100, Math.round((done / span) * 100))),
  }
}

/**
 * The milestone to celebrate right now, if any: the highest milestone the
 * streak has reached that has not already been celebrated. Returns null when
 * the streak is below the first milestone or the reached one was already shown.
 */
export function shouldCelebrate(streak: number, lastCelebrated: number | null | undefined): StreakMilestone | null {
  const reached = milestoneForStreak(streak)
  if (reached === null) return null
  return reached > (lastCelebrated ?? 0) ? reached : null
}

export function milestoneCopy(milestone: StreakMilestone): { title: string; body: string } {
  switch (milestone) {
    case 3:
      return { title: '3-day streak', body: 'Three days in a row. Your baseline is real now.' }
    case 7:
      return { title: 'One full week', body: 'Seven straight days. Trends can now compare a whole week.' }
    case 14:
      return { title: 'Two weeks strong', body: 'Fourteen days. Tag patterns start to mean something at this point.' }
    case 30:
      return { title: '30-day streak', body: 'A full month of signals. You can now read a month against the one before.' }
    case 100:
      return { title: '100 days', body: 'One hundred days in a row. This is a habit.' }
  }
}

export function milestoneNudge(streak: number): string {
  const progress = milestoneProgress(streak)
  if (progress.next === null) return 'Past every milestone. Keep the streak going.'
  if (streak === 0) return `Log today to start toward a ${progress.next}-day streak.`
  return `${progress.remaining} more ${progress.remaining === 1 ? 'day' : 'days'} to a ${progress.next}-day streak.`
}
