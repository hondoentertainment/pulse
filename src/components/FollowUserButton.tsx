import { UX_PILL_ACTIVE, UX_PILL_IDLE } from '@/lib/ux-chrome'
import { FRIEND_FOLLOW_COPY } from '@/lib/friends-follow'

interface FollowUserButtonProps {
  following: boolean
  onClick: () => void
  disabled?: boolean
  compact?: boolean
}

export function FollowUserButton({ following, onClick, disabled, compact = true }: FollowUserButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={following}
      aria-label={following ? 'Unfollow person' : 'Follow person'}
      className={
        compact
          ? `h-8 min-w-[5.5rem] rounded-full px-3 text-[13px] font-semibold ${
              following ? UX_PILL_ACTIVE : UX_PILL_IDLE
            }`
          : `h-11 min-w-[7rem] rounded-full px-4 text-[15px] font-bold ${
              following ? UX_PILL_ACTIVE : UX_PILL_IDLE
            }`
      }
    >
      {following ? FRIEND_FOLLOW_COPY.following : FRIEND_FOLLOW_COPY.follow}
    </button>
  )
}
