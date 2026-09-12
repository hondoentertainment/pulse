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
import {
  DEFAULT_LAUNCH_NEIGHBORHOOD,
  inferNeighborhoodFromGeo,
  persistHomePlace,
  readSavedCity,
  readSavedNeighborhood,
  resolveNeighborhoodFallback,
} from './neighborhood-geo'

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
  empty: TonightEmptyState | null
  locationDenied: boolean
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

function rankScore(
  venue: Venue,
  pulses: Pulse[],
  now: Date,
  userLocation: { lat: number; lng: number } | null,
): number {
  const activity = getVenueMapActivity(venue, pulses, now.getTime())
  const distance = userLocation
    ? calculateDistance(userLocation.lat, userLocation.lng, venue.location.lat, venue.location.lng)
    : 2
  const recencyBoost = activity.latest ? 20 : 0
  return recencyBoost + activity.liveReviewCount * 8 + timeOfDayBoost(venue.category, now.getHours()) - distance * 4
}

/** Prefer curated / quality pins when energy + distance are tied. */
export function compareTonightRank(
  a: Venue,
  b: Venue,
  pulses: Pulse[],
  now: Date,
  userLocation: { lat: number; lng: number } | null,
): number {
  const scoreDiff = rankScore(b, pulses, now, userLocation) - rankScore(a, pulses, now, userLocation)
  if (scoreDiff !== 0) return scoreDiff
  const curatedDiff = Number(isCuratedVenue(b)) - Number(isCuratedVenue(a))
  if (curatedDiff !== 0) return curatedDiff
  const claimDiff = Number(Boolean(b.claimVerified)) - Number(Boolean(a.claimVerified))
  if (claimDiff !== 0) return claimDiff
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

/** Signed-in Following: persisted follows + each venue’s latest live pulse. */
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

export function buildTonightHome(input: {
  venues: Venue[]
  pulses: Pulse[]
  userLocation?: { lat: number; lng: number } | null
  savedVenueIds?: readonly string[]
  now?: Date
  locationDenied?: boolean
  savedNeighborhood?: string | null
}): TonightHome {
  const now = input.now ?? new Date()
  const nowMs = now.getTime()
  const userLocation = input.userLocation ?? null
  const locationDenied = input.locationDenied ?? userLocation === null
  const catalog = filterTonightCatalog(input.venues)
  const neighborhood = resolveHomeNeighborhood(
    catalog,
    userLocation,
    input.savedVenueIds ?? [],
    { savedNeighborhood: input.savedNeighborhood },
  )
  const surging = getSurgingNearbyVenues(catalog, input.pulses, {
    userLocation,
    nowMs,
    limit: 8,
  })
  const inHood = surging.filter((venue) => venue.neighborhood === neighborhood)
  const ranked = [...(inHood.length > 0 ? inHood : surging)].sort((a, b) => (
    compareTonightRank(a, b, input.pulses, now, userLocation)
  ))
  const startHere = ranked[0] ? pickLine(ranked[0], input.pulses, nowMs) : null
  const heatingUp = ranked.slice(1, 4).map((venue) => pickLine(venue, input.pulses, nowMs))

  let empty: TonightEmptyState | null = null
  let resolvedStart = startHere
  if (!startHere) {
    const inHood = catalog.filter((venue) => venue.neighborhood === neighborhood)
    const pool = inHood.length > 0 ? inHood : catalog
    const nearbyCurated = [...pool].sort((a, b) => {
      if (!userLocation) return 0
      return calculateDistance(userLocation.lat, userLocation.lng, a.location.lat, a.location.lng)
        - calculateDistance(userLocation.lat, userLocation.lng, b.location.lat, b.location.lng)
    })
    if (nearbyCurated[0]) {
      resolvedStart = pickLine(nearbyCurated[0], input.pulses, nowMs, undefined, true)
    } else {
      empty = TONIGHT_EMPTY_LOOP
    }
  }

  return {
    title: `Tonight · ${neighborhood}`,
    subtitle: locationDenied
      ? `${formatTonightClock(now)} · Launch 33 fallback · based on time + saves`
      : `${formatTonightClock(now)} · based on time + saves`,
    neighborhood,
    startHere: resolvedStart,
    heatingUp,
    empty,
    locationDenied,
  }
}
