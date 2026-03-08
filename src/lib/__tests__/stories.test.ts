import { describe, it, expect } from 'vitest'
import {
  createStory,
  isStoryLive,
  getActiveStories,
  getStoryRings,
  viewStory,
  reactToStory,
  getStoryReactionCount,
  createVenueHighlight,
  getVenueHighlights,
  generateTonightsRecap,
  STORY_REACTIONS,
} from '../stories'
import type { Pulse, User, Venue } from '../types'

function makeUser(overrides: Partial<User> = {}): User {
  return { id: 'u1', username: 'alice', friends: [], createdAt: new Date().toISOString(), ...overrides }
}

function makePulse(overrides: Partial<Pulse> = {}): Pulse {
  return {
    id: `p-${Math.random().toString(36).slice(2)}`,
    userId: 'u1', venueId: 'v1', photos: ['photo.jpg'],
    energyRating: 'buzzing', caption: 'Great vibes',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 90 * 60000).toISOString(),
    reactions: { fire: [], eyes: [], skull: [], lightning: [] },
    views: 0,
    ...overrides,
  }
}

describe('createStory', () => {
  it('creates a story from a pulse', () => {
    const pulse = makePulse()
    const user = makeUser()
    const story = createStory(pulse, user, 'Bar X')
    expect(story.id).toContain('story-')
    expect(story.venueName).toBe('Bar X')
    expect(story.energyRating).toBe('buzzing')
    expect(story.viewCount).toBe(0)
    expect(Object.keys(story.reactions)).toHaveLength(6)
  })
})

describe('isStoryLive', () => {
  it('returns true for recent story', () => {
    const story = createStory(makePulse(), makeUser(), 'Bar')
    expect(isStoryLive(story)).toBe(true)
  })

  it('returns false for expired story', () => {
    const story = createStory(
      makePulse({ createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString() }),
      makeUser(), 'Bar'
    )
    expect(isStoryLive(story)).toBe(false)
  })
})

describe('getActiveStories', () => {
  it('filters expired stories', () => {
    const live = createStory(makePulse(), makeUser(), 'A')
    const expired = createStory(
      makePulse({ createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString() }),
      makeUser(), 'B'
    )
    expect(getActiveStories([live, expired])).toHaveLength(1)
  })
})

describe('getStoryRings', () => {
  it('groups stories by user', () => {
    const s1 = createStory(makePulse({ userId: 'u1' }), makeUser({ id: 'u1', username: 'alice' }), 'A')
    const s2 = createStory(makePulse({ userId: 'u1' }), makeUser({ id: 'u1', username: 'alice' }), 'B')
    const s3 = createStory(makePulse({ userId: 'u2' }), makeUser({ id: 'u2', username: 'bob' }), 'C')
    const rings = getStoryRings([s1, s2, s3], 'viewer')
    expect(rings).toHaveLength(2)
    expect(rings.find(r => r.userId === 'u1')?.stories).toHaveLength(2)
  })

  it('prioritizes unviewed stories', () => {
    const viewed = { ...createStory(makePulse({ userId: 'u1' }), makeUser({ id: 'u1', username: 'alice' }), 'A'), viewedBy: ['viewer'] }
    const unviewed = createStory(makePulse({ userId: 'u2' }), makeUser({ id: 'u2', username: 'bob' }), 'B')
    const rings = getStoryRings([viewed, unviewed], 'viewer')
    expect(rings[0].userId).toBe('u2')
    expect(rings[0].hasUnviewed).toBe(true)
  })
})

describe('viewStory', () => {
  it('increments view count', () => {
    const story = createStory(makePulse(), makeUser(), 'Bar')
    const viewed = viewStory(story, 'viewer')
    expect(viewed.viewCount).toBe(1)
    expect(viewed.viewedBy).toContain('viewer')
  })

  it('does not double-count views', () => {
    const story = createStory(makePulse(), makeUser(), 'Bar')
    const v1 = viewStory(story, 'viewer')
    const v2 = viewStory(v1, 'viewer')
    expect(v2.viewCount).toBe(1)
  })
})

describe('reactToStory', () => {
  it('adds a reaction', () => {
    const story = createStory(makePulse(), makeUser(), 'Bar')
    const reacted = reactToStory(story, 'u2', '🔥')
    expect(reacted.reactions['🔥']).toContain('u2')
  })

  it('toggles reaction off', () => {
    const story = createStory(makePulse(), makeUser(), 'Bar')
    const on = reactToStory(story, 'u2', '🔥')
    const off = reactToStory(on, 'u2', '🔥')
    expect(off.reactions['🔥']).not.toContain('u2')
  })
})

describe('getStoryReactionCount', () => {
  it('sums all reactions', () => {
    let story = createStory(makePulse(), makeUser(), 'Bar')
    story = reactToStory(story, 'u2', '🔥')
    story = reactToStory(story, 'u3', '⚡')
    story = reactToStory(story, 'u4', '🔥')
    expect(getStoryReactionCount(story)).toBe(3)
  })
})

describe('createVenueHighlight', () => {
  it('creates a highlight', () => {
    const h = createVenueHighlight('v1', 'Bar', 'Best of', 'Top pulses', { userId: 'u1', username: 'alice', role: 'owner' }, ['p1', 'p2'])
    expect(h.venueId).toBe('v1')
    expect(h.pulseIds).toHaveLength(2)
    expect(h.featured).toBe(false)
  })
})

describe('getVenueHighlights', () => {
  it('filters by venue and sorts featured first', () => {
    const h1 = createVenueHighlight('v1', 'Bar', 'A', '', { userId: 'u1', username: 'a', role: 'owner' }, [])
    const h2 = { ...createVenueHighlight('v1', 'Bar', 'B', '', { userId: 'u1', username: 'a', role: 'owner' }, []), featured: true }
    const h3 = createVenueHighlight('v2', 'Cafe', 'C', '', { userId: 'u1', username: 'a', role: 'owner' }, [])
    const result = getVenueHighlights([h1, h2, h3], 'v1')
    expect(result).toHaveLength(2)
    expect(result[0].title).toBe('B')
  })
})

describe('generateTonightsRecap', () => {
  it('returns null for no activity', () => {
    expect(generateTonightsRecap('u1', [], [])).toBeNull()
  })

  it('generates a recap from evening pulses', () => {
    const evening = new Date()
    evening.setHours(21, 0, 0, 0)
    if (new Date().getHours() < 17) {
      evening.setDate(evening.getDate() - 1)
    }

    const pulses = [
      makePulse({ userId: 'u1', venueId: 'v1', energyRating: 'electric', createdAt: evening.toISOString() }),
      makePulse({ userId: 'u1', venueId: 'v2', energyRating: 'buzzing', createdAt: new Date(evening.getTime() + 3600000).toISOString() }),
    ]
    const venues: Venue[] = [
      { id: 'v1', name: 'Bar A', location: { lat: 0, lng: 0, address: '' }, pulseScore: 80 },
      { id: 'v2', name: 'Bar B', location: { lat: 0, lng: 0, address: '' }, pulseScore: 60 },
    ]
    const recap = generateTonightsRecap('u1', pulses, venues)
    expect(recap).not.toBeNull()
    expect(recap!.totalVenues).toBe(2)
    expect(recap!.venues[0].venueName).toBe('Bar A')
    expect(recap!.shareText.length).toBeGreaterThan(0)
  })
})
