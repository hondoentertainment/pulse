import type { Pulse, User, Venue, EnergyRating } from './types'

/** Phase 7.2 - Integration Ecosystem */

export type IntegrationType = 'rideshare' | 'music' | 'reservation' | 'maps' | 'shortcuts' | 'tickets'

export interface RideshareLink {
  provider: 'uber' | 'lyft'
  deepLink: string
  estimatedMinutes: number
  surgeMultiplier?: number
  label: string
}

export interface SpotifyNowPlaying {
  venueId: string
  trackName: string
  artistName: string
  albumArt?: string
  playlistId?: string
  playlistName?: string
  launchUrl?: string
  updatedAt: string
}

interface VenueTrackTemplate {
  trackName: string
  artistName: string
}

export interface ReservationLink {
  provider: 'opentable' | 'resy'
  venueId: string
  deepLink: string
  available: boolean
  nextSlot?: string
  kind?: 'direct' | 'search'
}

export interface MapsEnergyLayer {
  venues: { id: string; lat: number; lng: number; energy: EnergyRating; score: number }[]
  generatedAt: string
}

export interface ShortcutAction {
  id: string
  name: string
  description: string
  type: 'tonight' | 'nearby' | 'friends' | 'trending'
  parameters: Record<string, string>
}

export interface ShortcutExecutionContext {
  userLocation?: { lat: number; lng: number } | null
  currentUser?: Pick<User, 'id' | 'friends'> | null
  pulses?: Pick<Pulse, 'venueId' | 'userId' | 'createdAt'>[]
  now?: Date
}

export interface IntegrationAvailability {
  available: boolean
  reason?: string
  requiresConfig?: string[]
}

export type IntegrationAvailabilityMap = Record<IntegrationType, IntegrationAvailability>

export type IntegrationLaunchFailureReason =
  | 'invalid-url'
  | 'popup-blocked'
  | 'navigation-failed'
  | 'unavailable'

export interface IntegrationLaunchResult {
  ok: boolean
  reason?: IntegrationLaunchFailureReason
}

const SIX_HOURS_MS = 6 * 60 * 60 * 1000

function buildVenueQuery(venue: Venue): string {
  return [venue.name, venue.city, venue.state].filter(Boolean).join(' ')
}

function normalizeCustomScheme(url: string): string {
  return url.trim()
}

