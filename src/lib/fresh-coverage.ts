import type { Pulse, Venue } from './types'
import { computeVenueSignal } from './venue-signal'
import { canSubmitScoutReport, getScoutWeeklyQuota, type ScoutTier } from './scout-program'

/** Expansion gate: fresh evidence younger than 90 minutes (PRD §15.1). */
export const FRESH_COVERAGE_MAX_MINUTES = 90
export const FRESH_COVERAGE_SLA_PCT = 70

export interface FreshCoverageVenueRow {
  venueId: string
  venueName: string
  neighborhood?: string
  freshnessMinutes: number | null
  reportCount: number
  isFresh: boolean
}

export interface FreshCoverageSummary {
  total: number
  freshCount: number
  coveragePct: number
  meetsSla: boolean
  stale: FreshCoverageVenueRow[]
  fresh: FreshCoverageVenueRow[]
  maxFreshnessMinutes: number
  slaPct: number
}

export function isVenueFreshForCoverage(
  venue: Venue,
  pulses: Pulse[],
  options: { now?: Date; maxFreshnessMinutes?: number } = {},
): boolean {
  const maxMinutes = options.maxFreshnessMinutes ?? FRESH_COVERAGE_MAX_MINUTES
  const signal = computeVenueSignal(venue, pulses, { now: options.now })
  return (
    signal.reportCount > 0 &&
    signal.freshnessMinutes != null &&
    signal.freshnessMinutes < maxMinutes
  )
}

/**
 * Fresh venue coverage for expansion gates: share of venues with
 * community report evidence younger than 90 minutes.
 */
export function computeFreshCoverage(
  venues: Venue[],
  pulses: Pulse[],
  options: { now?: Date; maxFreshnessMinutes?: number; slaPct?: number } = {},
): FreshCoverageSummary {
  const maxFreshnessMinutes = options.maxFreshnessMinutes ?? FRESH_COVERAGE_MAX_MINUTES
  const slaPct = options.slaPct ?? FRESH_COVERAGE_SLA_PCT
  const now = options.now

  const rows: FreshCoverageVenueRow[] = venues.map((venue) => {
    const signal = computeVenueSignal(venue, pulses, { now })
    const isFresh =
      signal.reportCount > 0 &&
      signal.freshnessMinutes != null &&
      signal.freshnessMinutes < maxFreshnessMinutes
    return {
      venueId: venue.id,
      venueName: venue.name,
      neighborhood: venue.neighborhood,
      freshnessMinutes: signal.freshnessMinutes,
      reportCount: signal.reportCount,
      isFresh,
    }
  })

  const fresh = rows.filter((r) => r.isFresh)
  const stale = rows
    .filter((r) => !r.isFresh)
    .sort((a, b) => {
      const am = a.freshnessMinutes ?? Number.POSITIVE_INFINITY
      const bm = b.freshnessMinutes ?? Number.POSITIVE_INFINITY
      return bm - am
    })
  const total = rows.length
  const freshCount = fresh.length
  const coveragePct = total === 0 ? 0 : Math.round((freshCount / total) * 1000) / 10

  return {
    total,
    freshCount,
    coveragePct,
    meetsSla: coveragePct >= slaPct,
    stale,
    fresh,
    maxFreshnessMinutes,
    slaPct,
  }
}

export function startOfIsoWeek(now: Date = new Date()): Date {
  const d = new Date(now)
  const day = d.getUTCDay() || 7
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() - day + 1)
  return d
}

export function countUserReportsThisWeek(
  userId: string,
  pulses: Pulse[],
  now: Date = new Date(),
): number {
  const weekStart = startOfIsoWeek(now).getTime()
  return pulses.filter(
    (p) => p.userId === userId && new Date(p.createdAt).getTime() >= weekStart,
  ).length
}

export interface ScoutQuotaProgress {
  tier: ScoutTier
  reportsThisWeek: number
  weeklyQuota: number
  remaining: number
  canSubmit: boolean
  label: string
}

export function getScoutQuotaProgress(
  tier: ScoutTier | null | undefined,
  reportsThisWeek: number,
): ScoutQuotaProgress | null {
  if (!tier) return null
  const weeklyQuota = getScoutWeeklyQuota(tier)
  const remaining = Math.max(0, weeklyQuota - reportsThisWeek)
  return {
    tier,
    reportsThisWeek,
    weeklyQuota,
    remaining,
    canSubmit: canSubmitScoutReport(tier, reportsThisWeek),
    label: `${Math.min(reportsThisWeek, weeklyQuota)}/${weeklyQuota} scout reports this week`,
  }
}
