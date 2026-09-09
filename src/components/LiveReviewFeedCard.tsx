import { ENERGY_CONFIG, type EnergyRating } from '@/lib/types'
import { relativeReviewTime, snippetCaption } from '@/lib/live-reviews'
import { cn } from '@/lib/utils'

interface LiveReviewFeedCardProps {
  energyRating: EnergyRating
  createdAt: string
  caption?: string
  unverified?: boolean
  as?: 'button' | 'article'
  onClick?: () => void
  className?: string
}

export function LiveReviewFeedCard({
  energyRating,
  createdAt,
  caption,
  unverified = false,
  as = 'article',
  onClick,
  className,
}: LiveReviewFeedCardProps) {
  const energy = ENERGY_CONFIG[energyRating]
  const body = (
    <>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="inline-flex shrink-0 items-center rounded-full px-3 py-1.5 text-xs font-semibold text-white"
            style={{ backgroundColor: energy.color }}
          >
            {energy.label}
          </span>
          {unverified && (
            <span className="text-[11px] font-medium text-muted-foreground">Unverified</span>
          )}
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">
          {relativeReviewTime(createdAt)}
        </span>
      </div>
      <p className="mt-2 text-sm text-foreground">
        {snippetCaption(caption, 200) || 'On-site energy'}
      </p>
    </>
  )

  const cardClass = cn(
    'w-full rounded-[18px] bg-[#17171C] p-3.5 text-left',
    as === 'button' && 'transition-colors hover:bg-[#1C1C21]',
    className,
  )

  if (as === 'button') {
    return (
      <button type="button" onClick={onClick} className={cardClass}>
        {body}
      </button>
    )
  }

  return <article className={cardClass}>{body}</article>
}
