import { describe, it, expect } from 'vitest'
import { buildTonightPath, parseTonightVibeParam } from '../tonight-route'

describe('tonight-route', () => {
  it('builds Tonight paths with vibe query', () => {
    expect(buildTonightPath()).toBe('/')
    expect(buildTonightPath('any')).toBe('/')
    expect(buildTonightPath('buzzing')).toBe('/?vibe=buzzing')
  })

  it('parses vibe query against allowed options', () => {
    const allowed = ['any', 'dead', 'chill', 'buzzing', 'electric'] as const
    expect(parseTonightVibeParam('chill', allowed)).toBe('chill')
    expect(parseTonightVibeParam('nope', allowed)).toBe('any')
    expect(parseTonightVibeParam(null, allowed)).toBe('any')
  })
})
