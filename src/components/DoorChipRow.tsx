import { DOOR_CHIP_LABELS, DOOR_CHIP_VALUES, type DoorChip } from '@/lib/door-chips'
import { UX_PILL_ACTIVE, UX_PILL_IDLE } from '@/lib/ux-chrome'

interface DoorChipRowProps {
  value?: readonly DoorChip[]
  onToggle?: (chip: DoorChip) => void
  readOnly?: boolean
}

export function DoorChipRow({ value = [], onToggle, readOnly = false }: DoorChipRowProps) {
  if (readOnly && value.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5" aria-label="Door chips">
      {(readOnly ? value : DOOR_CHIP_VALUES).map((chip) => {
        const selected = value.includes(chip)
        if (readOnly && !selected) return null
        return (
          <button
            key={chip}
            type="button"
            disabled={readOnly}
            onClick={() => onToggle?.(chip)}
            className={`h-8 rounded-full px-3 text-[12px] font-semibold ${
              selected ? UX_PILL_ACTIVE : UX_PILL_IDLE
            }`}
          >
            {DOOR_CHIP_LABELS[chip]}
          </button>
        )
      })}
    </div>
  )
}
