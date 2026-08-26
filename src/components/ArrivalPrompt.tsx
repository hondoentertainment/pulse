import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { ArrivalCorrection, ArrivalWatch } from '@/lib/arrival-prompt'

const CORRECTIONS: { id: ArrivalCorrection; label: string }[] = [
  { id: 'quieter', label: 'Quieter' },
  { id: 'busier', label: 'Busier' },
  { id: 'longer_line', label: 'Longer line' },
  { id: 'shorter_line', label: 'Shorter line' },
  { id: 'closed', label: 'Closed' },
  { id: 'other', label: 'Other' },
]

interface ArrivalPromptProps {
  watch: ArrivalWatch
  onConfirm: () => void
  onMismatch: (correction: ArrivalCorrection) => void
}

export function ArrivalPrompt({ watch, onConfirm, onMismatch }: ArrivalPromptProps) {
  const [correcting, setCorrecting] = useState(false)

  return (
    <section
      role="dialog"
      aria-labelledby="arrival-prompt-title"
      aria-describedby="arrival-prompt-copy"
      className="rounded-2xl border border-accent/30 bg-card p-4 shadow-lg"
      data-testid="arrival-prompt"
    >
      <p className="text-[11px] font-semibold uppercase tracking-wider text-accent">Did you arrive?</p>
      <h2 id="arrival-prompt-title" className="mt-1 text-lg font-bold">
        How does {watch.venueName} match the Pulse?
      </h2>
      <p id="arrival-prompt-copy" className="mt-1 text-sm text-muted-foreground">
        One tap. Confirm if the signal was right, or correct it if it was off.
      </p>

      {!correcting ? (
        <div className="mt-4 flex gap-2">
          <Button className="flex-1" onClick={onConfirm}>
            Matches
          </Button>
          <Button variant="outline" className="flex-1" onClick={() => setCorrecting(true)}>
            Off
          </Button>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-2" role="group" aria-label="What was off">
          {CORRECTIONS.map((correction) => (
            <Button
              key={correction.id}
              variant="outline"
              className="h-11"
              onClick={() => onMismatch(correction.id)}
            >
              {correction.label}
            </Button>
          ))}
        </div>
      )}
    </section>
  )
}
