/**
 * "For tonight" home header — time + neighborhood, start-here pick,
 * and heating-up rail. Ranked from live reviews + distance + time of day.
 * Never invents venues or energy.
 */

import type { Pulse, Venue } from './types'
import { calculateDistance, getEnergyLabel } from './pulse-engine'
import {
  getSurgingNearbyVenues,
  getVenueMapActivity,
  type VenueMapActivity,
} from './map-live-reviews'
import { ENERGY_CONFIG, type EnergyRating } from './types'
import { filterTonightCatalog } from './catalog-quality'
import { isCuratedVenue } from './map-filters'
import { densityRankBoost, normalizeNeighborhoodName } from './seattle-density'
import {
  DEFAULT_LAUNCH_NEIGHBORHOOD,
  inferNeighborhoodFromGeo,
  persistHomePlace,
  readSavedCity,
  readSavedNeighborhood,
  resolveNeighborhoodFallback,
} from './neighborhood-geo'
import { focusHoodEmptyBody } from './focus-hood'

export interface TonightHomePick {
  venue: Venue
  energyLabel: string
  energyRating?: EnergyRating
  headline: string
  trustLine: string
  suggested?: boolean
}

export interface TonightEmptyState {
  headline: string
  body: string
  steps: readonly string[]
}

export interface TonightHome {
  title: string
  subtitle: string
  neighborhood: string
  startHere: TonightHomePick | null
  heatingUp: TonightHomePick[]
  /** Remaining ranked cards after Start here + Heating up. Total cards ≤ 8. */
  surging: TonightHomePick[]
  empty: TonightEmptyState | null
  locationDenied: boolean
}

export const TONIGHT_CARD_LIMIT = 8
export const FOLLOWED_RECENT_WINDOW_MS = 90 * 60 * 1000
export const FOLLOWED_NEARBY_MILES = 2
/** Enough to win a tie, not enough to beat a clearly hotter room. */
export const LOCATION_VERIFIED_RANK_BOOST = 8
export const FOLLOWED_NEARBY_FLOAT_BOOST = 48

const ENERGY_RANK: Record<EnergyRating, number> = {
  dead: 0,
  chill: 4,
  buzzing: 10,
  electric: 16,
}

export const TONIGHT_EMPTY_LOOP: TonightEmptyState = {
  headline: 'Quiet nearby — no live reviews in the last hour.',
  body: 'Teach the loop: map → venue → pulse. Guests can browse; posting still needs a sign-in.',
  steps: ['Open the map', 'Tap a real Seattle pin', 'Post a pulse when you’re there'],
}

function formatTonightClock(now: Date): string {
  const weekday = now.toLocaleDateString('en-US', { weekday: 'short' })
  const time = now.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).toLowerCase().replace(' ', '')
  return `${weekday} ${time}`
}

/** Evening nightlife hours boost music / bar categories; afternoon boosts food. */
export function timeOfDayBoost(category: string | undefined, hour: number): number {
  const kind = (category ?? '').toLowerCase()
  const nightlife = hour >= 20 || hour < 4
  const evening = hour >= 16 && hour < 20
  const isMusic = /music|club|bar|lounge|venue/.test(kind)
  const isFood = /restaurant|food|cafe|coffee|diner/.test(kind)
  if (nightlife && isMusic) return 12
  if (evening && isFood) return 6
  if (nightlife && isFood) return 2
  return 0
}

