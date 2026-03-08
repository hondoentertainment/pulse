import type { Pulse, User, Venue, EnergyRating } from './types'

/**
 * Pulse Stories & Highlights Engine
 *
 * Ephemeral 24-hour stories, venue highlights, tonight's recap,
 * and story reactions.
 */

export type StoryReaction = '🔥' | '⚡' | '😍' | '🙌' | '💀' | '👀'

export const STORY_REACTIONS: StoryReaction[] = ['🔥', '⚡', '😍', '🙌', '💀', '👀']

export interface PulseStory {
  id: string
  userId: string
  username: string
  profilePhoto?: string
  venueId: string
  venueName: string
  energyRating: EnergyRating
  caption?: string
  photos: string[]
  reactions: Record<StoryReaction, string[]>
  createdAt: string
  expiresAt: string
  viewedBy: string[]
  viewCount: number
}

export interface VenueHighlight {
  id: string
  venueId: string
  venueName: string
  title: string
  description: string
  curatedBy: { userId: string; username: string; role: 'owner' | 'contributor' }
  pulseIds: string[]
  coverPhoto?: string
  createdAt: string
  featured: boolean
}

export interface TonightsRecap {
  userId: string
  date: string
  venues: {
    venueId: string
    venueName: string
    energyRating: EnergyRating
    arrivalTime: string
    photos: string[]
  }[]
  totalVenues: number
  dominantMood: EnergyRating
  headline: string
  shareText: string
}

const STORY_TTL_MS = 24 * 60 * 60 * 1000

/**
 * Create a pulse story from a pulse.
 */
export function createStory(
  pulse: Pulse,
  user: User,
  venueName: string
): PulseStory {
  return {
    id: `story-${pulse.id}`,
    userId: user.id,
    username: user.username,
    profilePhoto: user.profilePhoto,
    venueId: pulse.venueId,
    venueName,
    energyRating: pulse.energyRating,
    caption: pulse.caption,
    photos: pulse.photos,
    reactions: { '🔥': [], '⚡': [], '😍': [], '🙌': [], '💀': [], '👀': [] },
    createdAt: pulse.createdAt,
    expiresAt: new Date(new Date(pulse.createdAt).getTime() + STORY_TTL_MS).toISOString(),
    viewedBy: [],
    viewCount: 0,
  }
}

/**
 * Check if a story is still live (within 24h).
 */
export function isStoryLive(story: PulseStory): boolean {
  return new Date(story.expiresAt).getTime() > Date.now()
}

/**
 * Get active stories, grouped by user, sorted by recency.
 */
