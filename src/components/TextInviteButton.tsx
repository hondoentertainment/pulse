import { TEXT_INVITE_CTA, textInviteHref } from '@/lib/text-invite'

export function TextInviteButton({
  venueId,
  venueName,
}: {
  venueId: string
  venueName: string
}) {
  const href = textInviteHref({ venueId, venueName })
  return (
    <a
      href={href}
      className="inline-flex h-9 items-center rounded-full border border-border px-3 text-[13px] font-semibold text-foreground"
    >
      {TEXT_INVITE_CTA}
    </a>
  )
}
