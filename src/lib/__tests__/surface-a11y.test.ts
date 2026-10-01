import { describe, expect, it } from 'vitest'
import {
  energyAccessibleName,
  energyTextLabel,
  nextRovingIndex,
  shouldRunMapInertia,
  surfaceMotion,
} from '../surface-a11y'

describe('surface accessibility', () => {
  it('moves Tonight and composer focus with arrow keys', () => {
    expect(nextRovingIndex(0, 4, 'ArrowRight')).toBe(1)
    expect(nextRovingIndex(0, 4, 'ArrowLeft')).toBe(3)
    expect(nextRovingIndex(2, 4, 'Home')).toBe(0)
    expect(nextRovingIndex(2, 4, 'End')).toBe(3)
    expect(nextRovingIndex(1, 4, 'Enter')).toBeNull()
  })

  it('keeps energy meaning in words and calms motion', () => {
    expect(energyTextLabel('electric')).toBe('Electric')
    expect(energyAccessibleName('buzzing')).toBe('Energy: Buzzing')
    expect(energyAccessibleName('electric')).not.toMatch(/⚡|🔥/)
    expect(shouldRunMapInertia(true)).toBe(false)
    expect(shouldRunMapInertia(false)).toBe(true)
    expect(surfaceMotion(true)).toEqual({ duration: 0, y: 0 })
  })
})
