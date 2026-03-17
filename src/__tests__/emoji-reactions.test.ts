import { describe, it, expect } from 'vitest'
import {
  REACTION_EMOJIS,
  createBurstParticles,
  updateParticle,
  isParticleExpired,
  getReactionVelocity,
  aggregateReactions,
  formatReactionCount,
  type ReactionType,
  type ReactionBurst,
} from '../lib/emoji-reactions'

describe('REACTION_EMOJIS', () => {
  const expectedTypes: ReactionType[] = [
    'fire', 'music', 'dancing', 'drinks', 'electric', 'love', 'chill', 'vip',
  ]

  it('contains all reaction types', () => {
    for (const type of expectedTypes) {
      expect(REACTION_EMOJIS[type]).toBeDefined()
    }
  })

  it('each config has emoji, label, color, and type', () => {
    for (const type of expectedTypes) {
      const config = REACTION_EMOJIS[type]
      expect(config.type).toBe(type)
      expect(config.emoji).toBeTruthy()
      expect(config.label).toBeTruthy()
      expect(config.color).toMatch(/^oklch/)
    }
  })

  it('maps correct emojis', () => {
    expect(REACTION_EMOJIS.fire.emoji).toBe('\u{1F525}')
    expect(REACTION_EMOJIS.music.emoji).toBe('\u{1F3B6}')
    expect(REACTION_EMOJIS.dancing.emoji).toBe('\u{1F483}')
    expect(REACTION_EMOJIS.drinks.emoji).toBe('\u{1F378}')
    expect(REACTION_EMOJIS.electric.emoji).toBe('\u{26A1}')
    expect(REACTION_EMOJIS.love.emoji).toBe('\u{2764}\u{FE0F}')
    expect(REACTION_EMOJIS.chill.emoji).toBe('\u{1F60E}')
    expect(REACTION_EMOJIS.vip.emoji).toBe('\u{1F451}')
  })
})

describe('createBurstParticles', () => {
  it('generates the requested number of particles', () => {
    const particles = createBurstParticles('fire', 100, 200, 5)
    expect(particles).toHaveLength(5)
  })

  it('defaults to 3 particles', () => {
    const particles = createBurstParticles('music', 100, 200)
    expect(particles).toHaveLength(3)
  })

  it('particles have unique ids', () => {
    const particles = createBurstParticles('fire', 0, 0, 10)
    const ids = new Set(particles.map((p) => p.id))
    expect(ids.size).toBe(10)
  })

  it('particles start near origin with spread', () => {
    const particles = createBurstParticles('drinks', 200, 300, 20)
    for (const p of particles) {
      expect(p.x).toBeGreaterThanOrEqual(190)
      expect(p.x).toBeLessThanOrEqual(210)
      expect(p.y).toBe(300)
    }
  })

  it('particles have upward velocity (negative y)', () => {
    const particles = createBurstParticles('love', 100, 100, 20)
    for (const p of particles) {
      expect(p.velocity.y).toBeLessThan(0)
    }
  })

  it('particles have randomized physics values', () => {
    const particles = createBurstParticles('chill', 100, 100, 10)
    const rotations = new Set(particles.map((p) => p.rotation))
    const scales = new Set(particles.map((p) => p.scale))
    // With 10 particles, we expect some variation
    expect(rotations.size).toBeGreaterThan(1)
    expect(scales.size).toBeGreaterThan(1)
  })

  it('sets correct type on particles', () => {
    const particles = createBurstParticles('vip', 0, 0, 3)
    for (const p of particles) {
      expect(p.type).toBe('vip')
    }
  })

  it('sets opacity to 1', () => {
    const particles = createBurstParticles('fire', 0, 0, 3)
    for (const p of particles) {
      expect(p.opacity).toBe(1)
    }
  })
})

