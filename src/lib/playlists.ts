import type { Pulse, Venue, EnergyRating } from './types'

/**
 * Pulse Playlists & Mood Boards Engine
 *
 * Curated pulse collections by mood/theme, user-created mood boards,
 * venue-curated playlists, and shareable playlist cards.
 */

export type PlaylistType = 'curated' | 'user' | 'venue'

export interface PulsePlaylist {
  id: string
  title: string
  description: string
  type: PlaylistType
  createdBy: string
  venueId?: string
  pulseIds: string[]
  coverPhoto?: string
  mood?: string
  tags: string[]
  likes: string[]
  createdAt: string
  updatedAt: string
  published: boolean
}

export interface PlaylistCard {
  playlistId: string
  title: string
  description: string
  mood: string
  pulseCount: number
  coverPhoto?: string
  previewPhotos: string[]
  shareUrl: string
  shareText: string
}

export interface MoodBoard {
  id: string
  userId: string
  title: string
  savedPulseIds: string[]
  createdAt: string
  updatedAt: string
}

export const PRESET_MOODS = [
  { value: 'rooftop-vibes', label: 'Best Rooftop Vibes', emoji: '🌆' },
  { value: 'late-night-eats', label: 'Late Night Eats', emoji: '🌙' },
  { value: 'day-drinking', label: 'Day Drinking', emoji: '☀️' },
  { value: 'date-night', label: 'Date Night', emoji: '❤️' },
  { value: 'live-music', label: 'Live Music Nights', emoji: '🎵' },
  { value: 'hidden-gems', label: 'Hidden Gems', emoji: '💎' },
  { value: 'brunch-spots', label: 'Brunch Spots', emoji: '🥂' },
  { value: 'dive-bars', label: 'Dive Bar Energy', emoji: '🍺' },
] as const

/**
 * Create a new playlist.
 */
export function createPlaylist(
  title: string,
  description: string,
  type: PlaylistType,
  createdBy: string,
  options?: {
    venueId?: string
    mood?: string
    tags?: string[]
    coverPhoto?: string
  }
): PulsePlaylist {
  const now = new Date().toISOString()
  return {
    id: `playlist-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    description,
    type,
    createdBy,
    venueId: options?.venueId,
    pulseIds: [],
    coverPhoto: options?.coverPhoto,
    mood: options?.mood,
    tags: options?.tags ?? [],
    likes: [],
    createdAt: now,
    updatedAt: now,
    published: false,
  }
}

/**
 * Add a pulse to a playlist.
 */
export function addToPlaylist(playlist: PulsePlaylist, pulseId: string): PulsePlaylist {
  if (playlist.pulseIds.includes(pulseId)) return playlist
  return {
    ...playlist,
    pulseIds: [...playlist.pulseIds, pulseId],
    updatedAt: new Date().toISOString(),
  }
}

/**
 * Remove a pulse from a playlist.
 */
export function removeFromPlaylist(playlist: PulsePlaylist, pulseId: string): PulsePlaylist {
  return {
    ...playlist,
    pulseIds: playlist.pulseIds.filter(id => id !== pulseId),
    updatedAt: new Date().toISOString(),
  }
}

/**
 * Reorder pulses in a playlist.
 */
export function reorderPlaylist(playlist: PulsePlaylist, pulseIds: string[]): PulsePlaylist {
  // Only keep IDs that exist in the playlist
  const valid = pulseIds.filter(id => playlist.pulseIds.includes(id))
  // Add back any missing ones at the end
  const missing = playlist.pulseIds.filter(id => !valid.includes(id))
  return {
    ...playlist,
    pulseIds: [...valid, ...missing],
    updatedAt: new Date().toISOString(),
  }
}

/**
 * Toggle like on a playlist.
 */
export function togglePlaylistLike(playlist: PulsePlaylist, userId: string): PulsePlaylist {
  const hasLiked = playlist.likes.includes(userId)
  return {
    ...playlist,
    likes: hasLiked
      ? playlist.likes.filter(id => id !== userId)
      : [...playlist.likes, userId],
  }
}

/**
 * Publish/unpublish a playlist.
 */
export function togglePublish(playlist: PulsePlaylist): PulsePlaylist {
  return { ...playlist, published: !playlist.published, updatedAt: new Date().toISOString() }
}

/**
 * Generate a shareable playlist card.
 */
export function generatePlaylistCard(
  playlist: PulsePlaylist,
  pulses: Pulse[]
): PlaylistCard {
  const playlistPulses = pulses.filter(p => playlist.pulseIds.includes(p.id))
  const previewPhotos = playlistPulses
    .flatMap(p => p.photos)
    .filter(Boolean)
    .slice(0, 4)

  return {
    playlistId: playlist.id,
    title: playlist.title,
    description: playlist.description,
    mood: playlist.mood ?? '',
    pulseCount: playlist.pulseIds.length,
    coverPhoto: playlist.coverPhoto ?? previewPhotos[0],
    previewPhotos,
    shareUrl: `https://pulse.app/playlist/${playlist.id}`,
    shareText: `${playlist.title} — ${playlist.pulseIds.length} pulse${playlist.pulseIds.length !== 1 ? 's' : ''} on Pulse`,
  }
}