function encodeSvg(svg: string): string {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

function getVenuePalette(venue: Venue): [string, string] {
  const category = venue.category?.toLowerCase() ?? ''

  if (category.includes('nightclub') || category.includes('dance')) return ['#8b5cf6', '#ec4899']
  if (category.includes('music')) return ['#2563eb', '#14b8a6']
  if (category.includes('restaurant')) return ['#f97316', '#facc15']
  if (category.includes('bar') || category.includes('brewery') || category.includes('lounge')) return ['#f97316', '#ef4444']
  return ['#0f766e', '#22c55e']
}

function createVenueAlbumArt(venue: Venue): string {
  const [start, end] = getVenuePalette(venue)
  const initials = venue.name
    .split(/\s+/)
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return encodeSvg(
    `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200" role="img" aria-label="${venue.name}">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${start}" />
          <stop offset="100%" stop-color="${end}" />
        </linearGradient>
      </defs>
      <rect width="200" height="200" rx="28" fill="url(#g)" />
      <circle cx="154" cy="50" r="22" fill="rgba(255,255,255,0.18)" />
      <circle cx="58" cy="142" r="34" fill="rgba(255,255,255,0.12)" />
      <text x="100" y="114" text-anchor="middle" font-family="Arial, sans-serif" font-size="58" font-weight="700" fill="white">${initials}</text>
    </svg>`
  )
}

function pickTrackByCategory(venue: Venue, hour: number): VenueTrackTemplate {
  const category = venue.category?.toLowerCase() ?? ''
  const trackPools: Record<string, VenueTrackTemplate[]> = {
    nightclub: [
      { trackName: 'Neon Afterglow', artistName: 'Velvet Current' },
      { trackName: 'Pulse Runner', artistName: 'Nova District' },
      { trackName: 'Strobe Hearts', artistName: 'Signal Arcade' },
    ],
    'music venue': [
      { trackName: 'Soundcheck Lights', artistName: 'North Arcade' },
      { trackName: 'Backline Dreams', artistName: 'City Echoes' },
      { trackName: 'Encore Avenue', artistName: 'Paper Satellites' },
    ],
    restaurant: [
      { trackName: 'Table for Two', artistName: 'Golden Hour Society' },
      { trackName: 'Slow Burn Citrus', artistName: 'Saint Magnolia' },
      { trackName: 'Side Street Stories', artistName: 'Mosaic Room' },
    ],
    bar: [
      { trackName: 'Last Call Radio', artistName: 'The Night Owls' },
      { trackName: 'Corner Booth', artistName: 'Harbor Static' },
      { trackName: 'Friends of Friends', artistName: 'Oak Room Club' },
    ],
    cafe: [
      { trackName: 'Steam and Vinyl', artistName: 'Maple Transit' },
      { trackName: 'Window Seat', artistName: 'Soft Current' },
      { trackName: 'Morning Bloom', artistName: 'Lumen House' },
    ],
  }

  let selectedPool = trackPools.bar
  if (category.includes('nightclub') || category.includes('dance')) selectedPool = trackPools.nightclub
  else if (category.includes('music')) selectedPool = trackPools['music venue']
  else if (category.includes('restaurant')) selectedPool = trackPools.restaurant
  else if (category.includes('cafe')) selectedPool = trackPools.cafe
  else if (category.includes('bar') || category.includes('brewery') || category.includes('lounge')) selectedPool = trackPools.bar

  return selectedPool[(hour + venue.pulseScore + venue.name.length) % selectedPool.length]
}

export function getVenueNowPlaying(venue: Venue, now: Date = new Date()): SpotifyNowPlaying {
  const hour = now.getHours()
  const track = pickTrackByCategory(venue, hour)
  const playlistName = venue.integrations?.music?.playlistName
    ?? `${venue.name} ${hour >= 18 ? 'After Dark' : hour >= 12 ? 'Day Shift' : 'Opening Set'}`

  return createSpotifyNowPlaying(
    venue.id,
    track.trackName,
    track.artistName,
    {
      playlistName,
      albumArt: createVenueAlbumArt(venue),
      launchUrl: getVenueMusicUrl(venue),
    }
  )
}

export function validateIntegrationUrl(url: string): boolean {
  if (!url || !url.trim()) return false

  const trimmed = url.trim()
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) && !/^https?:/i.test(trimmed)) {
    return true
  }

  try {
    const parsed = new URL(trimmed)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export function generateRideshareLink(
  provider: 'uber' | 'lyft',
  venue: Venue,
  userLat: number,
  userLng: number,
  surgeMultiplier?: number
): RideshareLink {
  const dist = Math.sqrt(Math.pow(venue.location.lat - userLat, 2) + Math.pow(venue.location.lng - userLng, 2))
  const estimatedMinutes = Math.max(3, Math.round(dist * 100))
  const base = provider === 'uber'
    ? `uber://?action=setPickup&dropoff[latitude]=${venue.location.lat}&dropoff[longitude]=${venue.location.lng}&dropoff[nickname]=${encodeURIComponent(venue.name)}`
    : `lyft://ridetype?id=lyft&destination[latitude]=${venue.location.lat}&destination[longitude]=${venue.location.lng}`
  return {
    provider,
    deepLink: base,
    estimatedMinutes,
    surgeMultiplier,
    label: surgeMultiplier && surgeMultiplier > 1.5
      ? `${provider === 'uber' ? 'Uber' : 'Lyft'} (~${estimatedMinutes}min, surge pricing)`
      : `${provider === 'uber' ? 'Uber' : 'Lyft'} (~${estimatedMinutes}min)`,
  }
}

export function getBestRideshareOption(venue: Venue, userLat: number, userLng: number): RideshareLink {
  const uber = generateRideshareLink('uber', venue, userLat, userLng)
  const lyft = generateRideshareLink('lyft', venue, userLat, userLng)
  return uber.estimatedMinutes <= lyft.estimatedMinutes ? uber : lyft
}

export function createSpotifyNowPlaying(
  venueId: string,
  trackName: string,
  artistName: string,
  opts?: { albumArt?: string; playlistId?: string; playlistName?: string; launchUrl?: string }
): SpotifyNowPlaying {
  return {
    venueId,
    trackName,
    artistName,
    albumArt: opts?.albumArt,
    playlistId: opts?.playlistId,
    playlistName: opts?.playlistName,
    launchUrl: opts?.launchUrl,
    updatedAt: new Date().toISOString(),
  }
}

export function getVenueMusicUrl(venue: Venue): string {
  if (venue.integrations?.music?.spotifyUrl) return venue.integrations.music.spotifyUrl

  const query = venue.integrations?.music?.searchTerm
    ?? venue.integrations?.music?.playlistName
    ?? `${venue.name} ${venue.city ?? ''} vibes`

  return `https://open.spotify.com/search/${encodeURIComponent(query.trim())}`
}

export function formatSpotifyDisplay(np: SpotifyNowPlaying): string {
  let s = `${np.trackName} by ${np.artistName}`
  if (np.playlistName) s += ` • ${np.playlistName}`
  return s
}

export function createReservationLink(
  provider: 'opentable' | 'resy',
  venueId: string,
  externalId: string,
  available: boolean,
  nextSlot?: string,
  deepLinkOverride?: string
): ReservationLink {
  const deepLink = deepLinkOverride ?? (provider === 'opentable'
    ? `https://www.opentable.com/r/${externalId}`
    : `https://resy.com/cities/venue/${externalId}`)
  return { provider, venueId, deepLink, available, nextSlot, kind: 'direct' }
}

export function buildReservationSearchLink(provider: 'opentable' | 'resy', venue: Venue): ReservationLink {
  const query = buildVenueQuery(venue)
  const deepLink = provider === 'opentable'
    ? `https://www.opentable.com/s?term=${encodeURIComponent(query)}`
    : `https://resy.com/search?query=${encodeURIComponent(query)}`
  return {
    provider,
    venueId: venue.id,
    deepLink,
    available: true,
    kind: 'search',
  }
}

export function getVenueReservationLinks(venue: Venue): ReservationLink[] {
  const links: ReservationLink[] = []

  if (venue.integrations?.reservations?.opentableUrl) {
    links.push(createReservationLink('opentable', venue.id, '', true, undefined, venue.integrations.reservations.opentableUrl))
  } else
  if (venue.integrations?.reservations?.opentableId) {
    links.push(createReservationLink('opentable', venue.id, venue.integrations.reservations.opentableId, true))
  } else if (venue.name) {
    links.push(buildReservationSearchLink('opentable', venue))
  }

  if (venue.integrations?.reservations?.resyUrl) {
    links.push(createReservationLink('resy', venue.id, '', true, undefined, venue.integrations.reservations.resyUrl))
  } else
  if (venue.integrations?.reservations?.resyId) {
    links.push(createReservationLink('resy', venue.id, venue.integrations.reservations.resyId, true))
  } else if (venue.name) {
    links.push(buildReservationSearchLink('resy', venue))
  }

  return links
}

export function getAvailableReservations(links: ReservationLink[]): ReservationLink[] {
  return links.filter(l => l.available)
}

export function generateMapsEnergyLayer(venues: Venue[]): MapsEnergyLayer {
  const ENERGY_LABELS: EnergyRating[] = ['dead', 'chill', 'buzzing', 'electric']
  return {
    venues: venues.map(v => ({
      id: v.id,
      lat: v.location.lat,
      lng: v.location.lng,
      energy: ENERGY_LABELS[Math.min(3, Math.round(v.pulseScore / 33))],
      score: v.pulseScore,
    })),
    generatedAt: new Date().toISOString(),
  }
}

export function getVenueMapsUrl(venue: Venue): string {
  if (venue.integrations?.maps?.googleMapsUrl) return venue.integrations.maps.googleMapsUrl

  if (venue.location.address) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue.location.address)}`
  }

  return `https://www.google.com/maps/search/?api=1&query=${venue.location.lat},${venue.location.lng}`
}

