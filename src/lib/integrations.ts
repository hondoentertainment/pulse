import type { Venue, EnergyRating } from './types'

/** Phase 7.2 — Integration Ecosystem */

export type IntegrationType = 'rideshare' | 'music' | 'reservation' | 'maps' | 'shortcuts'

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
  updatedAt: string
}

export interface ReservationLink {
  provider: 'opentable' | 'resy'
  venueId: string
  deepLink: string
  available: boolean
  nextSlot?: string
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

export function generateRideshareLink(
  provider: 'uber' | 'lyft', venue: Venue,
  userLat: number, userLng: number, surgeMultiplier?: number
): RideshareLink {
  const dist = Math.sqrt(Math.pow(venue.location.lat - userLat, 2) + Math.pow(venue.location.lng - userLng, 2))
  const estimatedMinutes = Math.max(3, Math.round(dist * 100))
  const base = provider === 'uber'
    ? `uber://?action=setPickup&dropoff[latitude]=${venue.location.lat}&dropoff[longitude]=${venue.location.lng}&dropoff[nickname]=${encodeURIComponent(venue.name)}`
    : `lyft://ridetype?id=lyft&destination[latitude]=${venue.location.lat}&destination[longitude]=${venue.location.lng}`
  return {
    provider, deepLink: base, estimatedMinutes,
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

export function createSpotifyNowPlaying(venueId: string, trackName: string, artistName: string, opts?: { albumArt?: string; playlistId?: string; playlistName?: string }): SpotifyNowPlaying {
  return {
    venueId, trackName, artistName,
    albumArt: opts?.albumArt, playlistId: opts?.playlistId, playlistName: opts?.playlistName,
    updatedAt: new Date().toISOString(),
  }
}

export function formatSpotifyDisplay(np: SpotifyNowPlaying): string {
  let s = `${np.trackName} by ${np.artistName}`
  if (np.playlistName) s += ` • ${np.playlistName}`
  return s
}

export function createReservationLink(provider: 'opentable' | 'resy', venueId: string, externalId: string, available: boolean, nextSlot?: string): ReservationLink {
  const deepLink = provider === 'opentable'
    ? `https://www.opentable.com/r/${externalId}`
    : `https://resy.com/cities/venue/${externalId}`
  return { provider, venueId, deepLink, available, nextSlot }
}

export function getAvailableReservations(links: ReservationLink[]): ReservationLink[] {
  return links.filter(l => l.available)
}

export function generateMapsEnergyLayer(venues: Venue[]): MapsEnergyLayer {
  const ENERGY_LABELS: EnergyRating[] = ['dead', 'chill', 'buzzing', 'electric']
  return {
    venues: venues.map(v => ({
      id: v.id, lat: v.location.lat, lng: v.location.lng,
      energy: ENERGY_LABELS[Math.min(3, Math.round(v.pulseScore / 33))],
      score: v.pulseScore,
    })),
    generatedAt: new Date().toISOString(),
  }
}

export function getShortcutActions(): ShortcutAction[] {
  return [
    { id: 'tonight', name: 'Where should I go tonight?', description: 'Get top trending venues near you', type: 'tonight', parameters: {} },
    { id: 'nearby', name: 'What\'s nearby?', description: 'Find active venues within walking distance', type: 'nearby', parameters: { radius: '0.5' } },
    { id: 'friends', name: 'Where are my friends?', description: 'See which venues your friends are at', type: 'friends', parameters: {} },
    { id: 'trending', name: 'What\'s trending?', description: 'Top surging venues in your city', type: 'trending', parameters: { limit: '5' } },
  ]
}

export function executeShortcut(action: ShortcutAction, venues: Venue[], limit: number = 5): Venue[] {
  switch (action.type) {
    case 'tonight':
    case 'trending':
      return venues.sort((a, b) => b.pulseScore - a.pulseScore).slice(0, limit)
    case 'nearby':
      return venues.slice(0, limit)
    case 'friends':
      return venues.slice(0, limit)
    default:
      return venues.slice(0, limit)
  }
}

export function getIntegrationStatus(type: IntegrationType): { available: boolean; configRequired: string[] } {
  const configs: Record<IntegrationType, string[]> = {
    rideshare: ['UBER_CLIENT_ID', 'LYFT_CLIENT_ID'],
    music: ['SPOTIFY_CLIENT_ID', 'SPOTIFY_CLIENT_SECRET'],
    reservation: ['OPENTABLE_API_KEY'],
    maps: ['GOOGLE_MAPS_API_KEY'],
    shortcuts: [],
  }
  return { available: configs[type].length === 0, configRequired: configs[type] }
}
