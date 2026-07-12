import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import type { PendingArrival } from '@/lib/arrival-prompt'
import { ENERGY_CONFIG } from '@/lib/types'

interface ArrivalPromptSheetProps {
  open: boolean
  pending: PendingArrival | null
  onConfirm: () => void
  onMismatch: () => void
  onDismiss: () => void
}

export function ArrivalPromptSheet({
  open,
  pending,
  onConfirm,
  onMismatch,
  onDismiss,
}: ArrivalPromptSheetProps) {
  if (!pending) return null

  const energyLabel = ENERGY_CONFIG[pending.displayedEnergy].label

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onDismiss()}>
      <SheetContent side="bottom" className="rounded-t-2xl" data-testid="arrival-prompt-sheet">
        <SheetHeader>
          <SheetTitle>Did you make it to {pending.venueName}?</SheetTitle>
          <SheetDescription>
            We showed {energyLabel} when you tapped Go. Help us keep the signal honest.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 flex flex-col gap-3">
          <Button
            data-testid="arrival-confirm"
            className="w-full min-h-11"
            onClick={onConfirm}
          >
            Yes — vibe matches
          </Button>
          <Button
            data-testid="arrival-mismatch"
            variant="outline"
            className="w-full min-h-11"
            onClick={onMismatch}
          >
            No — different energy than shown
          </Button>
          <Button variant="ghost" className="w-full min-h-11" onClick={onDismiss}>
            Not yet
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
