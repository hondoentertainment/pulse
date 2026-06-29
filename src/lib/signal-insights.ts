export type TrackingFocus = 'energy' | 'mood' | 'focus' | 'sleep'
export type SignalGoal = 'more_energy' | 'less_stress' | 'better_sleep' | 'deeper_focus'
export type TrendDirection = 'up' | 'down' | 'flat'

export interface SignalProfile {
  trackingFocus: TrackingFocus
  goal: SignalGoal
  reminderTime?: string
  displayName?: string
}

export interface SignalEntry {
  id: string
  userId: string
  createdAt: string
  focus: TrackingFocus
  score: number
  energy: number
  mood: number
  stress: number
  sleepQuality: number
  tags: string[]
}

export interface SignalMetrics {
  sevenDayAverage: number
  trendDirection: TrendDirection
  streakCount: number
  recommendation: string
}

const dayKey = (date: Date) => date.toISOString().slice(0, 10)

export function isSameDay(a: string, b: Date = new Date()): boolean {
  return dayKey(new Date(a)) === dayKey(b)
}

export function getTodayEntry(entries: SignalEntry[], now: Date = new Date()): SignalEntry | null {
  return entries.find((entry) => isSameDay(entry.createdAt, now)) ?? null
}

export function getStreakCount(entries: SignalEntry[], now: Date = new Date()): number {
  const days = new Set(entries.map((entry) => dayKey(new Date(entry.createdAt))))
  let count = 0
  const cursor = new Date(now)
  cursor.setHours(12, 0, 0, 0)

  while (days.has(dayKey(cursor))) {
    count += 1
    cursor.setDate(cursor.getDate() - 1)
  }

  return count
}

export function getSevenDayAverage(entries: SignalEntry[], now: Date = new Date()): number {
  const since = new Date(now)
  since.setDate(since.getDate() - 6)
  since.setHours(0, 0, 0, 0)
  const recent = entries.filter((entry) => new Date(entry.createdAt) >= since)
  if (recent.length === 0) return 0
  return Math.round(recent.reduce((sum, entry) => sum + entry.score, 0) / recent.length)
}

export function getTrendDirection(entries: SignalEntry[]): TrendDirection {
  const sorted = [...entries].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  if (sorted.length < 2) return 'flat'
  const previous = sorted.slice(Math.max(0, sorted.length - 6), Math.max(1, sorted.length - 3))
  const current = sorted.slice(Math.max(0, sorted.length - 3))
  const avg = (items: SignalEntry[]) => items.reduce((sum, entry) => sum + entry.score, 0) / Math.max(items.length, 1)
  const delta = avg(current) - avg(previous)
  if (delta >= 4) return 'up'
  if (delta <= -4) return 'down'
  return 'flat'
}

export function generateInsight(entries: SignalEntry[], profile: SignalProfile | null): string {
  if (entries.length === 0) {
    return 'Your first signal will turn today into a baseline you can improve tomorrow.'
  }

  const latest = [...entries].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
  const hour = new Date(latest.createdAt).getHours()
  const timeHint = hour >= 17
    ? 'You logged this in the evening, a useful window for spotting recovery patterns.'
    : hour < 12
      ? 'Morning check-ins give you an early signal before the day gets noisy.'
      : 'Midday check-ins are great for catching dips before they become your whole day.'

  if (entries.length === 1) {
    return `${timeHint} You have started your first streak.`
  }

  const trend = getTrendDirection(entries)
  if (trend === 'up') return 'Your signal is trending up. Repeat the conditions that supported your best recent day.'
  if (trend === 'down') return 'Your signal is dipping. Choose one small recovery action before your next check-in.'

  const goal = profile?.goal
  if (goal === 'less_stress') return 'Your state is steady. A short reset after high-stress moments can turn stability into momentum.'
  if (goal === 'better_sleep') return 'Your baseline is forming. Watch how sleep quality changes tomorrow morning.'
  if (goal === 'deeper_focus') return 'Your focus baseline is stable. Protect one 25-minute block today and compare the next signal.'
  return 'Your baseline is forming. Keep checking in once a day to reveal your best patterns.'
}

export function getRecommendation(entries: SignalEntry[], profile: SignalProfile | null): string {
  const latest = [...entries].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
  if (!latest) return 'Start with a 10-second check-in to create your baseline.'
  if (latest.stress >= 8) return 'Take a two-minute breathing reset, then avoid adding another task for 15 minutes.'
  if (latest.energy <= 4) return 'Drink water and get light exposure before your next work block.'
  if (latest.sleepQuality <= 4) return 'Set a wind-down reminder tonight and compare tomorrow morning.'
  if (profile?.goal === 'deeper_focus') return 'Pick one priority and run a focused 25-minute sprint.'
  return 'Repeat one thing that helped today, then check in again tomorrow.'
}

export function calculateSignalMetrics(entries: SignalEntry[], profile: SignalProfile | null): SignalMetrics {
  return {
    sevenDayAverage: getSevenDayAverage(entries),
    trendDirection: getTrendDirection(entries),
    streakCount: getStreakCount(entries),
    recommendation: getRecommendation(entries, profile),
  }
}

export function buildChartSeries(entries: SignalEntry[], now: Date = new Date()): Array<{ label: string; score: number; seeded: boolean }> {
  const byDay = new Map(entries.map((entry) => [dayKey(new Date(entry.createdAt)), entry]))
  const latestScore = entries.length > 0 ? entries[entries.length - 1].score : 62

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now)
    date.setDate(date.getDate() - (6 - index))
    const key = dayKey(date)
    const entry = byDay.get(key)
    return {
      label: date.toLocaleDateString(undefined, { weekday: 'short' }),
      score: entry?.score ?? Math.max(35, Math.min(95, latestScore - (6 - index) * 2 + (index % 2 === 0 ? 3 : -2))),
      seeded: !entry,
    }
  })
}