export function getVenueTicketUrl(venue: Venue): string {
  if (venue.website) return venue.website

  const query = `${buildVenueQuery(venue)} tickets`
  return `https://www.google.com/search?q=${encodeURIComponent(query.trim())}`
}

export function getShortcutActions(): ShortcutAction[] {
  return [
    { id: 'tonight', name: 'Where should I go tonight?', description: 'Get top trending venues near you', type: 'tonight', parameters: {} },
    { id: 'nearby', name: 'What\'s nearby?', description: 'Find active venues within walking distance', type: 'nearby', parameters: { radius: '0.5' } },
    { id: 'friends', name: 'Where are my friends?', description: 'See which venues your friends are active at', type: 'friends', parameters: {} },
    { id: 'trending', name: 'What\'s trending?', description: 'Top surging venues in your city', type: 'trending', parameters: { limit: '5' } },
  ]
}

function calculateCrowFlightDistance(
  userLocation: { lat: number; lng: number },
  venue: Venue
): number {
  const latDelta = venue.location.lat - userLocation.lat
  const lngDelta = venue.location.lng - userLocation.lng
  return Math.sqrt(latDelta * latDelta + lngDelta * lngDelta)
}

function getFriendActiveVenueIds(
  currentUser: Pick<User, 'friends'> | null | undefined,
  pulses: Pick<Pulse, 'venueId' | 'userId' | 'createdAt'>[] | undefined,
  now: number
): Map<string, number> {
  const recentFriendActivity = new Map<string, number>()
  const friendIds = new Set(currentUser?.friends ?? [])
  if (friendIds.size === 0 || !pulses || pulses.length === 0) return recentFriendActivity

  for (const pulse of pulses) {
    const createdAt = new Date(pulse.createdAt).getTime()
    if (!friendIds.has(pulse.userId) || Number.isNaN(createdAt)) continue
    if (now - createdAt > SIX_HOURS_MS) continue
    recentFriendActivity.set(pulse.venueId, (recentFriendActivity.get(pulse.venueId) ?? 0) + 1)
  }

  return recentFriendActivity
}

