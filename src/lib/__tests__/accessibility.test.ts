import { describe, it, expect } from 'vitest'
import {
  getEnergyAriaLabel,
  getReactionAriaLabel,
  getNotificationAriaLabel,
  getHighContrastMode,
  prefersReducedMotion,
} from '../accessibility'

describe('getEnergyAriaLabel', () => {
  it('generates descriptive label', () => {
    const label = getEnergyAriaLabel(75, 'Electric', 'The Rooftop')
    expect(label).toContain('The Rooftop')
    expect(label).toContain('Electric')
    expect(label).toContain('75')
    expect(label).toContain('100')
  })
})

describe('getReactionAriaLabel', () => {
  it('describes reactions', () => {
    const label = getReactionAriaLabel(
      { fire: 3, eyes: 1, skull: 0, lightning: 0 },
      { fire: true, eyes: false, skull: false, lightning: false }
    )
    expect(label).toContain('3 fire')
    expect(label).toContain('you reacted')
    expect(label).toContain('1 eyes')
    expect(label).not.toContain('skull')
  })

  it('handles no reactions', () => {
    const label = getReactionAriaLabel(
      { fire: 0, eyes: 0, skull: 0, lightning: 0 },
      { fire: false, eyes: false, skull: false, lightning: false }
    )
    expect(label).toBe('No reactions yet')
  })
})

describe('getNotificationAriaLabel', () => {
  it('reports unread count', () => {
    expect(getNotificationAriaLabel(5)).toContain('5 unread')
  })

  it('reports no unread', () => {
    expect(getNotificationAriaLabel(0)).toContain('no unread')
  })
})

describe('getHighContrastMode', () => {
  it('returns off by default', () => {
    expect(getHighContrastMode()).toBe('off')
  })
})

describe('prefersReducedMotion', () => {
  it('returns a boolean', () => {
    expect(typeof prefersReducedMotion()).toBe('boolean')
  })
})
