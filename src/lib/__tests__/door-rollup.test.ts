import { describe, expect, it } from 'vitest'
import type { Pulse } from '../types'
import { doorRollupLabel, rollupDoorChip } from '../door-rollup'

function pulse(overrides: Partial<Pulse> = {}): Pulse {
  return {
    id: 'p1',
    userId: 'u1',
    venueId: 'neumos',
    photos: [],
    energyRating: 'buzzing',
    createdAt: '2026-09-14T04:00:00.000Z',
    expiresAt: '2026-09-14T05:30:00.000Z',
    reactions: { fire: [], eyes: [], skull: [], lightning: [] },
    views: 0,
    ...overrides,
  }
}

describe('door rollup', () => {
  it('aggregates tonight’s real door chips and never guesses', () => {
    const now = new Date('2026-09-14T05:00:00.000Z')
    expect(rollupDoorChip([
      pulse({ doorChips: ['cover'] }),
      pulse({ id: 'p2', doorChips: ['cover', 'line'] }),
    ], 'neumos', now)).toBe('cover')
    expect(doorRollupLabel([
      pulse({ doorChips: ['line'] }),
    ], 'neumos', now)).toBe('Line')
  })

  it('emits no rollup when there are no chips tonight', () => {
    const now = new Date('2026-09-14T05:00:00.000Z')
    expect(rollupDoorChip([pulse({ doorChips: [] })], 'neumos', now)).toBeNull()
    expect(rollupDoorChip([pulse({
      createdAt: '2026-09-10T04:00:00.000Z',
      doorChips: ['line'],
    })], 'neumos', now)).toBeNull()
    expect(rollupDoorChip([], 'neumos', now)).toBeNull()
  })
})
