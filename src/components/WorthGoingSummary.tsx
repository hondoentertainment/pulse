import { Broadcast, Clock, Gauge, Queue, Sparkle } from '@phosphor-icons/react'
import type { WorthGoingSummary as WorthGoingSummaryModel } from '@/lib/worth-going'
import { cn } from '@/lib/utils'

const VERDICT_STYLES = {
  go: 'border-accent/40 bg-accent/10 text-accent',
  maybe: 'border-primary/40 bg-primary/10 text-primary',
  wait: 'border-muted-foreground/30 bg-muted/40 text-muted-foreground',
  unknown: 'border-border bg-card text-muted-foreground',
} as const

interface WorthGoingSummaryProps {
  summary: WorthGoingSummaryModel
}

export function WorthGoingSummary({ summary }: WorthGoingSummaryProps) {
  return (
    <section
      aria-labelledby="worth-going-heading"
      className="rounded-2xl border border-border bg-card/90 p-4 shadow-sm"
      data-testid="worth-going-summary"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Worth going</p>
          <h2 id="worth-going-heading" className="mt-1 text-xl font-bold">
            {summary.headline}
          </h2>
        </div>
        <span
          className={cn('rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide', VERDICT_STYLES[summary.verdict])}
        >
          {summary.verdict}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl border border-border/70 bg-background/50 p-3">
          <dt className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
            <Gauge size={13} weight="fill" aria-hidden />
            Confidence
          </dt>
          <dd className="mt-1 font-semibold capitalize">{summary.confidence}</dd>
        </div>
        <div className="rounded-xl border border-border/70 bg-background/50 p-3">
          <dt className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
            <Clock size={13} weight="fill" aria-hidden />
            Freshness
          </dt>
          <dd className="mt-1 font-semibold">{summary.freshness}</dd>
        </div>
        <div className="rounded-xl border border-border/70 bg-background/50 p-3">
          <dt className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
            <Queue size={13} weight="fill" aria-hidden />
            Friction
          </dt>
          <dd className="mt-1 font-semibold">{summary.friction}</dd>
        </div>
        <div className="rounded-xl border border-border/70 bg-background/50 p-3">
          <dt className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
            <Broadcast size={13} weight="fill" aria-hidden />
            Source mix
          </dt>
          <dd className="mt-1 font-semibold">{summary.sourceMix}</dd>
        </div>
      </dl>

      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Sparkle size={12} weight="fill" aria-hidden />
        {summary.reasons.join(' · ')}
      </p>
    </section>
  )
}
