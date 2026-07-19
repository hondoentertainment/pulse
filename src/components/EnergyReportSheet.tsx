import { useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { ENERGY_CONFIG, type EnergyRating } from '@/lib/types'
import { cn } from '@/lib/utils'

const ENERGY_OPTIONS: EnergyRating[] = ['dead', 'chill', 'buzzing', 'electric']

interface EnergyReportSheetProps {
  open: boolean
  venueName: string
  onClose: () => void
  onSubmit: (energy: EnergyRating) => void
  /** Optional scout weekly quota progress label (e.g. "2/3 scout reports this week"). */
  scoutQuotaLabel?: string | null
}

export function EnergyReportSheet({
  open,
  venueName,
  onClose,
  onSubmit,
  scoutQuotaLabel,
}: EnergyReportSheetProps) {
  const [selected, setSelected] = useState<EnergyRating | null>(null)

  const handleSubmit = () => {
    if (!selected) return
    onSubmit(selected)
    setSelected(null)
    onClose()
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setSelected(null)
          onClose()
        }
      }}
    >
      <SheetContent side="bottom" className="rounded-t-2xl" data-testid="energy-report-sheet">
        <SheetHeader>
          <SheetTitle>What&apos;s it like at {venueName}?</SheetTitle>
          <SheetDescription>
            Your tip helps people decide for the next hour — then it fades. Three taps, no photo required.
          </SheetDescription>
        </SheetHeader>

        {scoutQuotaLabel && (
          <p className="mt-3 text-xs text-muted-foreground" role="status">
            {scoutQuotaLabel}
          </p>
        )}

        <div
          className="mt-5 grid grid-cols-2 gap-3"
          role="radiogroup"
          aria-label="Energy level"
        >
          {ENERGY_OPTIONS.map((energy) => {
            const config = ENERGY_CONFIG[energy]
            const active = selected === energy
            return (
              <button
                key={energy}
                type="button"
                role="radio"
                data-testid={`energy-report-${energy}`}
                aria-checked={active}
                onClick={() => setSelected(energy)}
                className={cn(
                  'min-h-16 rounded-2xl border px-3 py-3 text-left transition-colors',
                  active ? 'border-primary bg-primary/15' : 'border-border bg-card hover:border-primary/40',
                )}
              >
                <span className="text-xl" aria-hidden>{config.emoji}</span>
                <p className="mt-1 text-sm font-semibold">{config.label}</p>
              </button>
            )
          })}
        </div>

        <Button
          data-testid="energy-report-submit"
          className="mt-5 w-full min-h-11"
          disabled={!selected}
          onClick={handleSubmit}
        >
          Post live review
        </Button>
      </SheetContent>
    </Sheet>
  )
}
