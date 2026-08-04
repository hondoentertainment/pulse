/**
 * Personalised daily advice.
 *
 * `signal-patterns.ts` can already tell a user that "active" days run +37 and
 * "stressed" days run −29 — but `getRecommendation()` ignored all of it and
 * returned hand-written rules ("Drink water and get light exposure"). The app
 * knew something specific about you and then said something generic.
 *
 * This module closes that loop: when there is enough history for a tag
 * correlation to be trustworthy, advice is derived from the user's own data.
 * Otherwise it falls back to the existing rule-based recommendation, so a new
 * user still gets something useful on day one.
 */
import type { SignalEntry, SignalProfile } from '@/lib/signal-insights'
import { getRecommendation, getTodayEntry } from '@/lib/signal-insights'
import { getTagCorrelations } from '@/lib/signal-patterns'

export interface SignalAdvice {
  text: string
  /** `pattern` when derived from the user's own correlations. */
  source: 'pattern' | 'rule'
  /** The tag the advice is about, when pattern-derived. */
  tag?: string
}

/**
 * Minimum absolute score delta before a correlation is worth acting on.
 * Below this the difference is indistinguishable from day-to-day noise.
 */
export const MIN_ADVICE_DELTA = 5

/** Days a lift tag must be absent before we point it out. */
export const STALE_LIFT_DAYS = 3

/**
 * Whole calendar days since a tag was last applied, or null if never.
 * Uses local calendar days, so "yesterday" means yesterday to the user.
 */
export function daysSinceTagLogged(
  entries: SignalEntry[],
  tag: string,
  now: Date = new Date(),
): number | null {
  const tagged = entries.filter((entry) => entry.tags.includes(tag))
  if (tagged.length === 0) return null

  const mostRecent = tagged.reduce((latest, entry) =>
    new Date(entry.createdAt).getTime() > new Date(latest.createdAt).getTime() ? entry : latest,
  )

  const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffMs =
    startOfDay(now).getTime() - startOfDay(new Date(mostRecent.createdAt)).getTime()
  return Math.max(0, Math.round(diffMs / 86_400_000))
}

/**
 * Build today's advice.
 *
 * Priority:
 *   1. A known drain tag was logged today → name the cost, suggest a reset
 *   2. A known lift tag has gone stale → surface it as the thing that works
 *   3. A known lift tag was logged today → reinforce it
 *   4. Otherwise → the existing rule-based recommendation
 */
export function getPersonalizedAdvice(
  entries: SignalEntry[],
  profile: SignalProfile | null,
  now: Date = new Date(),
): SignalAdvice {
  const fallback: SignalAdvice = { text: getRecommendation(entries, profile), source: 'rule' }

  const correlations = getTagCorrelations(entries).filter(
    (correlation) => Math.abs(correlation.delta) >= MIN_ADVICE_DELTA,
  )
  if (correlations.length === 0) return fallback

  const todayTags = getTodayEntry(entries, now)?.tags ?? []

  // 1. A drain showed up today — most actionable moment there is.
  const drains = correlations.filter((c) => c.delta < 0).sort((a, b) => a.delta - b.delta)
  const drainToday = drains.find((c) => todayTags.includes(c.tag))
  if (drainToday) {
    return {
      text: `Days you tag “${drainToday.tag}” average ${Math.abs(drainToday.delta)} points lower. Pick one small reset before the day gets away from you.`,
      source: 'pattern',
      tag: drainToday.tag,
    }
  }

  const lifts = correlations.filter((c) => c.delta > 0)
  if (lifts.length === 0) return fallback
  const topLift = lifts[0]

  // 2. The thing that works has gone missing.
  const daysSince = daysSinceTagLogged(entries, topLift.tag, now)
  if (daysSince !== null && daysSince >= STALE_LIFT_DAYS) {
    return {
      text: `“${topLift.tag}” days run ${topLift.delta} points higher for you — and it has been ${daysSince} days. Worth making room for it today.`,
      source: 'pattern',
      tag: topLift.tag,
    }
  }

  // 3. Reinforce it when it's already happening.
  if (todayTags.includes(topLift.tag)) {
    return {
      text: `You tagged “${topLift.tag}” today — that shows up on your best days, worth ${topLift.delta} points on average. Good call.`,
      source: 'pattern',
      tag: topLift.tag,
    }
  }

  return {
    text: `Your strongest pattern is “${topLift.tag}” — those days average ${topLift.delta} points higher. Everything else is noise by comparison.`,
    source: 'pattern',
    tag: topLift.tag,
  }
}
