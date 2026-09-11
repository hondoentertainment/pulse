import { ENERGY_CONFIG, type EnergyRating } from '@/lib/types'
import { relativeReviewTime, snippetCaption } from '@/lib/live-reviews'
import { cn } from '@/lib/utils'
import { PulseActionRow } from '@/components/ux/PulseActionRow'
import { TimelineAvatar } from '@/components/ux/TimelineAvatar'

interface LiveReviewFeedCardProps {
  energyRating: EnergyRating
  createdAt: string
  caption?: string
  unverified?: boolean
  as?: 'button' | 'article'
  onClick?: () => void
  className?: string
  displayName?: string
  handle?: string
  avatarUrl?: string
  boostCount?: number
  onBoost?: () => void
  onReply?: () => void
  onShare?: () => void
}

export function LiveReviewFeedCard({
  energyRating,
  createdAt,
  caption,
  unverified = false,
  as = 'article',
  onClick,
  className,
  displayName,
  handle,
  avatarUrl,
  boostCount,
  onBoost,
  onReply,
  onShare,
}: LiveReviewFeedCardProps) {
  const energy = ENERGY_CONFIG[energyRating]
  const name = displayName || energy.label
  const metaHandle = handle ?? `@${energyRating}`
  const body = snippetCaption(caption, 200) || 'On-site energy'

  const meta = (
    <>
      <div className="flex min-w-0 items-baseline gap-1">
        <span className="truncate text-[15px] font-bold text-foreground">{name}</span>
        <span className="truncate text-[15px] text-muted-foreground">{metaHandle}</span>
        <span className="shrink-0 text-[15px] text-muted-foreground">· {relativeReviewTime(createdAt)}</span>
      </div>
      <p className="mt-0.5 text-[15px] leading-5 text-foreground">{body}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-[11px] font-semibold text-foreground">
          {energy.label}
        </span>
        <span className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
          {unverified ? 'Unverified' : 'Verified'}
        </span>
      </div>
    </>
  )

  return (
    <article className={cn('flex gap-3 border-b border-border px-0 py-3', className)}>
      <TimelineAvatar name={name} src={avatarUrl} />
      <div className="min-w-0 flex-1">
        {as === 'button' ? (
          <button type="button" onClick={onClick} aria-label={body} className="block w-full text-left">
            {meta}
          </button>
        ) : (
          <div>{meta}</div>
        )}
        <PulseActionRow
          boostCount={boostCount}
          onBoost={onBoost}
          onReply={onReply ?? onClick}
          onShare={onShare ?? onClick}
        />
      </div>
    </article>
  )
}
