import { describe, expect, it } from 'vitest'
import { doorChipLine, sanitizeDoorChips, toggleDoorChip } from '../door-chips'

describe('door chips', () => {
  it('only stores line / cover / energy', () => {
    expect(sanitizeDoorChips(['line', 'cover', 'energy', 'vip', 'long'])).toEqual([
      'line',
      'cover',
      'energy',
    ])
    expect(sanitizeDoorChips(['fake'])).toEqual([])
  })

  it('toggles one-taps without inventing values', () => {
    expect(toggleDoorChip([], 'line')).toEqual(['line'])
    expect(toggleDoorChip(['line'], 'line')).toEqual([])
    expect(toggleDoorChip(['line'], 'cover')).toEqual(['line', 'cover'])
    expect(doorChipLine(['line', 'energy'])).toBe('Line · Energy')
    expect(doorChipLine([])).toBeNull()
  })
})
