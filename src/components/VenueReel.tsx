import { memo, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Broadcast, Sparkle } from '@phosphor-icons/react'
import type { Pulse, Venue } from '@/lib/types'
import { getEnergyColor } from '@/lib/pulse-engine'
import { cn } from '@/lib/utils'

interface VenueReelProps {
  venues: Venue[]
  pulses: Pulse[]
  onVenueClick: (venue: Venue) => void
}

function getVenuePhotoMap(pulses: Pulse[]) {
  const photos = new Map<string, string>()
  for (const pulse of pulses) {
    const photo = pulse.photos?.[0]
    if (photo && !photos.has(pulse.venueId)) {
      photos.set(pulse.venueId, photo)
    }
  }
  return photos
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase()
}

export const VenueReel = memo(function VenueReel({ venues, pulses, onVenueClick }: VenueReelProps) {
  const photoByVenueId = useMemo(() => getVenuePhotoMap(pulses), [pulses])
  const reelVenues = useMemo(
    () => [...venues]
      .sort((a, b) => {
        const aLive = a.liveSummary?.reportCount ?? 0
        const bLive = b.liveSummary?.reportCount ?? 0
        return (b.pulseScore + bLive * 6 + (b.scoreVelocity ?? 0) * 0.4) -
          (a.pulseScore + aLive * 6 + (a.scoreVelocity ?? 0) * 0.4)
      })
      .slice(0, 12),
    [venues]
  )

  if (reelVenues.length === 0) return null

  return (
    <section className="border-y border-border/60 bg-background/75 backdrop-blur-xl">
      <div className="mx-auto max-w-2xl px-3 py-3">
        <div className="flex items-center justify-between px-1 pb-2">
          <div className="flex items-center gap-2">
            <Sparkle size={16} weight="fill" className="text-accent" />
            <h2 className="text-sm font-bold">Live reel</h2>
          </div>
          <span className="text-[11px] font-medium text-muted-foreground">Now</span>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
          {reelVenues.map((venue, index) => {
            const photo = photoByVenueId.get(venue.id)
            const color = getEnergyColor(venue.pulseScore)
            const hasLiveReports = (venue.liveSummary?.reportCount ?? 0) > 0

            return (
              <motion.button
                key={venue.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.025 }}
                onClick={() => onVenueClick(venue)}
                className="group w-[74px] shrink-0 text-center"
                aria-label={`Open ${venue.name}`}
              >
                <div
                  className="relative mx-auto h-[68px] w-[68px] rounded-full p-[2px]"
                  style={{
                    background: `conic-gradient(from 145deg, ${color}, oklch(0.75 0.18 195), oklch(0.65 0.28 340), ${color})`,
                  }}
                >
                  <div className="h-full w-full overflow-hidden rounded-full border-2 border-background bg-card">
                    {photo ? (
                      <img
                        src={photo}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                      />
                    ) : (
                      <div
                        className="flex h-full w-full items-center justify-center text-sm font-bold text-white"
                        style={{
                          background:
                            `linear-gradient(135deg, ${color} 0%, color-mix(in oklch, ${color} 30%, black) 100%)`,
                        }}
                      >
                        {getInitials(venue.name)}
                      </div>
                    )}
                  </div>
                  <div
                    className={cn(
                      "absolute -bottom-0.5 -right-0.5 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-background px-1 text-[10px] font-bold text-background",
                      hasLiveReports && "gap-0.5"
                    )}
                    style={{ backgroundColor: color }}
                  >
                    {hasLiveReports && <Broadcast size={10} weight="fill" />}
                    {Math.round(venue.pulseScore)}
                  </div>
                </div>
                <p className="mt-1.5 truncate text-[11px] font-medium text-foreground">{venue.name}</p>
              </motion.button>
            )
          })}
        </div>
      </div>
    </section>
  )
})
