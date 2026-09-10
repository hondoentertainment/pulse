/**
 * "For tonight" home header — time + neighborhood, start-here pick,
 * and heating-up rail. Ranked from live reviews + saves, not invented energy.
 */

import type { Pulse, Venue } from './types'
import { calculateDistance, getEnergyLabel } from './pulse-engine'
import {
  getSurgingNearbyVenues,
  getVenueMapActivity,
  type VenueMapActivity,
} from './map-live-reviews'
import { ENERGY_CONFIG, type EnergyRating } from './types'

export interface TonightHomePick {
  venue: Venue
  energyLabel: string
  energyRating?: EnergyRating
  headline: string
  trustLine: string
}

export interface TonightHome {
  title: string
  subtitle: string
  neighborhood: string
  startHere: TonightHomePick | null
  heatingUp: TonightHomePick[]
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

export function resolveHomeNeighborhood(
  venues: Venue[],
  userLocation: { lat: number; lng: number } | null,
  savedVenueIds: readonly string[] = [],
): string {
  const saved = new Set(savedVenueIds)
  const withHood = venues.filter((venue) => (venue.neighborhood ?? '').trim().length > 0)
  if (withHood.length === 0) return 'Seattle'

  const scored = withHood.map((venue) => {
    const distance = userLocation
      ? calculateDistance(userLocation.lat, userLocation.lng, venue.location.lat, venue.location.lng)
      : Number.POSITIVE_INFINITY
    const savedBoost = saved.has(venue.id) ? -100 : 0
    return { venue, rank: distance + savedBoost }
  })
  scored.sort((a, b) => a.rank - b.rank)
  return scored[0]?.venue.neighborhood?.trim() || 'Seattle'
}

function pickLine(
  venue: Venue,
  pulses: Pulse[],
  nowMs: number,
  activity?: VenueMapActivity,
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
    headline: `${venue.name} is ${energyLabel} right now`,
    trustLine: energyLabel,
  }
}

export function buildTonightHome(input: {
  venues: Venue[]
  pulses: Pulse[]
  userLocation?: { lat: number; lng: number } | null
  savedVenueIds?: readonly string[]
  now?: Date
}): TonightHome {
  const now = input.now ?? new Date()
  const nowMs = now.getTime()
  const neighborhood = resolveHomeNeighborhood(
    input.venues,
    input.userLocation ?? null,
    input.savedVenueIds ?? [],
  )
  const surging = getSurgingNearbyVenues(input.venues, input.pulses, {
    userLocation: input.userLocation ?? null,
    nowMs,
    limit: 6,
  })
  const inHood = surging.filter((venue) => venue.neighborhood === neighborhood)
  const ranked = (inHood.length > 0 ? inHood : surging)
  const startHere = ranked[0] ? pickLine(ranked[0], input.pulses, nowMs) : null
  const heatingUp = ranked.slice(1, 4).map((venue) => pickLine(venue, input.pulses, nowMs))

  return {
    title: `Tonight · ${neighborhood}`,
    subtitle: `${formatTonightClock(now)} · based on time + saves`,
    neighborhood,
    startHere,
    heatingUp,
  }
}
