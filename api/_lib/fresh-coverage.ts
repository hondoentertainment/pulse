/**
 * Server-side fresh coverage for Seattle expansion gates.
 * Mirrors the 90-minute evidence rule in `src/lib/fresh-coverage.ts`.
 */

export const FRESH_COVERAGE_MAX_MINUTES = 90
export const FRESH_COVERAGE_SLA_PCT = 70

export interface FreshCoverageVenueInput {
  id: string
  name: string
  neighborhood?: string | null
  city?: string | null
  last_pulse_at?: string | null
}

export interface FreshCoveragePulseInput {
  venue_id: string
  created_at: string
}

export interface FreshCoverageApiSummary {
  total: number
  freshCount: number
  coveragePct: number
  meetsSla: boolean
  slaPct: number
  maxFreshnessMinutes: number
  stale: { venueId: string; venueName: string; neighborhood: string | null; freshnessMinutes: number | null }[]
}

export function computeFreshCoverageFromRows(
  venues: FreshCoverageVenueInput[],
  pulses: FreshCoveragePulseInput[],
  nowMs: number = Date.now(),
  maxFreshnessMinutes: number = FRESH_COVERAGE_MAX_MINUTES,
  slaPct: number = FRESH_COVERAGE_SLA_PCT,
): FreshCoverageApiSummary {
  const cutoff = nowMs - maxFreshnessMinutes * 60 * 1000
  const latestByVenue = new Map<string, number>()

  for (const pulse of pulses) {
    const t = new Date(pulse.created_at).getTime()
    if (Number.isNaN(t) || t < cutoff) continue
    const prev = latestByVenue.get(pulse.venue_id)
    if (prev === undefined || t > prev) latestByVenue.set(pulse.venue_id, t)
  }

  const stale: FreshCoverageApiSummary['stale'] = []
  let freshCount = 0

  for (const venue of venues) {
    let latest = latestByVenue.get(venue.id)
    if (latest === undefined && venue.last_pulse_at) {
      const t = new Date(venue.last_pulse_at).getTime()
      if (!Number.isNaN(t) && t >= cutoff) latest = t
    }
    const freshnessMinutes =
      latest === undefined ? null : Math.max(0, Math.round((nowMs - latest) / 60000))
    const isFresh = freshnessMinutes != null && freshnessMinutes < maxFreshnessMinutes
    if (isFresh) {
      freshCount += 1
    } else {
      stale.push({
        venueId: venue.id,
        venueName: venue.name,
        neighborhood: venue.neighborhood ?? null,
        freshnessMinutes,
      })
    }
  }

  const total = venues.length
  const coveragePct = total === 0 ? 0 : Math.round((freshCount / total) * 1000) / 10

  return {
    total,
    freshCount,
    coveragePct,
    meetsSla: coveragePct >= slaPct,
    slaPct,
    maxFreshnessMinutes,
    stale: stale.slice(0, 25),
  }
}
