import type { LaunchQuietEmpty } from '@/lib/launch-city-quiet'
import { TonightEmptyState } from '@/components/TonightEmptyState'

export function LaunchQuietTonight({
  empty,
  onPost,
  onImHere,
}: {
  empty: LaunchQuietEmpty
  onPost?: (venueId: string) => void
  onImHere?: (venueId: string) => void
}) {
  return (
    <div data-testid="launch-quiet-tonight">
      <TonightEmptyState
        empty={{ headline: empty.headline, body: empty.body, steps: empty.steps }}
        ctaLabel={onPost ? empty.cta : undefined}
        onCta={onPost ? () => onPost(empty.venue.id) : undefined}
      />
      <p className="mt-3 text-[12px] leading-4 text-muted-foreground">{empty.launchLine}</p>
      <section className="pt-4" aria-label={empty.sectionLabel}>
        <h2 className="text-[13px] font-semibold text-muted-foreground">{empty.sectionLabel}</h2>
        <article className="mt-2 rounded-2xl border border-border bg-card p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[16px] font-bold text-foreground">{empty.venue.name}</p>
              {empty.roomMeta && (
                <p className="mt-0.5 text-[12px] text-muted-foreground">{empty.roomMeta}</p>
              )}
            </div>
            <span className="rounded-full bg-muted px-2 py-1 text-[11px] font-semibold text-muted-foreground">
              Quiet
            </span>
          </div>
          <p className="mt-2 text-[13px] font-semibold text-accent">{empty.countLine}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {onPost && (
              <button
                type="button"
                onClick={() => onPost(empty.venue.id)}
                className="h-11 rounded-[14px] bg-primary/90 text-[14px] font-semibold text-primary-foreground"
              >
                Post first pulse
              </button>
            )}
            {onImHere && (
              <button
                type="button"
                onClick={() => onImHere(empty.venue.id)}
                className="h-11 rounded-[14px] border border-border text-[14px] font-semibold text-foreground"
              >
                I'm here
              </button>
            )}
          </div>
          {empty.venue.neighborhood && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              {empty.venue.neighborhood} · {empty.curatedLabel}
            </p>
          )}
        </article>
      </section>
    </div>
  )
}
