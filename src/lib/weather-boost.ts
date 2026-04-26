/**
 * Weather-aware venue ranking.
 *
 * Given a set of venues and a weather observation, apply a deterministic
 * delta to `contextualScore`:
 *
 *   raining       -> indoor +10, outdoor -15
 *   sunny + warm  -> outdoor / rooftop +10
 *   cold          -> outdoor -5
 *   snow          -> outdoor -20
 *   storm         -> outdoor -20, indoor +5 (hunker down)
 *   windy > 35kph -> rooftop -10
 *   low visibility (< 2km)  -> outdoor -5
 *
 * This is a PURE function: it returns a new array and never mutates input.
 */

import type { Venue, WeatherCondition, WeatherPayload } from './types'

export const WEATHER_BOOSTS = {
  rainIndoor: 10,
  rainOutdoor: -15,
  sunnyWarmOutdoor: 10,
  coldOutdoor: -5,
  snowOutdoor: -20,
  stormOutdoor: -20,
  stormIndoor: 5,
  windyRooftop: -10,
  lowVisibilityOutdoor: -5,
} as const

export const SUNNY_WARM_THRESHOLD_C = 18
export const COLD_THRESHOLD_C = 5
export const WINDY_THRESHOLD_KPH = 35
export const LOW_VISIBILITY_KM = 2

export interface WeatherLike {
  condition: WeatherCondition
  tempC: number
  windKph: number
  visibilityKm: number
  precipitationPct?: number
}

const hasRooftop = (v: Venue): boolean => {
  const needle = `${v.name ?? ''} ${v.category ?? ''}`.toLowerCase()
  return needle.includes('rooftop') || needle.includes('roof-top')
}

const isOutdoor = (v: Venue): boolean =>
  v.indoorOutdoor === 'outdoor' || v.indoorOutdoor === 'both' || hasRooftop(v)

const isIndoor = (v: Venue): boolean =>
  v.indoorOutdoor === 'indoor' || v.indoorOutdoor === 'both'

/**
 * Return the delta (not the new score) the given weather applies to a venue.
 * Exposed for inspection / unit tests.
 */
export function computeWeatherDelta(venue: Venue, weather: WeatherLike): number {
  let delta = 0
  const outdoor = isOutdoor(venue)
  const indoor = isIndoor(venue)
  const rooftop = hasRooftop(venue)

  switch (weather.condition) {
    case 'rain':
      if (indoor) delta += WEATHER_BOOSTS.rainIndoor
      if (outdoor) delta += WEATHER_BOOSTS.rainOutdoor
      break
    case 'snow':
      if (outdoor) delta += WEATHER_BOOSTS.snowOutdoor
      if (indoor) delta += WEATHER_BOOSTS.rainIndoor
      break
    case 'storm':
      if (outdoor) delta += WEATHER_BOOSTS.stormOutdoor
      if (indoor) delta += WEATHER_BOOSTS.stormIndoor
      break
    case 'clear':
      if (outdoor && weather.tempC >= SUNNY_WARM_THRESHOLD_C) {
        delta += WEATHER_BOOSTS.sunnyWarmOutdoor
      }
      if (outdoor && weather.tempC <= COLD_THRESHOLD_C) {
        delta += WEATHER_BOOSTS.coldOutdoor
      }
      break
    case 'cloudy':
    case 'fog':
    case 'unknown':
    default:
      // no-op for the condition axis
      break
  }

  // Condition-independent axes
  if (rooftop && weather.windKph >= WINDY_THRESHOLD_KPH) {
    delta += WEATHER_BOOSTS.windyRooftop
  }
  if (outdoor && weather.visibilityKm <= LOW_VISIBILITY_KM) {
    delta += WEATHER_BOOSTS.lowVisibilityOutdoor
  }

  return delta
}

/**
 * Apply weather-driven deltas to a set of venues.  Returns a new array
 * (does not mutate).  If `weather` is null/undefined, the array is returned
 * unchanged (aside from coercing contextualScore to a number if present).
 */
export function applyWeatherBoost(
  venues: Venue[],
  weather: WeatherLike | null | undefined,
): Venue[] {
  if (!Array.isArray(venues)) return []
  if (!weather) {
    return venues.map((v) => ({ ...v }))
  }
  return venues.map((venue) => {
    const base = typeof venue.contextualScore === 'number' ? venue.contextualScore : 0
    const delta = computeWeatherDelta(venue, weather)
    return { ...venue, contextualScore: base + delta }
  })
}

/**
 * Convert a WeatherPayload (from /api/weather/current) into the lighter
 * WeatherLike shape used by applyWeatherBoost. Safe on partial payloads.
 */
export function toWeatherLike(payload: Partial<WeatherPayload> | null | undefined): WeatherLike | null {
  if (!payload) return null
  return {
    condition: payload.condition ?? 'unknown',
    tempC: typeof payload.tempC === 'number' ? payload.tempC : 15,
    windKph: typeof payload.windKph === 'number' ? payload.windKph : 0,
    visibilityKm: typeof payload.visibilityKm === 'number' ? payload.visibilityKm : 10,
    precipitationPct: payload.precipitationPct,
  }
}
