/**
 * Optional one-tap door chips on a pulse: line / cover / energy.
 * Do not invent values — only these three labels.
 */

export const DOOR_CHIP_VALUES = ['line', 'cover', 'energy'] as const
export type DoorChip = (typeof DOOR_CHIP_VALUES)[number]

export const DOOR_CHIP_LABELS: Record<DoorChip, string> = {
  line: 'Line',
  cover: 'Cover',
  energy: 'Energy',
}

export function isDoorChip(value: unknown): value is DoorChip {
  return value === 'line' || value === 'cover' || value === 'energy'
}

export function sanitizeDoorChips(raw: unknown): DoorChip[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<DoorChip>()
  for (const item of raw) {
    if (isDoorChip(item) && !seen.has(item)) seen.add(item)
  }
  return DOOR_CHIP_VALUES.filter((chip) => seen.has(chip))
}

export function toggleDoorChip(current: readonly DoorChip[], chip: DoorChip): DoorChip[] {
  if (!isDoorChip(chip)) return sanitizeDoorChips(current)
  const set = new Set(sanitizeDoorChips(current))
  if (set.has(chip)) set.delete(chip)
  else set.add(chip)
  return DOOR_CHIP_VALUES.filter((value) => set.has(value))
}

export function doorChipLine(chips: readonly DoorChip[] | undefined): string | null {
  const clean = sanitizeDoorChips(chips)
  if (clean.length === 0) return null
  return clean.map((chip) => DOOR_CHIP_LABELS[chip]).join(' · ')
}