export function resolveHomeNeighborhood(
  venues: Venue[],
  userLocation: { lat: number; lng: number } | null,
  savedVenueIds: readonly string[] = [],
  options: {
    savedNeighborhood?: string | null
    savedCity?: string | null
    persist?: boolean
  } = {},
): string {
  const inferred = inferNeighborhoodFromGeo(userLocation)
  const saved = new Set(savedVenueIds)
  const withHood = venues.filter((venue) => (venue.neighborhood ?? '').trim().length > 0)
  let venueNeighborhood: string | null = null
  if (withHood.length > 0) {
    const scored = withHood.map((venue) => {
      const distance = userLocation
        ? calculateDistance(userLocation.lat, userLocation.lng, venue.location.lat, venue.location.lng)
        : Number.POSITIVE_INFINITY
      const savedBoost = saved.has(venue.id) ? -100 : 0
      return { venue, rank: distance + savedBoost }
    })
    scored.sort((a, b) => a.rank - b.rank)
    venueNeighborhood = scored[0]?.venue.neighborhood?.trim() || null
  }

  const neighborhood = resolveNeighborhoodFallback({
    inferred,
    savedNeighborhood: options.savedNeighborhood ?? readSavedNeighborhood(),
    savedCity: options.savedCity ?? readSavedCity(),
    venueNeighborhood,
  })

  if (options.persist !== false && neighborhood) {
    persistHomePlace({
      neighborhood,
      city: options.savedCity ?? readSavedCity() ?? 'Seattle',
    })
  }
  return neighborhood || DEFAULT_LAUNCH_NEIGHBORHOOD
}

function pickLine(
  venue: Venue,
  pulses: Pulse[],
  nowMs: number,
  activity?: VenueMapActivity,
  suggested = false,
): TonightHomePick {
  const resolved = activity ?? getVenueMapActivity(venue, pulses, nowMs)
  const energyRating = resolved.latest?.energyRating
  const energyLabel = energyRating
    ? ENERGY_CONFIG[energyRating].label
    : getEnergyLabel(venue.pulseScore)
  return {
    venue,
    energyLabel,
    energyRating,
    headline: suggested
      ? `Start at ${venue.name}`
      : `${venue.name} is ${energyLabel} right now`,
    trustLine: energyLabel,
    suggested,
  }
}

export interface TonightRankContext {
  followedVenueIds?: readonly string[]
}

interface VenuePulseSignals {
  latest: Pulse | null
  count90: number
  locationVerified: boolean
  ageMs: number | null
}

function venuePulseSignals(
  venueId: string,
  pulses: readonly Pulse[],
  nowMs: number,
): VenuePulseSignals {
  const cutoff = nowMs - FOLLOWED_RECENT_WINDOW_MS
  let latest: Pulse | null = null
  let latestMs = -Infinity
  let count90 = 0
  for (const pulse of pulses) {
    if (pulse.venueId !== venueId) continue
    const created = Date.parse(pulse.createdAt)
    if (!Number.isFinite(created) || created > nowMs || created < cutoff) continue
    count90 += 1
    if (created >= latestMs) {
      latestMs = created
      latest = pulse
    }
  }
  return {
    latest,
    count90,
    locationVerified: latest?.locationVerified === true,
    ageMs: latest ? nowMs - latestMs : null,
  }
}

function freshnessBoost(ageMs: number | null): number {
  if (ageMs == null || ageMs < 0) return 0
  const ageMin = ageMs / 60000
  if (ageMin > 90) return 0
  return Math.max(4, 24 - ageMin * 0.2)
}

function followedNearbyFloat(
  venue: Venue,
  signals: VenuePulseSignals,
  userLocation: { lat: number; lng: number } | null,
  followedVenueIds: readonly string[],
): number {
  if (!userLocation || signals.count90 === 0) return 0
  if (!followedVenueIds.includes(venue.id)) return 0
  const miles = calculateDistance(
    userLocation.lat,
    userLocation.lng,
    venue.location.lat,
    venue.location.lng,
  )
  if (miles > FOLLOWED_NEARBY_MILES) return 0
  return FOLLOWED_NEARBY_FLOAT_BOOST
}

function rankScore(
  venue: Venue,
  pulses: Pulse[],
  now: Date,
  userLocation: { lat: number; lng: number } | null,
  context: TonightRankContext = {},
): number {
  const signals = venuePulseSignals(venue.id, pulses, now.getTime())
  const distance = userLocation
    ? calculateDistance(userLocation.lat, userLocation.lng, venue.location.lat, venue.location.lng)
    : 2
  const energy = signals.latest ? ENERGY_RANK[signals.latest.energyRating] ?? 0 : 0
  const verified = signals.locationVerified ? LOCATION_VERIFIED_RANK_BOOST : 0
  const followed = followedNearbyFloat(
    venue,
    signals,
    userLocation,
    context.followedVenueIds ?? [],
  )
  return freshnessBoost(signals.ageMs)
    + energy
    + signals.count90 * 8
    + verified
    + followed
    + timeOfDayBoost(venue.category, now.getHours())
    - distance * 4
    + densityRankBoost(venue)
}

