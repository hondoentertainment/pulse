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

export function listTonightFollowingVenues(
  venues: Venue[],
  savedVenueIds: readonly string[] = [],
  followedVenueIds: readonly string[] = [],
): Venue[] {
  const saved = new Set([...savedVenueIds, ...followedVenueIds])
  if (saved.size === 0) return []
  return venues.filter((venue) => saved.has(venue.id))
}

/** Geo-sorted catalog, or Launch 33 when location is off. Never invents venues. */
export function listTonightNearVenues(
  venues: Venue[],
  userLocation: { lat: number; lng: number } | null,
  limit = 8,
): { venues: Venue[]; usedLaunch33Fallback: boolean } {
  const catalog = filterTonightCatalog(venues)
  if (!userLocation) {
    return {
      venues: catalog.filter((venue) => isCuratedVenue(venue)).slice(0, limit),
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
    rankScore(b, input.pulses, now, userLocation) - rankScore(a, input.pulses, now, userLocation)
  ))
  const startHere = ranked[0] ? pickLine(ranked[0], input.pulses, nowMs) : null
  const heatingUp = ranked.slice(1, 4).map((venue) => pickLine(venue, input.pulses, nowMs))

  let empty: TonightEmptyState | null = null
  let resolvedStart = startHere
  if (!startHere) {
    empty = TONIGHT_EMPTY_LOOP
    const nearbyCurated = catalog
      .filter((venue) => venue.neighborhood === neighborhood || !userLocation)
      .sort((a, b) => {
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
      ? `${formatTonightClock(now)} · Launch 33 fallback · based on time + saves`
      : `${formatTonightClock(now)} · based on time + saves`,
    neighborhood,
    startHere: resolvedStart,
    heatingUp,
    empty,
    locationDenied,
  }
}
