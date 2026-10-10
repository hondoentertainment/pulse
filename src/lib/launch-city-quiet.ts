/**
 * Quiet night for a launched city that is not the default (Seattle).
 * Portland Friday is the first case. The empty state and the push both
 * refuse to invent a crowd: a room counts only when it has zero pulses tonight.
 */

import {
  coastCityByKey,
  DEFAULT_COAST_CITY_KEY,
  type CoastCity,
  type CoastCityKey,
} from './coast-cities'
import { coastCityKeyForLaunchShareId } from './coast-venue-ids'
import { localLaunchVenueIdForShareId } from './seattle-launch-venues'
import { isCuratedVenue } from './map-filters'
import { localDateKey, localHour } from './tonight-digest'
import { isQuietNightHour } from './quiet-night'
import {
  parseQuietHour,
  shouldDeliverSurgePush,
} from './venue-surge-notify'
import type { GlancePushPayload } from './glance-push'
import type { Pulse, Venue } from './types'

export const LAUNCH_QUIET_KIND = 'launch_quiet'

export interface LaunchQuietEmpty {
  cityKey: CoastCityKey
  cityName: string
  curatedLabel: string
  weekday: string
  headline: string
  body: string
  steps: readonly [string, string, string]
  cta: string
  launchLine: string
  sectionLabel: string
  venue: Venue
  followed: boolean
  roomMeta: string
  countLine: string
}

export interface LaunchQuietPushPlan {
  cityKey: CoastCityKey
  cityName: string
  weekday: string
  venueId: string
  venueName: string
  localDateKey: string
  payload: GlancePushPayload
}

export function weekdayName(now: Date, timeZone = 'America/Los_Angeles'): string {
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone }).format(now)
}

function cityKeyForVenue(venue: Pick<Venue, 'id' | 'city'>): CoastCityKey | null {
  const name = (venue.city ?? '').trim().toLowerCase()
  const fromName = name === 'san francisco'
    ? coastCityByKey('san-francisco')
    : coastCityByKey(name)
  if (fromName) return fromName.key
  const launch = coastCityKeyForLaunchShareId(venue.id)
  if (launch) return launch
  if (venue.id.startsWith('sea-') || venue.id.startsWith('venue-') || localLaunchVenueIdForShareId(venue.id)) {
    return 'seattle'
  }
  return null
}

export function catalogCityKey(venues: readonly Pick<Venue, 'id' | 'city'>[]): CoastCityKey | null {
  const keys = new Set<CoastCityKey>()
  for (const venue of venues) {
    const key = cityKeyForVenue(venue)
    if (key) keys.add(key)
  }
  if (keys.size !== 1) return null
  return [...keys][0] ?? null
}

/** Launched coast city other than Seattle. Mixed catalogs stay unresolved. */
export function launchQuietCity(venues: readonly Pick<Venue, 'id' | 'city'>[]): CoastCity | null {
  const key = catalogCityKey(venues)
  if (!key || key === DEFAULT_COAST_CITY_KEY) return null
  return coastCityByKey(key)
}

/** Every launched non-default city in a mixed catalog. The cron pushes one city at a time. */
export function launchQuietCities(venues: readonly Pick<Venue, 'id' | 'city'>[]): CoastCity[] {
  const keys = new Set<CoastCityKey>()
  for (const venue of venues) {
    const key = cityKeyForVenue(venue)
    if (key && key !== DEFAULT_COAST_CITY_KEY) keys.add(key)
  }
  return [...keys].flatMap((key) => {
    const city = coastCityByKey(key)
    return city ? [city] : []
  })
}

export function venuesInCoastCity<T extends Pick<Venue, 'id' | 'city'>>(
  venues: readonly T[],
  city: CoastCity,
): T[] {
  return venues.filter((venue) => cityKeyForVenue(venue) === city.key)
}

export function pulseOnLocalNight(pulse: Pick<Pulse, 'createdAt'>, now: Date, timeZone = 'America/Los_Angeles'): boolean {
  const created = new Date(pulse.createdAt)
  if (Number.isNaN(created.getTime())) return false
  return localDateKey(created, timeZone) === localDateKey(now, timeZone)
}

function cityVenues(venues: readonly Venue[], city: CoastCity): Venue[] {
  return venues.filter((venue) => {
    const key = catalogCityKey([venue])
    return key === city.key
  })
}

