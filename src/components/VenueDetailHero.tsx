import { ArrowLeft, Broadcast, HeartStraight, ShareNetwork, Star } from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import type { Venue } from '@/lib/types'
import { PulseScore } from '@/components/PulseScore'

interface VenueDetailHeroProps {
  venue: Venue
  mediaUrl?: string
  isFavorite: boolean
  isFollowed?: boolean
  onBack: () => void
  onShare: () => void
  onToggleFavorite: () => void
  onToggleFollow?: () => void
}

export function VenueDetailHero({
  venue,
  mediaUrl,
  isFavorite,
  isFollowed,
  onBack,
  onShare,
  onToggleFavorite,
  onToggleFollow,
}: VenueDetailHeroProps) {
  const liveReports = venue.liveSummary?.reportCount ?? 0

  return (
    <section className="relative h-[420px] overflow-hidden bg-secondary">
      {mediaUrl ? (
        <motion.img
          src={mediaUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          initial={{ scale: 1.04 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.8 }}
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(135deg, color-mix(in oklch, var(--primary) 68%, black), color-mix(in oklch, var(--accent) 44%, black))',
          }}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/35 to-black/40" />

      <div className="absolute left-0 right-0 top-0 z-10">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
          <button
            onClick={onBack}
            aria-label="Back to venues"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur transition-colors hover:bg-black/55"
          >
            <ArrowLeft size={24} weight="bold" />
          </button>
          <div className="flex items-center gap-2">
            {onToggleFollow && (
              <button
                onClick={onToggleFollow}
                aria-label={isFollowed ? 'Unfollow venue' : 'Follow venue'}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur transition-colors hover:bg-black/55"
              >
                <HeartStraight size={22} weight={isFollowed ? 'fill' : 'regular'} className={isFollowed ? 'text-primary' : undefined} />
              </button>
            )}
            <button
              onClick={onShare}
              aria-label="Share venue"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur transition-colors hover:bg-black/55"
            >
              <ShareNetwork size={22} />
            </button>
            <button
              onClick={onToggleFavorite}
              aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur transition-colors hover:bg-black/55"
            >
              <Star size={22} weight={isFavorite ? 'fill' : 'regular'} className={isFavorite ? 'text-accent' : undefined} />
            </button>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-10">
        <div className="mx-auto max-w-2xl px-4 pb-6">
          <div className="mb-3 flex flex-wrap gap-2">
            {venue.category && (
              <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white backdrop-blur">
                {venue.category}
              </span>
            )}
            {liveReports > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-accent/95 px-3 py-1 text-xs font-bold text-accent-foreground">
                <Broadcast size={12} weight="fill" />
                {liveReports} live
              </span>
            )}
          </div>
          <div className="flex items-end justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-4xl font-bold leading-tight text-white drop-shadow">{venue.name}</h1>
              {(venue.city || venue.state) && (
                <p className="mt-1 text-sm font-medium text-white/75">
                  {[venue.city, venue.state].filter(Boolean).join(', ')}
                </p>
              )}
            </div>
            <div className="shrink-0 rounded-2xl bg-black/45 p-3 backdrop-blur">
              <PulseScore score={venue.pulseScore} size="sm" showLabel={false} />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