describe('updateParticle', () => {
  function makeParticle(overrides: Partial<ReactionBurst> = {}): ReactionBurst {
    return {
      id: 'test-1',
      type: 'fire',
      x: 100,
      y: 200,
      timestamp: Date.now(),
      velocity: { x: 50, y: -200 },
      rotation: 10,
      scale: 1,
      opacity: 1,
      ...overrides,
    }
  }

  it('applies velocity to position', () => {
    const p = makeParticle()
    const updated = updateParticle(p, 0.016)
    expect(updated.x).toBeGreaterThan(p.x)
    expect(updated.y).toBeLessThan(p.y)
  })

  it('applies gravity to y velocity', () => {
    const p = makeParticle()
    const updated = updateParticle(p, 0.016)
    expect(updated.velocity.y).toBeGreaterThan(p.velocity.y)
  })

  it('applies air resistance to x velocity', () => {
    const p = makeParticle()
    const updated = updateParticle(p, 0.016)
    expect(Math.abs(updated.velocity.x)).toBeLessThan(Math.abs(p.velocity.x))
  })

  it('fades opacity over time', () => {
    const p = makeParticle({ timestamp: Date.now() - 1000 })
    const updated = updateParticle(p, 0.016)
    expect(updated.opacity).toBeLessThan(1)
  })

  it('opacity does not go below 0', () => {
    const p = makeParticle({ timestamp: Date.now() - 5000 })
    const updated = updateParticle(p, 0.016)
    expect(updated.opacity).toBeGreaterThanOrEqual(0)
  })

  it('updates rotation', () => {
    const p = makeParticle()
    const updated = updateParticle(p, 0.016)
    expect(updated.rotation).not.toBe(p.rotation)
  })
})

describe('isParticleExpired', () => {
  it('returns false for fresh particle', () => {
    const p: ReactionBurst = {
      id: 'test',
      type: 'fire',
      x: 0,
      y: 0,
      timestamp: Date.now(),
      velocity: { x: 0, y: 0 },
      rotation: 0,
      scale: 1,
      opacity: 1,
    }
    expect(isParticleExpired(p)).toBe(false)
  })

  it('returns true for fully faded particle', () => {
    const p: ReactionBurst = {
      id: 'test',
      type: 'fire',
      x: 0,
      y: 0,
      timestamp: Date.now() - 5000,
      velocity: { x: 0, y: 0 },
      rotation: 0,
      scale: 0,
      opacity: 0,
    }
    expect(isParticleExpired(p)).toBe(true)
  })

  it('returns true for nearly faded particle (0.01)', () => {
    const p: ReactionBurst = {
      id: 'test',
      type: 'fire',
      x: 0,
      y: 0,
      timestamp: Date.now(),
      velocity: { x: 0, y: 0 },
      rotation: 0,
      scale: 0,
      opacity: 0.005,
    }
    expect(isParticleExpired(p)).toBe(true)
  })
})

describe('getReactionVelocity', () => {
  it('returns 3 for single tap', () => {
    expect(getReactionVelocity(1)).toBe(3)
  })

  it('returns 5 for moderate taps', () => {
    expect(getReactionVelocity(2)).toBe(5)
    expect(getReactionVelocity(3)).toBe(5)
  })

  it('returns 8 for rapid taps', () => {
    expect(getReactionVelocity(4)).toBe(8)
    expect(getReactionVelocity(10)).toBe(8)
  })
})

describe('aggregateReactions', () => {
  it('returns top 3 by count', () => {
    const reactions = [
      { type: 'fire' as ReactionType, count: 10 },
      { type: 'music' as ReactionType, count: 5 },
      { type: 'love' as ReactionType, count: 20 },
      { type: 'chill' as ReactionType, count: 2 },
      { type: 'vip' as ReactionType, count: 15 },
    ]
    const result = aggregateReactions(reactions)
    expect(result).toHaveLength(3)
    expect(result[0].type).toBe('love')
    expect(result[1].type).toBe('vip')
    expect(result[2].type).toBe('fire')
  })

  it('returns all if fewer than 3', () => {
    const reactions = [
      { type: 'fire' as ReactionType, count: 10 },
    ]
    expect(aggregateReactions(reactions)).toHaveLength(1)
  })

  it('returns empty array for empty input', () => {
    expect(aggregateReactions([])).toHaveLength(0)
  })
})

describe('formatReactionCount', () => {
  it('returns raw number below 1000', () => {
    expect(formatReactionCount(0)).toBe('0')
    expect(formatReactionCount(1)).toBe('1')
    expect(formatReactionCount(999)).toBe('999')
  })

  it('formats 1000 as 1K', () => {
    expect(formatReactionCount(1000)).toBe('1K')
  })

  it('formats 1500 as 1.5K', () => {
    expect(formatReactionCount(1500)).toBe('1.5K')
  })

  it('formats 1200 as 1.2K', () => {
    expect(formatReactionCount(1200)).toBe('1.2K')
  })

  it('formats 10000 as 10K', () => {
    expect(formatReactionCount(10000)).toBe('10K')
  })

  it('formats 2000 as 2K', () => {
    expect(formatReactionCount(2000)).toBe('2K')
  })

  it('formats 15700 as 15K', () => {
    expect(formatReactionCount(15700)).toBe('15K')
  })
})
