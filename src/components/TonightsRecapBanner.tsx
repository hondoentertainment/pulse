import { useMemo } from 'react'
import { Pulse, User, Venue } from '@/lib/types'
import { generateTonightsRecap } from '@/lib/stories'
import { Button } from '@/components/ui/button'
import { MoonStars, ShareNetwork } from '@phosphor-icons/react'
import { toast } from 'sonner'

interface TonightsRecapBannerProps {
  currentUser: User
  pulses: Pulse[]
  venues: Venue[]
}

export function TonightsRecapBanner({ currentUser, pulses, venues }: TonightsRecapBannerProps) {
  const recap = useMemo(
    () => generateTonightsRecap(currentUser.id, pulses, venues),
    [currentUser.id, pulses, venues]
  )

  if (!recap) return null

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: "Tonight's Recap", text: recap.shareText })
      } else {
        await navigator.clipboard.writeText(recap.shareText)
        toast.success('Recap copied to clipboard')
      }
    } catch {
      toast.error('Could not share recap')
    }
  }

  return (
    <section className="rounded-[1.75rem] border border-primary/25 bg-gradient-to-br from-primary/15 via-card to-accent/10 p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <MoonStars size={22} weight="fill" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-primary">Tonight&apos;s Recap</p>
          <p className="mt-1 text-lg font-black leading-snug">{recap.headline}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {recap.totalVenues} spot{recap.totalVenues !== 1 ? 's' : ''} · {recap.dominantMood} energy
          </p>
          <ul className="mt-3 space-y-1">
            {recap.venues.slice(0, 4).map(v => (
              <li key={v.venueId} className="text-sm truncate">
                {v.venueName}
              </li>
            ))}
          </ul>
          <Button size="sm" variant="secondary" className="mt-4 rounded-xl" onClick={() => void handleShare()}>
            <ShareNetwork size={16} className="mr-2" />
            Share recap
          </Button>
        </div>
      </div>
    </section>
  )
}
