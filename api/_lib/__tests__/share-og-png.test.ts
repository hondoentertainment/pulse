import { describe, expect, it } from 'vitest'
import { paintShareOgCard, renderShareOgPng, SHARE_OG_LAYOUT } from '../share-og-png'

describe('share OG png', () => {
  it('paints the venue name and energy freshness as pixels, not an empty card', () => {
    const painted = paintShareOgCard({
      eyebrow: 'Someone shared a venue',
      title: 'Neumos',
      energyLine: 'Electric · 12m ago',
      cta: "I'm here · open map",
    })
    const [nr, ng, nb] = painted.pixel(SHARE_OG_LAYOUT.padX, SHARE_OG_LAYOUT.titleY)
    expect([nr, ng, nb]).toEqual([0xf5, 0xf5, 0xf7])
    const [er, eg, eb] = painted.pixel(SHARE_OG_LAYOUT.padX, SHARE_OG_LAYOUT.energyY)
    expect([er, eg, eb]).toEqual([0xfa, 0x59, 0x8c])
    const [br, bg, bb] = painted.pixel(0, 0)
    expect([br, bg, bb]).toEqual([0x0a, 0x0a, 0x0d])

    const png = renderShareOgPng({
      eyebrow: 'Someone shared a venue',
      title: 'Neumos',
      energyLine: 'Electric · 12m ago',
      cta: "I'm here · open map",
    })
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
    expect(png.readUInt32BE(16)).toBe(1200)
    expect(png.readUInt32BE(20)).toBe(630)
  })
})
