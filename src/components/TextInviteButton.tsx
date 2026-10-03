import { TEXT_INVITE_CTA, textInviteHref } from '@/lib/text-invite'
import { cn } from '@/lib/utils'

export function TextInviteButton({
  venueId,
  venueName,
  className,
}: {
  venueId: string
  venueName: string
  className?: string
}) {
  const href = textInviteHref({ venueId, venueName })
  return (
    <a
      href={href}
      className={cn(
        'inline-flex h-11 items-center justify-center rounded-[14px] border border-white/15 px-3 text-center text-[14px] font-semibold text-foreground',
        className,
      )}
    >
      {TEXT_INVITE_CTA}
    </a>
  )
}
