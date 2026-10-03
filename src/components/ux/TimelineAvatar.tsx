import { cn } from '@/lib/utils'
import { displayInitials } from '@/lib/venue-handle'

interface TimelineAvatarProps {
  name: string
  src?: string | null
  className?: string
}

export function TimelineAvatar({ name, src, className }: TimelineAvatarProps) {
  const initials = displayInitials(name)
  return (
    <span
      className={cn(
        'inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-[13px] font-bold text-foreground',
        className,
      )}
      aria-hidden
    >
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        initials
      )}
    </span>
  )
}
