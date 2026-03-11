import { Venue } from '@/lib/types'
import {
  generateRideshareLink,
  createSpotifyNowPlaying,
  formatSpotifyDisplay,
  createReservationLink,
  getShortcutActions,
  executeShortcut,
  SpotifyNowPlaying,
  ReservationLink,
  RideshareLink,
} from '@/lib/integrations'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  ArrowLeft, Car, MusicNote, Calendar, Lightning,
  ArrowSquareOut, Clock, MapPin,
} from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'

interface IntegrationHubProps {
  venue: Venue
  userLocation: { lat: number; lng: number } | null
  venues: Venue[]
  onBack: () => void
  onVenueClick: (venue: Venue) => void
}

export function IntegrationHub({
  venue,
  userLocation,
  venues,
  onBack,
  onVenueClick,
}: IntegrationHubProps) {
  // Build rideshare links
  const rideshareLinks: RideshareLink[] = userLocation
    ? [
        generateRideshareLink('uber', venue, userLocation.lat, userLocation.lng),
        generateRideshareLink('lyft', venue, userLocation.lat, userLocation.lng),
      ]
    : []

  // Demo now playing
  const nowPlaying: SpotifyNowPlaying = createSpotifyNowPlaying(
    venue.id,
    'Midnight City',
    'M83',
    { playlistName: `${venue.name} Vibes`, albumArt: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200' }
  )

  // Demo reservation links
  const reservations: ReservationLink[] = [
    createReservationLink('opentable', venue.id, venue.name.toLowerCase().replace(/\s/g, '-'), true, '8:00 PM'),
    createReservationLink('resy', venue.id, venue.name.toLowerCase().replace(/\s/g, '-'), true, '9:30 PM'),
  ]

  // Shortcut actions
  const shortcuts = getShortcutActions()

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-secondary">
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold">Integrations</h1>
            <p className="text-xs text-muted-foreground">{venue.name}</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-5">
        {/* Now Playing */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 p-4">
              <div className="flex items-center gap-2 mb-3">
                <MusicNote size={18} weight="fill" className="text-green-500" />
                <h3 className="font-bold text-sm">Now Playing</h3>
                <Badge variant="outline" className="text-xs border-green-500/30 text-green-500">
                  Live
                </Badge>
              </div>
              <div className="flex items-center gap-3">
                {nowPlaying.albumArt && (
                  <img
                    src={nowPlaying.albumArt}
                    alt=""
                    className="w-12 h-12 rounded-lg object-cover"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{nowPlaying.trackName}</p>
                  <p className="text-xs text-muted-foreground truncate">{nowPlaying.artistName}</p>
                  {nowPlaying.playlistName && (
                    <p className="text-xs text-green-500 mt-0.5">{nowPlaying.playlistName}</p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-green-500/30 text-green-500 hover:bg-green-500/10"
                  onClick={() => toast.success(`Now playing: ${formatSpotifyDisplay(nowPlaying)}`)}
                >
                  <ArrowSquareOut size={14} />
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Get There */}
        {rideshareLinks.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <Card className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Car size={18} weight="fill" className="text-primary" />
                <h3 className="font-bold text-sm">Get There</h3>
              </div>
              <div className="space-y-2">
                {rideshareLinks.map(link => (
                  <button
                    key={link.provider}
                    onClick={() => toast.success(`Opening ${link.provider === 'uber' ? 'Uber' : 'Lyft'}...`)}
                    className="w-full flex items-center gap-3 p-3 bg-secondary/50 rounded-lg hover:bg-secondary transition-colors"
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      link.provider === 'uber' ? 'bg-black text-white' : 'bg-pink-600 text-white'
                    }`}>
                      <Car size={16} weight="fill" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-medium">
                        {link.provider === 'uber' ? 'Uber' : 'Lyft'}
                      </p>
                      <p className="text-xs text-muted-foreground">{link.label}</p>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock size={12} />
                      ~{link.estimatedMinutes}min
                    </div>
                    {link.surgeMultiplier && link.surgeMultiplier > 1.5 && (
                      <Badge variant="outline" className="text-[10px] text-yellow-500 border-yellow-500/30">
                        Surge
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
            </Card>
          </motion.div>
        )}

        {/* Reservations */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Calendar size={18} weight="fill" className="text-blue-500" />
              <h3 className="font-bold text-sm">Reserve a Table</h3>
            </div>
            <div className="space-y-2">
              {reservations.map(res => (
                <button
                  key={res.provider}
                  onClick={() => toast.success(`Opening ${res.provider === 'opentable' ? 'OpenTable' : 'Resy'}...`)}
                  className="w-full flex items-center gap-3 p-3 bg-secondary/50 rounded-lg hover:bg-secondary transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <Calendar size={16} weight="fill" className="text-blue-500" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium">
                      {res.provider === 'opentable' ? 'OpenTable' : 'Resy'}
                    </p>
                    {res.nextSlot && (
                      <p className="text-xs text-muted-foreground">Next available: {res.nextSlot}</p>
                    )}
                  </div>
                  <Badge variant={res.available ? 'default' : 'outline'} className="text-xs">
                    {res.available ? 'Available' : 'Full'}
                  </Badge>
                </button>
              ))}
            </div>
          </Card>
        </motion.div>

        <Separator />

        {/* Quick Shortcuts */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Lightning size={18} weight="fill" className="text-accent" />
              <h3 className="font-bold text-sm">Quick Actions</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {shortcuts.map(action => (
                <button
                  key={action.id}
                  onClick={() => {
                    const results = executeShortcut(action, venues, 5)
                    if (results.length > 0) {
                      onVenueClick(results[0])
                    }
                    toast.success(action.name)
                  }}
                  className="p-3 bg-secondary/50 rounded-lg text-left hover:bg-secondary transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    {action.type === 'tonight' && <Lightning size={14} weight="fill" className="text-accent" />}
                    {action.type === 'nearby' && <MapPin size={14} weight="fill" className="text-green-500" />}
                    {action.type === 'friends' && <MapPin size={14} weight="fill" className="text-blue-500" />}
                    {action.type === 'trending' && <MapPin size={14} weight="fill" className="text-primary" />}
                  </div>
                  <p className="text-xs font-medium">{action.name}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{action.description}</p>
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
