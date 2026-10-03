/**
 * Door rollup — tonight’s REAL door chips aggregate to one venue chip.
 * No chips tonight = no rollup. Never guess.
 */

import { sanitizeDoorChips, DOOR_CHIP_LABELS, type DoorChip } from './door-chips'
import { localDateKey } from './tonight-digest'
import type { Pulse } from './types'

export function tonightDoorChips(
  pulses: readonly Pulse[],
  venueId: string,
  now: Date = new Date(),
): DoorChip[] {
  const today = localDateKey(now)
  const seen: DoorChip[] = []
  for (const pulse of pulses) {
    if (pulse.venueId !== venueId) continue
    if (localDateKey(new Date(pulse.createdAt)) !== today) continue
    for (const chip of sanitizeDoorChips(pulse.doorChips)) {
      seen.push(chip)
    }
  }
  return seen
}

/** Most common tonight chip. Ties break line → cover → energy. Null if none. */
export function rollupDoorChip(
  pulses: readonly Pulse[],
  venueId: string,
  now: Date = new Date(),
): DoorChip | null {
  const chips = tonightDoorChips(pulses, venueId, now)
  if (chips.length === 0) return null
  const counts: Record<DoorChip, number> = { line: 0, cover: 0, energy: 0 }
  for (const chip of chips) counts[chip] += 1
  let best: DoorChip | null = null
  let bestCount = 0
  for (const chip of ['line', 'cover', 'energy'] as const) {
    if (counts[chip] > bestCount) {
      best = chip
      bestCount = counts[chip]
    }
  }
  return best
}

export function doorRollupLabel(
  pulses: readonly Pulse[],
  venueId: string,
  now: Date = new Date(),
): string | null {
  const chip = rollupDoorChip(pulses, venueId, now)
  return chip ? DOOR_CHIP_LABELS[chip] : null
}
