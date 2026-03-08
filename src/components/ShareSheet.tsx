import { useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import {
  ShareNetwork, Link, Copy, ChatCircle, InstagramLogo, Check
} from '@phosphor-icons/react'
import type { ShareCard } from '@/lib/sharing'
import { buildNativeShareData, buildClipboardShareText } from '@/lib/sharing'
import { toast } from 'sonner'

interface ShareSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  card: ShareCard | null
}

export function ShareSheet({ open, onOpenChange, card }: ShareSheetProps) {
  const [copied, setCopied] = useState(false)

  if (!card) return null

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share(buildNativeShareData(card))
      } catch {
        // User cancelled
      }
    } else {
      handleCopyLink()
    }
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(buildClipboardShareText(card))
      setCopied(true)
      toast.success('Link copied!')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Failed to copy')
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="bg-card border-border rounded-t-2xl">
        <SheetHeader className="pb-2">
          <SheetTitle className="flex items-center gap-2 text-foreground">
            <ShareNetwork size={20} weight="fill" className="text-accent" />
            Share
          </SheetTitle>
        </SheetHeader>

        {/* Preview card */}
        <div
          className="rounded-xl p-4 mb-4 border"
          style={{
            borderColor: card.energyColor,
            background: `${card.energyColor}10`,
          }}
        >
          <p className="font-bold text-foreground">{card.title}</p>
          <p className="text-xs text-muted-foreground mt-1">{card.description}</p>
          <div className="flex items-center gap-2 mt-2">
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ color: card.energyColor, backgroundColor: `${card.energyColor}20` }}
            >
              {card.energyLabel} {card.score}/100
            </span>
          </div>
        </div>

        {/* Share options */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          <button
            onClick={handleNativeShare}
            className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-background hover:bg-muted transition-colors"
          >
            <ShareNetwork size={24} weight="fill" className="text-accent" />
            <span className="text-[10px] text-muted-foreground">Share</span>
          </button>

          <button
            onClick={handleCopyLink}
            className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-background hover:bg-muted transition-colors"
          >
            {copied
              ? <Check size={24} weight="bold" className="text-accent" />
              : <Link size={24} weight="fill" className="text-foreground" />
            }
            <span className="text-[10px] text-muted-foreground">{copied ? 'Copied!' : 'Copy Link'}</span>
          </button>

          <button
            onClick={() => {
              toast.info('Opening Messages...')
              onOpenChange(false)
            }}
            className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-background hover:bg-muted transition-colors"
          >
            <ChatCircle size={24} weight="fill" className="text-foreground" />
            <span className="text-[10px] text-muted-foreground">Message</span>
          </button>

          <button
            onClick={() => {
              toast.info('Opening Story editor...')
              onOpenChange(false)
            }}
            className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-background hover:bg-muted transition-colors"
          >
            <InstagramLogo size={24} weight="fill" className="text-foreground" />
            <span className="text-[10px] text-muted-foreground">Story</span>
          </button>
        </div>

        <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
      </SheetContent>
    </Sheet>
  )
}