/**
 * Create a mood board for saving pulses.
 */
export function createMoodBoard(userId: string, title: string): MoodBoard {
  const now = new Date().toISOString()
  return {
    id: `board-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    userId,
    title,
    savedPulseIds: [],
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * Save a pulse to a mood board.
 */
export function saveToBoardAction(board: MoodBoard, pulseId: string): MoodBoard {
  if (board.savedPulseIds.includes(pulseId)) return board
  return {
    ...board,
    savedPulseIds: [...board.savedPulseIds, pulseId],
    updatedAt: new Date().toISOString(),
  }
}

/**
 * Remove a pulse from a mood board.
 */
export function removeFromBoard(board: MoodBoard, pulseId: string): MoodBoard {
  return {
    ...board,
    savedPulseIds: board.savedPulseIds.filter(id => id !== pulseId),
    updatedAt: new Date().toISOString(),
  }
}

/**
 * Get playlists for a venue.
 */
export function getVenuePlaylists(playlists: PulsePlaylist[], venueId: string): PulsePlaylist[] {
  return playlists
    .filter(p => p.venueId === venueId && p.published)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}

/**
 * Get playlists by mood.
 */
export function getPlaylistsByMood(playlists: PulsePlaylist[], mood: string): PulsePlaylist[] {
  return playlists
    .filter(p => p.mood === mood && p.published)
    .sort((a, b) => b.likes.length - a.likes.length)
}

/**
 * Get user's mood boards.
 */
export function getUserMoodBoards(boards: MoodBoard[], userId: string): MoodBoard[] {
  return boards
    .filter(b => b.userId === userId)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}

/**
 * Auto-suggest a mood for a playlist based on its pulses.
 */
export function suggestMood(
  pulses: Pulse[],
  venues: Venue[]
): string {
  const venueMap = new Map(venues.map(v => [v.id, v]))

  // Analyze energy distribution
  const energyCounts: Record<EnergyRating, number> = { dead: 0, chill: 0, buzzing: 0, electric: 0 }
  for (const p of pulses) energyCounts[p.energyRating]++

  // Check time distribution
  const hours = pulses.map(p => new Date(p.createdAt).getHours())
  const avgHour = hours.length > 0 ? hours.reduce((a, b) => a + b, 0) / hours.length : 12

  // Check venue categories
  const categories = pulses
    .map(p => venueMap.get(p.venueId)?.category?.toLowerCase() ?? '')
    .filter(Boolean)

  if (avgHour >= 22 || avgHour < 4) return 'late-night-eats'
  if (categories.some(c => c.includes('rooftop'))) return 'rooftop-vibes'
  if (categories.some(c => c.includes('music') || c.includes('concert'))) return 'live-music'
  if (energyCounts.electric > energyCounts.buzzing) return 'rooftop-vibes'
  if (energyCounts.chill > energyCounts.buzzing) return 'hidden-gems'

  return 'hidden-gems'
}
