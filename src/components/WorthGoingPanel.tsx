import { Card } from '@/components/ui/card'
import { buildDecisionExplanation, type WorthGoingVerdict } from '@/lib/decision-explanations'
import { computeVenueSignal } from '@/lib/venue-signal'
import { scoreToEnergyRating } from '@/lib/pulse-engine'
import type { Pulse, Venue } from '@/lib/types'
import { cn } from '@/lib/utils'
import { SealCheck, Warning, Question } from '@phosphor-icons/react'

interface WorthGoingPanelProps {
  venue: Venue
  pulses: Pulse[]
  distanceMiles?: number | null
  desiredVibe?: 'any'
}

const VERDICT_COPY: Record<WorthGoingVerdict, { label: string; tone: string }> = {
  yes: { label: 'Worth going', tone: 'text-emerald-400' },
  maybe: { label: 'Maybe — check freshness', tone: 'text-amber-400' },
  caution: { label: 'Proceed with caution', tone: 'text-orange-400' },
  unknown: { label: 'Not enough signal', tone: 'text-muted-foreground' },
}

function VerdictIcon({ verdict }: { verdict: WorthGoingVerdict }) {
  if (verdict === 'yes') return <SealCheck size={22} weight="fill" className="text-emerald-400" />
  if (verdict === 'caution') return <Warning size={22} weight="fill" className="text-orange-400" />
  return <Question size={22} weight="fill" className="text-amber-400" />
}

export function WorthGoingPanel({ venue, pulses, distanceMiles }: WorthGoingPanelProps) {
  const signal = computeVenueSignal(venue, pulses)
  const energyMatch = true
  const explanation = buildDecisionExplanation({
    venue,
    reasons: [],
    confidence: signal.confidence,
    freshnessMinutes: signal.freshnessMinutes,
    reportCount: signal.reportCount,
    distanceMiles: distanceMiles ?? null,
    trend: signal.trend,
    energyMatch,
    desiredVibe: 'any',
  })
  const verdict = explanation.worthGoing
  const copy = VERDICT_COPY[verdict]
  const energy = scoreToEnergyRating(venue.pulseScore)

  return (
    <Card className="p-4 space-y-3 border-accent/20 bg-card" data-testid="worth-going-panel">
      <div className="flex items-start gap-3">
        <VerdictIcon verdict={verdict} />
        <div className="flex-1 space-y-1">
          <p className="text-xs font-mono uppercase tracking-wide text-muted-foreground">
            Worth going?
          </p>
          <p className={cn('text-lg font-bold', copy.tone)}>{copy.label}</p>
          <p className="text-sm text-muted-foreground">{explanation.headline}</p>
        </div>
      </div>
      <p className="text-sm leading-relaxed">{explanation.explanation}</p>
      <div className="flex flex-wrap gap-2 text-xs font-mono">
        <span className="rounded-md bg-secondary px-2 py-1">{explanation.confidenceLabel}</span>
        <span className="rounded-md bg-secondary px-2 py-1">{explanation.freshnessLabel}</span>
        <span className="rounded-md bg-secondary px-2 py-1 capitalize">{energy} now</span>
        <span className="rounded-md bg-secondary px-2 py-1">Signal v{signal.modelVersion}</span>
      </div>
      {explanation.frictionNotes.length > 0 && (
        <ul className="text-xs text-muted-foreground space-y-1">
          {explanation.frictionNotes.map((note) => (
            <li key={note}>• {note}</li>
          ))}
        </ul>
      )}
    </Card>
  )
}
