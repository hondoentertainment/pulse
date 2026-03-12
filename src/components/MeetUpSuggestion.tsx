import { motion } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MapPinArea, NavigationArrow, Lightning } from '@phosphor-icons/react'
import { ENERGY_CONFIG } from '@/lib/types'
import type { Venue, EnergyRating } from '@/lib/types'
import { getDistancesToVenue } from '@/lib/social-coordination'

interface MeetUpSuggestionProps {
  suggestions: Venue[]
  friendNames: string[]
  friendLocations?: { lat: number; lng: number }[]
  onSelect: (venueId: string) => void
}

function getEnergyForScore(score: number): EnergyRating {
  if (score >= 75) return 'electric'
  if (score >= 50) return 'buzzing'
  if (score >= 25) return 'chill'
  return 'dead'
}

function formatMiles(miles: number): string {
  if (miles < 0.1) return '<0.1 mi'
  return `${miles.toFixed(1)} mi`
}

export function MeetUpSuggestion({
  suggestions,
  friendNames,
  friendLocations,
  onSelect,
}: MeetUpSuggestionProps) {
  if (suggestions.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24 }}
    >
      <Card className="p-4 bg-card/90 border-purple-500/20 backdrop-blur-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <div className="h-8 w-8 rounded-full bg-purple-500/15 flex items-center justify-center">
            <MapPinArea size={18} weight="fill" className="text-purple-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Meet in the Middle</h3>
            <p className="text-[10px] text-muted-foreground">
              Best spots for{' '}
              {friendNames.length <= 2
                ? friendNames.join(' & ')
                : `${friendNames.slice(0, -1).join(', ')} & ${friendNames[friendNames.length - 1]}`}
            </p>
          </div>
        </div>

        {/* Venue suggestions */}
        <div className="space-y-2">
          {suggestions.map((venue, i) => {
            const energy = getEnergyForScore(venue.pulseScore)
            const distances = friendLocations
              ? getDistancesToVenue(venue, friendLocations)
              : []

            return (
              <motion.div
                key={venue.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + i * 0.08 }}
                className="flex items-center gap-3 p-2.5 rounded-xl bg-secondary/30 border border-border/40 hover:border-purple-400/30 transition-colors"
              >
                {/* Rank indicator */}
                <div className="h-6 w-6 rounded-full bg-purple-500/15 flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-bold text-purple-300">
                    {i + 1}
                  </span>
                </div>

                {/* Venue info */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">
                    {venue.name}
                  </p>

                  {/* Distance per person */}
                  {distances.length > 0 && (
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                      {distances.map((dist, j) => (
                        <span
                          key={j}
                          className="text-[9px] text-muted-foreground flex items-center gap-0.5"
                        >
                          <NavigationArrow size={8} className="opacity-50" />
                          {friendNames[j]
                            ? `${friendNames[j]}: `
                            : ''}
                          {formatMiles(dist)}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Energy level */}
                  <div className="flex items-center gap-1.5 mt-1">
                    <Badge
                      variant="outline"
                      className="text-[9px] px-1.5 py-0 h-4 border-transparent"
                      style={{
                        color: ENERGY_CONFIG[energy].color,
                        backgroundColor: `color-mix(in oklch, ${ENERGY_CONFIG[energy].color} 15%, transparent)`,
                      }}
                    >
                      <Lightning size={8} weight="fill" className="mr-0.5" />
                      {ENERGY_CONFIG[energy].label}
                    </Badge>
                  </div>
                </div>

                {/* CTA */}
                <Button
                  size="sm"
                  onClick={() => onSelect(venue.id)}
                  className="h-7 px-3 text-[10px] font-semibold bg-purple-500 hover:bg-purple-600 text-white shrink-0"
                >
                  Let's go
                </Button>
              </motion.div>
            )
          })}
        </div>
      </Card>
    </motion.div>
  )
}
