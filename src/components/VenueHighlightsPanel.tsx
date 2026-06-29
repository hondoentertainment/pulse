import { Pulse } from '@/lib/types'
import { getVenueHighlights, type VenueHighlight } from '@/lib/stories'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Sparkle } from '@phosphor-icons/react'

interface VenueHighlightsPanelProps {
  venueId: string
  highlights: VenueHighlight[]
  pulses: Pulse[]
}

export function VenueHighlightsPanel({ venueId, highlights, pulses }: VenueHighlightsPanelProps) {
  const venueHighlights = getVenueHighlights(highlights, venueId)
  if (venueHighlights.length === 0) return null

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Sparkle size={20} weight="fill" className="text-accent" />
        <h3 className="text-lg font-bold">Venue Highlights</h3>
      </div>
      {venueHighlights.map(highlight => {
        const highlightPulses = pulses.filter(p => highlight.pulseIds.includes(p.id)).slice(0, 4)
        return (
          <Card key={highlight.id} className="overflow-hidden border-primary/20">
            <div className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold">{highlight.title}</p>
                  <p className="text-sm text-muted-foreground">{highlight.description}</p>
                </div>
                {highlight.featured && (
                  <Badge variant="secondary" className="shrink-0">Featured</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Curated by {highlight.curatedBy.username}
              </p>
              {highlightPulses.length > 0 && (
                <div className="grid grid-cols-4 gap-2">
                  {highlightPulses.map(pulse => (
                    <div
                      key={pulse.id}
                      className="aspect-square rounded-xl overflow-hidden bg-muted border border-border"
                    >
                      {pulse.photos[0] ? (
                        <img src={pulse.photos[0]} alt="" className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-lg">
                          {pulse.energyRating === 'electric' ? '⚡' : pulse.energyRating === 'buzzing' ? '🔥' : '✨'}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        )
      })}
    </section>
  )
}
