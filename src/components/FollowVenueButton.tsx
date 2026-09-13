import { UX_PILL_ACTIVE, UX_PILL_IDLE } from '@/lib/ux-chrome'
import { VENUE_FOLLOW_COPY } from '@/lib/venue-follows'

interface FollowVenueButtonProps {
  following: boolean
  onClick: () => void
  disabled?: boolean
  /** Tonight / feed rows — X-density pill, not the venue-page CTA. */
  compact?: boolean
}

export function FollowVenueButton({ following, onClick, disabled, compact = false }: FollowVenueButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={following}
      aria-label={following ? 'Unfollow venue' : 'Follow venue'}
      className={
        compact
          ? `h-8 min-w-[5.5rem] rounded-full px-3 text-[13px] font-semibold ${
              following ? UX_PILL_ACTIVE : UX_PILL_IDLE
            }`
          : `h-12 min-w-[7.5rem] rounded-full px-5 text-[15px] font-bold ${
              following ? UX_PILL_ACTIVE : UX_PILL_IDLE
            }`
      }
    >
      {following ? VENUE_FOLLOW_COPY.following : VENUE_FOLLOW_COPY.follow}
    </button>
  )
}
