import type { TonightEmptyState as TonightEmpty } from '@/lib/tonight-home'

interface TonightEmptyStateProps {
  empty: TonightEmpty
}

export function TonightEmptyState({ empty }: TonightEmptyStateProps) {
  return (
    <section className="border-y border-border py-5" aria-label="Teach the Pulse loop">
      <h2 className="text-[15px] font-bold text-foreground">{empty.headline}</h2>
      <p className="mt-1 text-[13px] text-muted-foreground">{empty.body}</p>
      <ol className="mt-3 space-y-1.5 text-[15px] text-foreground">
        {empty.steps.map((step, index) => (
          <li key={step} className="flex gap-2">
            <span className="font-semibold text-primary">{index + 1}.</span>
            {step}
          </li>
        ))}
      </ol>
    </section>
  )
}