export function pickLaunchQuietRoom(input: {
  venues: readonly Venue[]
  pulses: readonly Pulse[]
  followedVenueIds?: readonly string[]
  city: CoastCity
  now?: Date
}): { venue: Venue; followed: boolean } | null {
  const now = input.now ?? new Date()
  const inCity = cityVenues(input.venues, input.city)
  if (inCity.length === 0) return null
  const followedIds = new Set(input.followedVenueIds ?? [])
  const followed = inCity.filter((venue) => followedIds.has(venue.id))
  const curated = inCity.filter((venue) => isCuratedVenue(venue))
  const watched = followed.length > 0 ? [...followed, ...curated.filter((venue) => !followedIds.has(venue.id))] : curated
  if (watched.length === 0) return null
  const tonight = new Set(
    input.pulses
      .filter((pulse) => pulseOnLocalNight(pulse, now) && !pulse.hiddenAt)
      .map((pulse) => pulse.venueId),
  )
  if (watched.some((venue) => tonight.has(venue.id))) return null
  const venue = followed[0] ?? curated[0]
  if (!venue) return null
  return { venue, followed: followedIds.has(venue.id) }
}

export function buildLaunchQuietTonight(input: {
  venues: readonly Venue[]
  pulses: readonly Pulse[]
  followedVenueIds?: readonly string[]
  now?: Date
}): LaunchQuietEmpty | null {
  const city = launchQuietCity(input.venues)
  if (!city) return null
  const now = input.now ?? new Date()
  const picked = pickLaunchQuietRoom({ ...input, city, now })
  if (!picked) return null
  const weekday = weekdayName(now)
  const rooms = picked.followed ? 'the rooms you follow' : `curated ${city.city} rooms`
  const postTarget = picked.followed ? 'a room you follow' : 'a curated room'
  const relation = picked.followed ? 'Following' : city.curatedLabel
  const place = picked.venue.neighborhood?.trim()
  return {
    cityKey: city.key,
    cityName: city.city,
    curatedLabel: city.curatedLabel,
    weekday,
    headline: `Quiet ${weekday} — no pulses yet at ${rooms}.`,
    body: `Your curated ${city.city} rooms are at 0 tonight. Post the first pulse at ${postTarget} — we never invent a crowd.`,
    steps: [
      `Open ${picked.venue.name}`,
      "Tap I'm here",
      'Post first pulse',
    ],
    cta: 'Post first pulse',
    launchLine: `${city.city} launch set: Pulse starts ${city.city} with a curated list of rooms.`,
    sectionLabel: picked.followed ? 'Rooms you follow' : city.curatedLabel,
    venue: picked.venue,
    followed: picked.followed,
    roomMeta: [place, relation].filter(Boolean).join(' · '),
    countLine: '0 · no pulses yet tonight',
  }
}

export function launchQuietRateOpen(
  lastNotifiedAt: string | null | undefined,
  now: Date,
): boolean {
  if (!lastNotifiedAt) return true
  const then = new Date(lastNotifiedAt)
  if (Number.isNaN(then.getTime())) return true
  return localDateKey(then) !== localDateKey(now)
}

export function planLaunchQuietPush(input: {
  venues: readonly Venue[]
  pulses: readonly Pulse[]
  followedVenueIds?: readonly string[]
  now?: Date
  lastNotifiedAt?: string | null
}): LaunchQuietPushPlan | null {
  const now = input.now ?? new Date()
  if (!isQuietNightHour(now)) return null
  if (!launchQuietRateOpen(input.lastNotifiedAt, now)) return null
  const empty = buildLaunchQuietTonight({ ...input, now })
  if (!empty) return null
  const venueId = empty.venue.id
  const postUrl = `/venue/${encodeURIComponent(venueId)}`
  const openUrl = '/'
  const muteUrl = `/?muteQuiet=${encodeURIComponent(empty.cityKey)}`
  const payload: GlancePushPayload = {
    title: `Quiet night in ${empty.cityName}`,
    body: `Be the first at ${empty.venue.name} — no pulses yet at the rooms you follow tonight.`,
    url: postUrl,
    kind: LAUNCH_QUIET_KIND,
    tag: `launch-quiet:${empty.cityKey}:${localDateKey(now)}`,
    renotify: false,
    actions: [
      { action: 'post', title: 'Post first pulse' },
      { action: 'open', title: `Open Tonight · ${empty.cityName}` },
      { action: 'mute', title: `Mute ${empty.weekday} prompts` },
    ],
    postUrl,
    openUrl,
    muteUrl,
  }
  return {
    cityKey: empty.cityKey,
    cityName: empty.cityName,
    weekday: empty.weekday,
    venueId,
    venueName: empty.venue.name,
    localDateKey: localDateKey(now),
    payload,
  }
}

export function shouldSendLaunchQuietPush(input: {
  followsCity: boolean
  muted: boolean
  quietStart: unknown
  quietEnd: unknown
  hour: number
}): boolean {
  if (!input.followsCity) return false
  return shouldDeliverSurgePush({
    muted: input.muted,
    quietStart: parseQuietHour(input.quietStart),
    quietEnd: parseQuietHour(input.quietEnd),
    hour: input.hour,
  })
}

export function isLaunchQuietHour(now: Date = new Date()): boolean {
  return localHour(now) === 21 && isQuietNightHour(now)
}
