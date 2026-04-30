import type { Venue } from './types'

export type VenueSignalName = 'pulseScore' | 'crowdLevel' | 'waitTime' | 'lastReport'
export type VenueFreshnessStatus = 'fresh' | 'stale' | 'untrusted'

export interface VenueFreshness {
  signal: VenueSignalName
  status: VenueFreshnessStatus
  ageMinutes: number | null
  updatedAt?: string
}

const FRESH_MINUTES: Record<VenueSignalName, number> = {
  pulseScore: 10,
  crowdLevel: 15,
  waitTime: 10,
  lastReport: 15,
}

const STALE_MINUTES: Record<VenueSignalName, number> = {
  pulseScore: 45,
  crowdLevel: 45,
  waitTime: 30,
  lastReport: 45,
}

function getAgeMinutes(timestamp: string | undefined | null, nowMs: number): number | null {
  if (!timestamp) return null
  const time = new Date(timestamp).getTime()
  if (!Number.isFinite(time)) return null
  return Math.max(0, Math.round((nowMs - time) / 60000))
}

export function getVenueSignalFreshness(
  signal: VenueSignalName,
  updatedAt: string | undefined | null,
  now: Date = new Date()
): VenueFreshness {
  const ageMinutes = getAgeMinutes(updatedAt, now.getTime())

  if (ageMinutes === null || ageMinutes > STALE_MINUTES[signal]) {
    return { signal, status: 'untrusted', ageMinutes, updatedAt: updatedAt ?? undefined }
  }

  if (ageMinutes > FRESH_MINUTES[signal]) {
    return { signal, status: 'stale', ageMinutes, updatedAt: updatedAt ?? undefined }
  }

  return { signal, status: 'fresh', ageMinutes, updatedAt: updatedAt ?? undefined }
}

export function getVenueFreshness(venue: Venue, now: Date = new Date()): Record<VenueSignalName, VenueFreshness> {
  const liveUpdatedAt = venue.liveSummary?.lastReportAt ?? venue.liveSummary?.updatedAt

  return {
    pulseScore: getVenueSignalFreshness('pulseScore', venue.lastPulseAt ?? venue.lastActivity, now),
    crowdLevel: getVenueSignalFreshness('crowdLevel', liveUpdatedAt, now),
    waitTime: getVenueSignalFreshness('waitTime', liveUpdatedAt, now),
    lastReport: getVenueSignalFreshness('lastReport', liveUpdatedAt, now),
  }
}

export function isVenueRealtimeTrusted(venue: Venue, now: Date = new Date()): boolean {
  const freshness = getVenueFreshness(venue, now)
  return freshness.pulseScore.status !== 'untrusted' || freshness.lastReport.status !== 'untrusted'
}
