import { ALL_SEATTLE_TIP, COLD_START_HEADLINE, COLD_START_SUBLINE, START_EXPLORING_LABEL } from '@/lib/cold-start'
import { UX_CTA } from '@/lib/ux-chrome'

interface ColdStartTipProps {
  onDismiss: () => void
}

export function ColdStartTip({ onDismiss }: ColdStartTipProps) {
  return (
    <section
      className="space-y-3 rounded-2xl border border-border bg-card p-4"
      aria-label="First session"
    >
      <h2 className="text-[22px] font-bold tracking-tight text-foreground">{COLD_START_HEADLINE}</h2>
      <p className="text-[13px] leading-5 text-muted-foreground">{COLD_START_SUBLINE}</p>
      <div className="h-[140px] rounded-2xl bg-muted" aria-hidden="true" />
      <p className="text-[13px] text-muted-foreground">{ALL_SEATTLE_TIP}</p>
      <button
        type="button"
        onClick={onDismiss}
        className={`${UX_CTA} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary`}
      >
        {START_EXPLORING_LABEL}
      </button>
    </section>
  )
}
