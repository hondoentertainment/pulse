import { describe, it, expect } from 'vitest'
import {
  createPlaylist,
  addToPlaylist,
  removeFromPlaylist,
  reorderPlaylist,
  togglePlaylistLike,
  togglePublish,
  generatePlaylistCard,
  createMoodBoard,
  saveToBoardAction,
  removeFromBoard,
  getVenuePlaylists,
  getPlaylistsByMood,
  getUserMoodBoards,
  suggestMood,
} from '../playlists'
import type { Pulse } from '../types'

function makePulse(overrides: Partial<Pulse> = {}): Pulse {
  return {
    id: `p-${Math.random().toString(36).slice(2)}`,
    userId: 'u1', venueId: 'v1', photos: ['img.jpg'],
    energyRating: 'buzzing',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 90 * 60000).toISOString(),
    reactions: { fire: [], eyes: [], skull: [], lightning: [] },
    views: 0,
    ...overrides,
  }
}

describe('createPlaylist', () => {
  it('creates a playlist', () => {
    const pl = createPlaylist('Rooftop Vibes', 'Best rooftops', 'user', 'u1', { mood: 'rooftop-vibes' })
    expect(pl.title).toBe('Rooftop Vibes')
    expect(pl.type).toBe('user')
    expect(pl.pulseIds).toHaveLength(0)
    expect(pl.published).toBe(false)
  })
})

describe('addToPlaylist / removeFromPlaylist', () => {
  it('adds a pulse', () => {
    const pl = createPlaylist('Test', '', 'user', 'u1')
    const updated = addToPlaylist(pl, 'p1')
    expect(updated.pulseIds).toContain('p1')
  })

  it('does not duplicate', () => {
    let pl = createPlaylist('Test', '', 'user', 'u1')
    pl = addToPlaylist(pl, 'p1')
    pl = addToPlaylist(pl, 'p1')
    expect(pl.pulseIds).toHaveLength(1)
  })

  it('removes a pulse', () => {
    let pl = createPlaylist('Test', '', 'user', 'u1')
    pl = addToPlaylist(pl, 'p1')
    pl = addToPlaylist(pl, 'p2')
    pl = removeFromPlaylist(pl, 'p1')
    expect(pl.pulseIds).toEqual(['p2'])
  })
})

describe('reorderPlaylist', () => {
  it('reorders pulses', () => {
    let pl = createPlaylist('Test', '', 'user', 'u1')
    pl = addToPlaylist(pl, 'p1')
    pl = addToPlaylist(pl, 'p2')
    pl = addToPlaylist(pl, 'p3')
    const reordered = reorderPlaylist(pl, ['p3', 'p1', 'p2'])
    expect(reordered.pulseIds).toEqual(['p3', 'p1', 'p2'])
  })

  it('preserves missing items', () => {
    let pl = createPlaylist('Test', '', 'user', 'u1')
    pl = addToPlaylist(pl, 'p1')
    pl = addToPlaylist(pl, 'p2')
    const reordered = reorderPlaylist(pl, ['p2'])
    expect(reordered.pulseIds).toEqual(['p2', 'p1'])
  })
})

describe('togglePlaylistLike', () => {
  it('toggles like', () => {
    const pl = createPlaylist('Test', '', 'user', 'u1')
    const liked = togglePlaylistLike(pl, 'u2')
    expect(liked.likes).toContain('u2')
    const unliked = togglePlaylistLike(liked, 'u2')
    expect(unliked.likes).not.toContain('u2')
  })
})

describe('togglePublish', () => {
  it('toggles published state', () => {
    const pl = createPlaylist('Test', '', 'user', 'u1')
    expect(pl.published).toBe(false)
    const pub = togglePublish(pl)
    expect(pub.published).toBe(true)
    expect(togglePublish(pub).published).toBe(false)
  })
})

describe('generatePlaylistCard', () => {
  it('generates a card', () => {
    let pl = createPlaylist('Rooftop', 'Best spots', 'user', 'u1', { mood: 'rooftop-vibes' })
    const p1 = makePulse({ id: 'p1' })
    pl = addToPlaylist(pl, 'p1')
    const card = generatePlaylistCard(pl, [p1])
    expect(card.title).toBe('Rooftop')
    expect(card.pulseCount).toBe(1)
    expect(card.shareUrl).toContain(pl.id)
  })
})

describe('mood boards', () => {
  it('creates a board', () => {
    const board = createMoodBoard('u1', 'Favorites')
    expect(board.userId).toBe('u1')
    expect(board.savedPulseIds).toHaveLength(0)
  })

  it('saves and removes pulses', () => {
    let board = createMoodBoard('u1', 'Faves')
    board = saveToBoardAction(board, 'p1')
    expect(board.savedPulseIds).toContain('p1')
    board = removeFromBoard(board, 'p1')
    expect(board.savedPulseIds).toHaveLength(0)
  })

  it('does not duplicate saves', () => {
    let board = createMoodBoard('u1', 'Faves')
    board = saveToBoardAction(board, 'p1')
    board = saveToBoardAction(board, 'p1')
    expect(board.savedPulseIds).toHaveLength(1)
  })
})

describe('getVenuePlaylists', () => {
  it('returns published playlists for a venue', () => {
    const pls = [
      { ...createPlaylist('A', '', 'venue', 'u1', { venueId: 'v1' }), published: true },
      { ...createPlaylist('B', '', 'venue', 'u1', { venueId: 'v1' }), published: false },
      { ...createPlaylist('C', '', 'venue', 'u1', { venueId: 'v2' }), published: true },
    ]
    expect(getVenuePlaylists(pls, 'v1')).toHaveLength(1)
  })
})

describe('getPlaylistsByMood', () => {
  it('filters by mood and sorts by likes', () => {
    const pls = [
      { ...createPlaylist('A', '', 'user', 'u1', { mood: 'rooftop-vibes' }), published: true, likes: ['u2'] },
      { ...createPlaylist('B', '', 'user', 'u1', { mood: 'rooftop-vibes' }), published: true, likes: ['u2', 'u3', 'u4'] },
      { ...createPlaylist('C', '', 'user', 'u1', { mood: 'dive-bars' }), published: true, likes: [] },
    ]
    const result = getPlaylistsByMood(pls, 'rooftop-vibes')
    expect(result).toHaveLength(2)
    expect(result[0].title).toBe('B') // More likes
  })
})

describe('getUserMoodBoards', () => {
  it('returns boards for user sorted by recent', () => {
    const b1 = createMoodBoard('u1', 'A')
    const b2 = { ...createMoodBoard('u1', 'B'), updatedAt: new Date(Date.now() + 1000).toISOString() }
    const b3 = createMoodBoard('u2', 'C')
    const result = getUserMoodBoards([b1, b2, b3], 'u1')
    expect(result).toHaveLength(2)
    expect(result[0].title).toBe('B')
  })
})

describe('suggestMood', () => {
  it('suggests late-night for late pulses', () => {
    const lateHour = new Date()
    lateHour.setHours(23, 0, 0, 0)
    const pulses = [makePulse({ createdAt: lateHour.toISOString() })]
    expect(suggestMood(pulses, [])).toBe('late-night-eats')
  })

  it('returns a string for any input', () => {
    expect(typeof suggestMood([], [])).toBe('string')
  })
})