/**
 * Rank comparator for Tonight.
 * Prefers fresher live energy, closer pins, time-of-day, followed venues
 * that pulsed in the last 90 minutes when nearby, and location-verified
 * pulses when the rooms are otherwise comparable.
 * Curated / claimed still break remaining ties. Never invents Verified.
 */
export function compareTonightRank(
  a: Venue,
  b: Venue,
  pulses: Pulse[],
  now: Date,
  userLocation: { lat: number; lng: number } | null,
  context: TonightRankContext = {},
): number {
  const scoreDiff = rankScore(b, pulses, now, userLocation, context) - rankScore(a, pulses, now, userLocation, context)
  if (scoreDiff !== 0) return scoreDiff
  const curatedDiff = Number(isCuratedVenue(b)) - Number(isCuratedVenue(a))
  if (curatedDiff !== 0) return curatedDiff
  const claimDiff = Number(Boolean(b.claimVerified)) - Number(Boolean(a.claimVerified))
  if (claimDiff !== 0) return claimDiff
  const densityDiff = densityRankBoost(b) - densityRankBoost(a)
  if (densityDiff !== 0) return densityDiff
  return (a.name ?? '').localeCompare(b.name ?? '')
}

export function listTonightFollowingVenues(
  venues: Venue[],
  savedVenueIds: readonly string[] = [],
  followedVenueIds: readonly string[] = [],
): Venue[] {
  const saved = new Set([...savedVenueIds, ...followedVenueIds])
  if (saved.size === 0) return []
  return venues.filter((venue) => saved.has(venue.id))
}

export const TONIGHT_FOLLOWING_GUEST_EMPTY: TonightEmptyState = {
  headline: 'Follow a venue for tonight',
  body: 'Guests can browse the map. Follow sends you to sign in — we never invent a list.',
  steps: ['Open the map', 'Tap a pin you care about', 'Follow — we’ll send you to /auth'],
}

export const TONIGHT_FOLLOWING_SIGNED_IN_EMPTY: TonightEmptyState = {
  headline: 'Nothing in Following yet',
  body: 'Follow a real Seattle venue. Tonight will show that pin plus its latest live pulse.',
  steps: ['Open the map', 'Tap a pin you care about', 'Tap Follow'],
}

export interface TonightFollowingRow {
  venue: Venue
  latestPulse: Pulse | null
}

