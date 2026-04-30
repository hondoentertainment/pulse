import { MapPin, Clock, CurrencyDollar } from '@phosphor-icons/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export interface ProposedPlanStop {
  venueName: string
  venueCategory?: string
  arrivalTime: string
  departureTime: string
  estimatedSpend?: number
  notes?: string
}

export interface ProposedPlan {
  stops: ProposedPlanStop[]
  totalPerPerson?: number
  startTime?: string
  endTime?: string
}

interface PlanPreviewCardProps {
  plan: ProposedPlan
  onSave: () => void
  onRefine: () => void
  onShare: () => void
  saving?: boolean
}

function fmtTime(iso?: string): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  } catch {
    return iso
  }
}

export function PlanPreviewCard({ plan, onSave, onRefine, onShare, saving = false }: PlanPreviewCardProps) {
  return (
    <Card className="border-primary/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Proposed plan</CardTitle>
        {plan.totalPerPerson !== undefined && (
          <div className="flex items-center gap-2 pt-1 text-sm text-muted-foreground">
            <CurrencyDollar className="size-4" />
            <span>~${plan.totalPerPerson.toFixed(0)} per person</span>
            {plan.startTime && plan.endTime && (
              <>
                <span>·</span>
                <Clock className="size-4" />
                <span>
                  {fmtTime(plan.startTime)} – {fmtTime(plan.endTime)}
                </span>
              </>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <ol className="space-y-2">
          {plan.stops.map((stop, idx) => (
            <li
              key={`${stop.venueName}-${idx}`}
              className="rounded-md border bg-card/50 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <span className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-xs text-primary">
                    {idx + 1}
                  </span>
                  {stop.venueName}
                </div>
                {stop.venueCategory && (
                  <Badge variant="secondary" className="text-[10px]">
                    {stop.venueCategory}
                  </Badge>
                )}
              </div>
              <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                <MapPin className="size-3" />
                <span>
                  {fmtTime(stop.arrivalTime)} → {fmtTime(stop.departureTime)}
                </span>
                {stop.estimatedSpend !== undefined && (
                  <span>· ~${stop.estimatedSpend.toFixed(0)}</span>
                )}
              </div>
              {stop.notes && (
                <p className="mt-1 text-xs text-muted-foreground">{stop.notes}</p>
              )}
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" onClick={onSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save plan'}
          </Button>
          <Button size="sm" variant="outline" onClick={onRefine}>
            Refine
          </Button>
          <Button size="sm" variant="ghost" onClick={onShare}>
            Share with crew
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
