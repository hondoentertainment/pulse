import { headingBannerCopy } from '@/lib/heading-there'

export function HeadingHereBanner({
  displayName,
  place,
  createdAt,
  ended,
  onSkip,
}: {
  displayName?: string | null
  place?: string | null
  createdAt?: string | null
  ended?: boolean
  onSkip?: () => void
}) {
  const copy = headingBannerCopy({ displayName, place, createdAt, ended })
  const initial = (displayName?.trim() || 'S').slice(0, 1).toUpperCase()
  return (
    <section
      data-testid="hop-banner"
      aria-label={copy.title}
      className="flex items-start gap-3 rounded-2xl border border-border bg-card px-3 py-3"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
        {initial}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold text-foreground">{copy.title}</p>
        <p className="mt-0.5 text-[12px] text-muted-foreground">{copy.meta}</p>
      </div>
      {onSkip && (
        <button
          type="button"
          onClick={onSkip}
          className="shrink-0 text-[13px] font-semibold text-accent"
        >
          Skip Welcome
        </button>
      )}
    </section>
  )
}
