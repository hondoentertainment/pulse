import { describe, expect, it } from 'vitest'
import { buildNeighborhoodShareOg, buildShareOgEnergy, energyLabelFromScore, formatShareFreshness } from '../share-og'

describe('share OG energy', () => {
  it('prefers live review energy + freshness over a generic card', () => {
    const now = Date.parse('2026-09-11T02:00:00.000Z')
    const card = buildShareOgEnergy({
      venueName: 'Neumos',
      neighborhood: 'Capitol Hill',
      city: 'Seattle',
      category: 'Music Venue',
      pulseScore: 20,
      latestEnergyRating: 'electric',
      latestCreatedAt: new Date(now - 12 * 60 * 1000).toISOString(),
      nowMs: now,
    })
    expect(card.title).toBe('Neumos')
    expect(card.energyLine).toBe('Electric · 12m ago')
    expect(card.description).toContain('Capitol Hill')
    expect(energyLabelFromScore(80)).toBe('Electric')
    expect(formatShareFreshness(new Date(now - 30_000).toISOString(), now)).toBe('just now')
  })

  it('falls back to pulse_score energy when no live review exists', () => {
    const card = buildShareOgEnergy({
      venueName: 'Neumos',
      pulseScore: 80,
    })
    expect(card.title).toBe('Neumos')
    expect(card.energyLine).toBe('Electric')
  })

  it('builds a real neighborhood card without inventing a crowd', () => {
    const card = buildNeighborhoodShareOg({ name: 'Capitol Hill', slug: 'capitol-hill' })
    expect(card.title).toBe('Capitol Hill')
    expect(card.energyLine).toBe('Tonight · Seattle')
    expect(card.description).toContain('tagged rooms in Capitol Hill')
    expect(card.description).not.toMatch(/packed|live crowd|50 people/i)
  })
})