/** Signed-in Following: `follows.target_venue_id` rows + each venue’s latest live pulse. */
export function listTonightFollowingFeed(
  venues: Venue[],
  pulses: readonly Pulse[],
  followedVenueIds: readonly string[],
): TonightFollowingRow[] {
  const followed = new Set(followedVenueIds)
  if (followed.size === 0) return []
  return venues
    .filter((venue) => followed.has(venue.id))
    .map((venue) => {
      const latestPulse = pulses
        .filter((pulse) => pulse.venueId === venue.id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ?? null
      return { venue, latestPulse }
    })
}

/** Geo-sorted catalog, or Launch 33 when location is off. Never invents venues. */
export function listTonightNearVenues(
  venues: Venue[],
  userLocation: { lat: number; lng: number } | null,
  limit = 8,
): { venues: Venue[]; usedLaunch33Fallback: boolean } {
  const catalog = filterTonightCatalog(venues)
  if (!userLocation) {
    const launch33 = catalog.filter((venue) => isCuratedVenue(venue))
    return {
      venues: (launch33.length > 0 ? launch33 : catalog).slice(0, limit),
      usedLaunch33Fallback: true,
    }
  }
  return {
    venues: [...catalog]
      .map((venue) => ({
        venue,
        miles: calculateDistance(
          userLocation.lat,
          userLocation.lng,
          venue.location.lat,
          venue.location.lng,
        ),
      }))
      .sort((a, b) => a.miles - b.miles)
      .slice(0, limit)
      .map((row) => row.venue),
    usedLaunch33Fallback: false,
  }
}

function hasRecentPulse(venueId: string, pulses: readonly Pulse[], nowMs: number): boolean {
  return venuePulseSignals(venueId, pulses, nowMs).count90 > 0
}

export function buildTonightHome(input: {
  venues: Venue[]
  pulses: Pulse[]
  userLocation?: { lat: number; lng: number } | null
  savedVenueIds?: readonly string[]
  followedVenueIds?: readonly string[]
  now?: Date
  locationDenied?: boolean
  savedNeighborhood?: string | null
  savedCity?: string | null
}): TonightHome {
  const now = input.now ?? new Date()
  const nowMs = now.getTime()
  const userLocation = input.userLocation ?? null
  const locationDenied = input.locationDenied ?? userLocation === null
  const catalog = filterTonightCatalog(input.venues)
  const lastCity = (input.savedCity ?? readSavedCity() ?? 'Seattle').trim() || 'Seattle'
  const followedVenueIds = input.followedVenueIds ?? []
  const rankContext: TonightRankContext = { followedVenueIds }
  const neighborhood = resolveHomeNeighborhood(
    catalog,
    userLocation,
    input.savedVenueIds ?? [],
    { savedNeighborhood: input.savedNeighborhood, savedCity: lastCity },
  )
  const surging = getSurgingNearbyVenues(catalog, input.pulses, {
    userLocation,
    nowMs,
    limit: TONIGHT_CARD_LIMIT,
  })
  const recent = catalog.filter((venue) => hasRecentPulse(venue.id, input.pulses, nowMs))
  const inHood = recent.filter((venue) => venue.neighborhood === neighborhood)
  const followedNearby = recent.filter((venue) => (
    followedNearbyFloat(
      venue,
      venuePulseSignals(venue.id, input.pulses, nowMs),
      userLocation,
      followedVenueIds,
    ) > 0
  ))
  const base = inHood.length > 0 ? inHood : (recent.length > 0 ? recent : surging)
  const pool = new Map<string, Venue>()
  for (const venue of [...base, ...followedNearby]) pool.set(venue.id, venue)
  const ranked = [...pool.values()]
    .sort((a, b) => compareTonightRank(a, b, input.pulses, now, userLocation, rankContext))
    .slice(0, TONIGHT_CARD_LIMIT)
  const picks = ranked.map((venue) => pickLine(venue, input.pulses, nowMs))
  const startHere = picks[0] ?? null
  const heatingUp = picks.slice(1, 4)
  const surgingPicks = picks.slice(4, TONIGHT_CARD_LIMIT)

  let empty: TonightEmptyState | null = null
  let resolvedStart = startHere
  if (!startHere) {
    const focus = normalizeNeighborhoodName(neighborhood) === 'Capitol Hill'
    empty = focus
      ? { ...TONIGHT_EMPTY_LOOP, body: focusHoodEmptyBody() }
      : TONIGHT_EMPTY_LOOP
    const hoodCatalog = catalog.filter((venue) => venue.neighborhood === neighborhood)
    const fallbackPool = hoodCatalog.length > 0 ? hoodCatalog : catalog
    const nearbyCurated = [...fallbackPool].sort((a, b) => {
      if (!userLocation) return 0
      return calculateDistance(userLocation.lat, userLocation.lng, a.location.lat, a.location.lng)
        - calculateDistance(userLocation.lat, userLocation.lng, b.location.lat, b.location.lng)
    })
    if (nearbyCurated[0]) {
      resolvedStart = pickLine(nearbyCurated[0], input.pulses, nowMs, undefined, true)
    }
  }

  return {
    title: `Tonight · ${neighborhood}`,
    subtitle: locationDenied
      ? `${formatTonightClock(now)} · Launch 33 fallback · ${lastCity} · based on time + saves`
      : `${formatTonightClock(now)} · based on time + saves`,
    neighborhood,
    startHere: resolvedStart,
    heatingUp,
    surging: surgingPicks,
    empty,
    locationDenied,
  }
}
