import { absoluteHopLink, hopSharePreviewUrl, hopShareText, hopTextInviteHref } from '@/lib/heading-there'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { toast } from 'sonner'

export function HeadingThereSheet({
  open,
  onOpenChange,
  venueId,
  headingId,
  venueName,
  place,
  displayName,
  onCancel,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  venueId: string
  headingId?: string | null
  venueName: string
  place?: string | null
  displayName: string
  onCancel: () => void
}) {
  const shortLink = absoluteHopLink(venueId, undefined, headingId)
  const previewUrl = hopSharePreviewUrl(venueId, undefined, headingId)
  const textHref = hopTextInviteHref({ displayName, venueName, url: shortLink })
  const placeLine = place?.trim()

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shortLink)
      toast.success('Hop link copied')
    } catch {
      toast.error('Could not copy the hop link')
    }
  }

  const nativeShare = async () => {
    const text = hopShareText({ displayName, venueName, url: shortLink })
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: `${displayName} is heading to ${venueName}`, text, url: previewUrl })
        return
      } catch {
        return
      }
    }
    try {
      await navigator.clipboard.writeText(previewUrl)
      toast.success('Share link copied')
    } catch {
      toast.error('Sharing is not available on this device')
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl border-border bg-background px-4 pb-8">
        <div data-testid="hop-share-sheet" className="mx-auto w-full max-w-lg space-y-4 pt-2">
          <p className="text-[13px] font-semibold text-accent">Status set · Heading there</p>
          <div>
            <h2 className="text-[22px] font-bold leading-7 text-foreground">You're heading to {venueName}</h2>
            <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
              Friends who open your hop link see you're on the way, then tap I'm here when they arrive.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card px-3 py-2">
            <p className="text-[11px] font-semibold text-muted-foreground">Hop link</p>
            <p className="break-all text-[13px] text-foreground">{shortLink.replace(/^https?:\/\//, '')}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-3">
            <p className="text-[11px] font-semibold text-muted-foreground">Preview</p>
            <p className="mt-3 text-[13px] font-semibold text-accent">Pulse · Heading there</p>
            <p className="mt-1 text-[16px] font-bold text-foreground">{displayName} is heading to {venueName}</p>
            {placeLine && (
              <p className="mt-1 text-[12px] text-muted-foreground">{placeLine} — open the pin and tap I'm here.</p>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => { void copyLink() }}
              className="h-11 rounded-[14px] bg-primary text-[14px] font-semibold text-primary-foreground"
            >
              Copy link
            </button>
            <a
              href={textHref}
              className="flex h-11 items-center justify-center rounded-[14px] border border-border text-[14px] font-semibold text-foreground"
            >
              Text invite
            </a>
            <button
              type="button"
              onClick={() => { void nativeShare() }}
              className="h-11 rounded-[14px] border border-border text-[14px] font-semibold text-foreground"
            >
              More
            </button>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="h-11 w-full text-[14px] font-semibold text-muted-foreground"
          >
            Cancel heading there
          </button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