export function getActiveStories(stories: PulseStory[]): PulseStory[] {
  return stories
    .filter(isStoryLive)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

/**
 * Get stories grouped by user for story ring display.
 */
export function getStoryRings(
  stories: PulseStory[],
  currentUserId: string
): { userId: string; username: string; profilePhoto?: string; hasUnviewed: boolean; stories: PulseStory[] }[] {
  const active = getActiveStories(stories)
  const grouped = new Map<string, PulseStory[]>()

  for (const story of active) {
    if (!grouped.has(story.userId)) grouped.set(story.userId, [])
    grouped.get(story.userId)!.push(story)
  }

  return Array.from(grouped.entries())
    .map(([userId, userStories]) => ({
      userId,
      username: userStories[0].username,
      profilePhoto: userStories[0].profilePhoto,
      hasUnviewed: userStories.some(s => !s.viewedBy.includes(currentUserId)),
      stories: userStories,
    }))
    .sort((a, b) => {
      // Unviewed first, then by most recent
      if (a.hasUnviewed !== b.hasUnviewed) return a.hasUnviewed ? -1 : 1
      return new Date(b.stories[0].createdAt).getTime() - new Date(a.stories[0].createdAt).getTime()
    })
}

/**
 * Mark a story as viewed.
 */
export function viewStory(story: PulseStory, userId: string): PulseStory {
  if (story.viewedBy.includes(userId)) return { ...story }
  return {
    ...story,
    viewedBy: [...story.viewedBy, userId],
    viewCount: story.viewCount + 1,
  }
}

/**
 * React to a story.
 */
export function reactToStory(
  story: PulseStory,
  userId: string,
  reaction: StoryReaction
): PulseStory {
  const currentReactions = story.reactions[reaction]
  const hasReacted = currentReactions.includes(userId)
  return {
    ...story,
    reactions: {
      ...story.reactions,
      [reaction]: hasReacted
        ? currentReactions.filter(id => id !== userId)
        : [...currentReactions, userId],
    },
  }
}

/**
 * Get total reaction count for a story.
 */
export function getStoryReactionCount(story: PulseStory): number {
  return Object.values(story.reactions).reduce((sum, arr) => sum + arr.length, 0)
}

/**
 * Create a venue highlight collection.
 */
export function createVenueHighlight(
  venueId: string,
  venueName: string,
  title: string,
  description: string,
  curatedBy: VenueHighlight['curatedBy'],
  pulseIds: string[],
  coverPhoto?: string
): VenueHighlight {
  return {
    id: `highlight-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    venueId,
    venueName,
    title,
    description,
    curatedBy,
    pulseIds,
    coverPhoto,
    createdAt: new Date().toISOString(),
    featured: false,
  }
}

/**
 * Get highlights for a venue.
 */
export function getVenueHighlights(highlights: VenueHighlight[], venueId: string): VenueHighlight[] {
  return highlights
    .filter(h => h.venueId === venueId)
    .sort((a, b) => {
      if (a.featured !== b.featured) return a.featured ? -1 : 1
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
}

/**
 * Generate "Tonight's Recap" from a user's evening activity.
 */
export function generateTonightsRecap(
  userId: string,
  pulses: Pulse[],
  venues: Venue[]
): TonightsRecap | null {
  const now = new Date()
  const tonightCutoff = new Date(now)
  tonightCutoff.setHours(17, 0, 0, 0) // 5 PM start
  if (now.getHours() < 17) {
    // If before 5 PM, look at last night
    tonightCutoff.setDate(tonightCutoff.getDate() - 1)
  }

  const venueMap = new Map(venues.map(v => [v.id, v]))
  const tonightPulses = pulses
    .filter(p => p.userId === userId && new Date(p.createdAt) >= tonightCutoff)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

  if (tonightPulses.length === 0) return null

  // Deduplicate by venue, keep first visit
  const visitedVenues = new Map<string, typeof tonightPulses[0]>()
  for (const pulse of tonightPulses) {
    if (!visitedVenues.has(pulse.venueId)) {
      visitedVenues.set(pulse.venueId, pulse)
    }
  }

  const energyCounts: Record<EnergyRating, number> = { dead: 0, chill: 0, buzzing: 0, electric: 0 }
  for (const p of tonightPulses) energyCounts[p.energyRating]++

  const dominantMood = (Object.entries(energyCounts) as [EnergyRating, number][])
    .sort(([, a], [, b]) => b - a)[0][0]

  const recapVenues = Array.from(visitedVenues.entries()).map(([venueId, pulse]) => ({
    venueId,
    venueName: venueMap.get(venueId)?.name ?? 'Unknown',
    energyRating: pulse.energyRating,
    arrivalTime: pulse.createdAt,
    photos: pulse.photos,
  }))

  const moodEmoji: Record<EnergyRating, string> = { dead: '💀', chill: '😌', buzzing: '🔥', electric: '⚡' }
  const headlineTemplates: Record<EnergyRating, string[]> = {
    electric: ['What a night!', 'Absolute fire tonight!', 'Electric vibes all night'],
    buzzing: ['Great night out!', 'The energy was real', 'Buzzing all evening'],
    chill: ['Chill vibes tonight', 'Low-key good time', 'Easy going evening'],
    dead: ['Quiet night', 'Laid back evening', 'Sometimes you need a calm night'],
  }
  const templates = headlineTemplates[dominantMood]
  const headline = templates[Math.floor(Math.random() * templates.length)]

  return {
    userId,
    date: now.toISOString().split('T')[0],
    venues: recapVenues,
    totalVenues: recapVenues.length,
    dominantMood,
    headline,
    shareText: `${moodEmoji[dominantMood]} ${headline} — hit ${recapVenues.length} spot${recapVenues.length > 1 ? 's' : ''} tonight on Pulse`,
  }
}
