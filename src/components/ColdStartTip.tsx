import { ALL_SEATTLE_TIP, COLD_START_HEADLINE, COLD_START_SUBLINE, START_EXPLORING_LABEL } from '@/lib/cold-start'

interface ColdStartTipProps {
  onDismiss: () => void
}

export function ColdStartTip({ onDismiss }: ColdStartTipProps) {
  return (
    <section
      className="space-y-3 rounded-[18px] bg-[#17171C] p-3.5"
      aria-label="First session"
    >
      <h2 className="text-xl font-bold text-white">{COLD_START_HEADLINE}</h2>
      <p className="text-[13px] text-muted-foreground">{COLD_START_SUBLINE}</p>
      <div className="h-[120px] rounded-2xl bg-[#1A1A1F]" aria-hidden="true" />
      <p className="text-xs text-muted-foreground">{ALL_SEATTLE_TIP}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="h-12 w-full rounded-2xl bg-primary text-[15px] font-semibold text-primary-foreground"
      >
        {START_EXPLORING_LABEL}
      </button>
    </section>
  )
}
