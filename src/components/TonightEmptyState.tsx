import type { TonightEmptyState as TonightEmpty } from '@/lib/tonight-home'

interface TonightEmptyStateProps {
  empty: TonightEmpty
}

export function TonightEmptyState({ empty }: TonightEmptyStateProps) {
  return (
    <section className="rounded-[18px] bg-[#17171C] p-3.5" aria-label="Teach the Pulse loop">
      <h2 className="text-sm font-semibold text-white">{empty.headline}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{empty.body}</p>
      <ol className="mt-3 space-y-1.5 text-sm text-white">
        {empty.steps.map((step, index) => (
          <li key={step} className="flex gap-2">
            <span className="text-primary font-semibold">{index + 1}.</span>
            {step}
          </li>
        ))}
      </ol>
    </section>
  )
}
