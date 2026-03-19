import { useEffect, useMemo } from 'react'
import { Venue, Pulse } from '@/lib/types'
import { Neighborhood, NeighborhoodScore, getNeighborhoodLeaderboard, getHottestNeighborhood, assignVenueToNeighborhood } from '@/lib/neighborhood-scores'
import { CaretLeft, MapTrifold, Crown, TrendUp } from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import { trackEvent } from '@/lib/analytics'

interface NeighborhoodViewProps {
  venues: Venue[]
  pulses: Pulse[]
  onBack: () => void
  onVenueClick: (venue: Venue) => void
}

function buildNeighborhoods(venues: Venue[]): Neighborhood[] {
  // Group venues by city and create neighborhoods
  const cityVenues: Record<string, Venue[]> = {}
  for (const v of venues) {
    const city = v.city || 'Unknown'
    if (!cityVenues[city]) cityVenues[city] = []
    cityVenues[city].push(v)
  }

  return Object.entries(cityVenues).map(([city, vList]) => {
    const lats = vList.map(v => v.location.lat)
    const lngs = vList.map(v => v.location.lng)
    return {
      id: `n-${city.toLowerCase().replace(/\s/g, '-')}`,
      name: city,
      city,
      bounds: {
        north: Math.max(...lats) + 0.01,
        south: Math.min(...lats) - 0.01,
        east: Math.max(...lngs) + 0.01,
        west: Math.min(...lngs) - 0.01,
      },
      venueIds: vList.map(v => v.id),
    }
  })
}

export function NeighborhoodView({ venues, pulses, onBack, onVenueClick }: NeighborhoodViewProps) {
  const neighborhoods = useMemo(() => buildNeighborhoods(venues), [venues])

  const leaderboard = useMemo(
    () => getNeighborhoodLeaderboard(neighborhoods, venues, pulses),
    [neighborhoods, venues, pulses]
  )

  const hottest = useMemo(
    () => getHottestNeighborhood(neighborhoods, venues, pulses),
    [neighborhoods, venues, pulses]
  )

  const hottestVenues = useMemo(() => {
    if (!hottest) return []
    const n = neighborhoods.find(n => n.id === hottest.neighborhoodId)
    if (!n) return []
    return venues.filter(v => n.venueIds.includes(v.id)).sort((a, b) => b.pulseScore - a.pulseScore).slice(0, 5)
  }, [hottest, neighborhoods, venues])

  useEffect(() => {
    trackEvent({
      type: 'neighborhood_view',
      timestamp: Date.now(),
      neighborhoodCount: neighborhoods.length,
    })
  }, [neighborhoods.length])

  const handleVenueClick = (venue: Venue) => {
    const neighborhood = assignVenueToNeighborhood(venue, neighborhoods)
    if (neighborhood) {
      trackEvent({
        type: 'neighborhood_venue_click',
        timestamp: Date.now(),
        neighborhoodId: neighborhood.id,
        venueId: venue.id,
      })
    }
    onVenueClick(venue)
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="flex items-center gap-3 px-4 py-3 max-w-2xl mx-auto">
          <button onClick={onBack} className="p-2 -ml-2 hover:bg-muted rounded-lg">
            <CaretLeft size={24} />
          </button>
          <div className="flex items-center gap-2">
            <MapTrifold size={24} weight="fill" className="text-primary" />
            <h1 className="text-xl font-bold">Neighborhoods</h1>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {hottest && hottest.score > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-orange-500/20 to-red-500/20 rounded-2xl p-6 border border-orange-500/30"
          >
            <div className="flex items-center gap-2 mb-2">
              <Crown size={20} weight="fill" className="text-orange-400" />
              <span className="text-sm font-medium text-orange-400">Hottest Right Now</span>
            </div>
            <h2 className="text-2xl font-bold">{hottest.name}</h2>
            <p className="text-sm text-muted-foreground">{hottest.city}</p>
            <div className="flex items-center gap-4 mt-3">
              <div>
                <p className="text-lg font-bold text-orange-400">{Math.round(hottest.score)}</p>
                <p className="text-xs text-muted-foreground">Energy Score</p>
              </div>
              <div>
                <p className="text-lg font-bold">{hottest.activeVenueCount}</p>
                <p className="text-xs text-muted-foreground">Active Venues</p>
              </div>
              <div>
                <p className="text-lg font-bold">{hottest.totalVenues}</p>
                <p className="text-xs text-muted-foreground">Total Venues</p>
              </div>
            </div>
          </motion.div>
        )}

        <div className="space-y-3">
          <h2 className="text-lg font-bold">Neighborhood Leaderboard</h2>
          {leaderboard.map((ns, i) => (
            <motion.div
              key={ns.neighborhoodId}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-card rounded-xl p-4 border border-border flex items-center gap-4"
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                i === 0 ? 'bg-orange-500/20 text-orange-400' :
                i === 1 ? 'bg-gray-400/20 text-gray-400' :
                i === 2 ? 'bg-amber-700/20 text-amber-600' :
                'bg-muted text-muted-foreground'
              }`}>
                {i + 1}
              </div>
              <div className="flex-1">
                <p className="font-medium">{ns.name}</p>
                <p className="text-xs text-muted-foreground">{ns.city} · {ns.activeVenueCount} active</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-primary">{Math.round(ns.score)}</p>
                {ns.hottest && (
                  <span className="text-[10px] text-orange-400 font-medium flex items-center gap-0.5 justify-end">
                    <TrendUp size={10} /> HOT
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        {hottestVenues.length > 0 && hottest && (
          <div className="space-y-3">
            <h2 className="text-lg font-bold">Top in {hottest.name}</h2>
            {hottestVenues.map((venue, i) => (
              <button
                key={venue.id}
                onClick={() => {
                  if (hottest) {
                    trackEvent({
                      type: 'neighborhood_hottest_click',
                      timestamp: Date.now(),
                      neighborhoodId: hottest.neighborhoodId,
                      city: hottest.city,
                    })
                  }
                  handleVenueClick(venue)
                }}
                className="w-full bg-card rounded-xl p-3 border border-border flex items-center gap-3 hover:border-primary/50 transition-colors text-left"
              >
                <span className="text-sm font-bold text-muted-foreground w-6">{i + 1}</span>
                <div className="flex-1">
                  <p className="font-medium text-sm">{venue.name}</p>
                  <p className="text-xs text-muted-foreground">{venue.category}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-sm text-primary">{Math.round(venue.pulseScore)}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