export function executeShortcut(
  action: ShortcutAction,
  venues: Venue[],
  limit: number = 5,
  context: ShortcutExecutionContext = {}
): Venue[] {
  switch (action.type) {
    case 'tonight':
    case 'trending':
      return [...venues].sort((a, b) => b.pulseScore - a.pulseScore).slice(0, limit)
    case 'nearby':
      if (context.userLocation) {
        return [...venues]
          .sort((a, b) => calculateCrowFlightDistance(context.userLocation!, a) - calculateCrowFlightDistance(context.userLocation!, b))
          .slice(0, limit)
      }
      return [...venues].sort((a, b) => b.pulseScore - a.pulseScore).slice(0, limit)
    case 'friends': {
      const friendVenueCounts = getFriendActiveVenueIds(
        context.currentUser,
        context.pulses,
        (context.now ?? new Date()).getTime()
      )

      if (friendVenueCounts.size === 0) return []

      return [...venues]
        .filter(venue => friendVenueCounts.has(venue.id))
        .sort((a, b) => {
          const friendCountDelta = (friendVenueCounts.get(b.id) ?? 0) - (friendVenueCounts.get(a.id) ?? 0)
          if (friendCountDelta !== 0) return friendCountDelta
          return b.pulseScore - a.pulseScore
        })
        .slice(0, limit)
    }
    default:
      return [...venues].slice(0, limit)
  }
}

export function getIntegrationStatus(
  type: IntegrationType,
  options?: { configured?: boolean }
): { available: boolean; configRequired: string[] } {
  const configs: Record<IntegrationType, string[]> = {
    rideshare: ['UBER_CLIENT_ID', 'LYFT_CLIENT_ID'],
    music: ['SPOTIFY_CLIENT_ID', 'SPOTIFY_CLIENT_SECRET'],
    reservation: ['OPENTABLE_API_KEY'],
    maps: ['GOOGLE_MAPS_API_KEY'],
    shortcuts: [],
    tickets: [],
  }

  const configRequired = configs[type]
  return {
    available: configRequired.length === 0 || Boolean(options?.configured),
    configRequired,
  }
}

export function getVenueIntegrationAvailability(
  venue: Venue,
  userLocation: { lat: number; lng: number } | null
): IntegrationAvailabilityMap {
  const hasReservations = getVenueReservationLinks(venue).length > 0

  return {
    rideshare: userLocation
      ? { available: true }
      : { available: false, reason: 'Enable location to compare ride options.' },
    music: validateIntegrationUrl(getVenueMusicUrl(venue))
      ? { available: true }
      : { available: false, reason: 'Music link is not configured yet.' },
    reservation: hasReservations
      ? { available: true }
      : { available: false, reason: 'No reservation partner linked for this venue.' },
    maps: validateIntegrationUrl(getVenueMapsUrl(venue))
      ? { available: true }
      : { available: false, reason: 'Map link is not available for this venue.' },
    shortcuts: { available: true },
    tickets: validateIntegrationUrl(getVenueTicketUrl(venue))
      ? { available: true }
      : { available: false, reason: 'Ticket link is not available for this venue.' },
  }
}

export function launchIntegrationUrl(
  url: string,
  options?: {
    opener?: (url?: string, target?: string, features?: string) => Window | null
    locationAssign?: (url: string) => void
    target?: string
  }
): IntegrationLaunchResult {
  if (!validateIntegrationUrl(url)) {
    return { ok: false, reason: 'invalid-url' }
  }

  const trimmed = url.trim()
  const isCustomScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) && !/^https?:/i.test(trimmed)

  try {
    if (isCustomScheme) {
      if (!options?.locationAssign) {
        return { ok: false, reason: 'navigation-failed' }
      }
      options.locationAssign(normalizeCustomScheme(trimmed))
      return { ok: true }
    }

    const openedWindow = options?.opener?.(trimmed, options?.target ?? '_blank', 'noopener,noreferrer')
    if (openedWindow === null) {
      return { ok: false, reason: 'popup-blocked' }
    }

    return { ok: true }
  } catch {
    return { ok: false, reason: 'navigation-failed' }
  }
}
