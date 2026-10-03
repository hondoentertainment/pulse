import { UX_PILL_ACTIVE, UX_PILL_IDLE } from '@/lib/ux-chrome'
import { VENUE_FOLLOW_COPY } from '@/lib/venue-follows'

interface FollowVenueButtonProps {
  following: boolean
  onClick: () => void
  disabled?: boolean
  /** Tonight / feed rows — X-density pill, not the venue-page CTA. */
  compact?: boolean
  /** Text action inside a Tonight card: Follow · Share · I’m here. */
  inline?: boolean
  /** Equal hit target beside Share and I’m here. */
  equal?: boolean
}

export function FollowVenueButton({ following, onClick, disabled, compact = false, inline = false, equal = false }: FollowVenueButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={following}
      aria-label={following ? 'Unfollow venue' : 'Follow venue'}
      className={
        equal
          ? `flex h-11 min-w-0 flex-1 items-center justify-center rounded-[14px] px-2 text-[13px] font-semibold touch-manipulation ${
              following ? UX_PILL_ACTIVE : 'bg-muted text-foreground'
            }`
          : inline
          ? 'min-h-11 px-1 text-[12px] font-medium text-foreground touch-manipulation'
          : compact
          ? `h-8 min-w-[5.5rem] rounded-full px-3 text-[13px] font-semibold ${
              following ? UX_PILL_ACTIVE : UX_PILL_IDLE
            }`
          : `h-12 min-w-0 flex-1 rounded-[14px] px-3 text-[13px] font-semibold ${
              following ? UX_PILL_ACTIVE : 'bg-muted text-foreground'
            }`
      }
    >
      {following ? VENUE_FOLLOW_COPY.following : VENUE_FOLLOW_COPY.follow}
    </button>
  )
}
