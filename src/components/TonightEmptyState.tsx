import type { TonightEmptyState as TonightEmpty } from '@/lib/tonight-home'

interface TonightEmptyStateProps {
  empty: TonightEmpty
  ctaLabel?: string
  onCta?: () => void
}

export function TonightEmptyState({ empty, ctaLabel, onCta }: TonightEmptyStateProps) {
  return (
    <section className="pt-4" aria-label="Teach the Pulse loop">
      <h2 className="text-[15px] font-bold text-foreground">{empty.headline}</h2>
      <p className="mt-1 text-[13px] text-muted-foreground">{empty.body}</p>
      <ol className="mt-3 flex items-stretch gap-2">
        {empty.steps.map((step, index) => (
          <li
            key={step}
            className="flex min-w-0 flex-1 flex-col gap-1 rounded-xl bg-card px-2.5 py-2.5"
          >
            <span className="text-[12px] font-bold leading-4 text-primary">{index + 1}</span>
            <span className="text-[12px] font-medium leading-4 text-foreground">{step}</span>
          </li>
        ))}
      </ol>
      {ctaLabel && onCta && (
        <button
          type="button"
          onClick={onCta}
          className="mt-3 h-12 w-full rounded-[14px] bg-primary text-[15px] font-semibold text-primary-foreground"
        >
          {ctaLabel}
        </button>
      )}
    </section>
  )
}
