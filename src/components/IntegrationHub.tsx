import { Venue, Pulse, User } from '@/lib/types'
import {
  generateRideshareLink,
  getVenueNowPlaying,
  formatSpotifyDisplay,
  getShortcutActions,
  executeShortcut,
  getVenueReservationLinks,
  getVenueMapsUrl,
  getVenueIntegrationAvailability,
  getIntegrationStatus,
  launchIntegrationUrl,
  SpotifyNowPlaying,
  ReservationLink,
  RideshareLink,
} from '@/lib/integrations'
import { trackEvent } from '@/lib/analytics'
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
  currentUser: User
  pulses: Pulse[]
  onBack: () => void
  onVenueClick: (venue: Venue) => void
}

export function IntegrationHub({
  venue,
  userLocation,
  venues,
  currentUser,
  pulses,
  onBack,
  onVenueClick,
}: IntegrationHubProps) {
  const availability = getVenueIntegrationAvailability(venue, userLocation)
  const musicStatus = getIntegrationStatus('music', { configured: availability.music.available })
  const reservationStatus = getIntegrationStatus('reservation', { configured: availability.reservation.available })

  const rideshareLinks: RideshareLink[] = userLocation
    ? [
        generateRideshareLink('uber', venue, userLocation.lat, userLocation.lng),
        generateRideshareLink('lyft', venue, userLocation.lat, userLocation.lng),
      ]
    : []

  const nowPlaying: SpotifyNowPlaying = getVenueNowPlaying(venue)

  const reservations: ReservationLink[] = getVenueReservationLinks(venue)
  const shortcuts = getShortcutActions()
  const mapsUrl = getVenueMapsUrl(venue)

  const launch = (
    url: string,
    meta: {
      integrationType: 'rideshare' | 'music' | 'reservation' | 'maps' | 'shortcuts'
      actionId: string
      provider?: string
      successMessage: string
      unavailableReason?: string
    }
  ) => {
    if (meta.unavailableReason) {
      trackEvent({
        type: 'integration_action',
        timestamp: Date.now(),
        venueId: venue.id,
        integrationType: meta.integrationType,
        actionId: meta.actionId,
        provider: meta.provider,
        outcome: 'unavailable',
        reason: meta.unavailableReason,
      })
      toast.error(meta.unavailableReason)
      return
    }

    const result = launchIntegrationUrl(url, {
      opener: (...args) => window.open(...args),
      locationAssign: (nextUrl) => window.location.assign(nextUrl),
    })

    if (!result.ok) {
      trackEvent({
        type: 'integration_action',
        timestamp: Date.now(),
        venueId: venue.id,
        integrationType: meta.integrationType,
        actionId: meta.actionId,
        provider: meta.provider,
        outcome: result.reason === 'unavailable' ? 'unavailable' : 'failed',
        reason: result.reason,
      })

      const description = result.reason === 'popup-blocked'
        ? 'Allow pop-ups for Pulse to open partner links.'
        : 'Check your browser settings and try again.'

      toast.error('Launch failed', {
        description,
      })
      return
    }

    trackEvent({
      type: 'integration_action',
      timestamp: Date.now(),
      venueId: venue.id,
      integrationType: meta.integrationType,
      actionId: meta.actionId,
      provider: meta.provider,
      outcome: 'success',
    })
    toast.success(meta.successMessage)
  }

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
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 p-4">
              <div className="flex items-center gap-2 mb-3">
                <MusicNote size={18} weight="fill" className="text-green-500" />
                <h3 className="font-bold text-sm">Now Playing</h3>
                <Badge variant="outline" className="text-xs border-green-500/30 text-green-500">
                  {musicStatus.available ? 'Ready' : 'Setup needed'}
                </Badge>
              </div>
              <div className="flex items-center gap-3">
                {nowPlaying.albumArt && (
                  <img
                    src={nowPlaying.albumArt}
                    alt=""
                    loading="lazy"
                    decoding="async"
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
                  onClick={() => launch(nowPlaying.launchUrl ?? '', {
                    integrationType: 'music',
                    actionId: 'open_music',
                    provider: 'spotify',
                    successMessage: `Opening ${formatSpotifyDisplay(nowPlaying)}`,
                    unavailableReason: availability.music.available ? undefined : availability.music.reason,
                  })}
                >
                  <ArrowSquareOut size={14} />
                </Button>
              </div>
              {!musicStatus.available && musicStatus.configRequired.length > 0 && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Configure: {musicStatus.configRequired.join(', ')}
                </p>
              )}
            </div>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Car size={18} weight="fill" className="text-primary" />
              <h3 className="font-bold text-sm">Get There</h3>
              {!availability.rideshare.available && (
                <Badge variant="outline" className="text-[10px]">
                  Location required
                </Badge>
              )}
            </div>
            {rideshareLinks.length > 0 ? (
              <div className="space-y-2">
                {rideshareLinks.map(link => (
                  <button
                    key={link.provider}
                    onClick={() => launch(link.deepLink, {
                      integrationType: 'rideshare',
                      actionId: `open_${link.provider}`,
                      provider: link.provider,
                      successMessage: `Opening ${link.provider === 'uber' ? 'Uber' : 'Lyft'}...`,
                    })}
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
            ) : (
              <p className="text-sm text-muted-foreground">{availability.rideshare.reason}</p>
            )}
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Calendar size={18} weight="fill" className="text-blue-500" />
              <h3 className="font-bold text-sm">Reserve a Table</h3>
              <Badge variant="outline" className="text-[10px]">
                {reservations.some(link => link.kind === 'direct') ? 'Direct links' : 'Search fallback'}
              </Badge>
            </div>
            <div className="space-y-2">
              {reservations.map(res => (
                <button
                  key={res.provider}
                  onClick={() => launch(res.deepLink, {
                    integrationType: 'reservation',
                    actionId: `open_${res.provider}`,
                    provider: res.provider,
                    successMessage: `Opening ${res.provider === 'opentable' ? 'OpenTable' : 'Resy'}...`,
                    unavailableReason: availability.reservation.available ? undefined : availability.reservation.reason,
                  })}
                  className="w-full flex items-center gap-3 p-3 bg-secondary/50 rounded-lg hover:bg-secondary transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <Calendar size={16} weight="fill" className="text-blue-500" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium">
                      {res.provider === 'opentable' ? 'OpenTable' : 'Resy'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {res.kind === 'direct' ? 'Linked venue page' : 'Search results for this venue'}
                    </p>
                    {res.nextSlot && (
                      <p className="text-xs text-muted-foreground">Next available: {res.nextSlot}</p>
                    )}
                  </div>
                  <Badge variant={res.available ? 'default' : 'outline'} className="text-xs">
                    {res.kind === 'direct' ? 'Direct' : 'Search'}
                  </Badge>
                </button>
              ))}
            </div>
            {!reservationStatus.available && reservationStatus.configRequired.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Configure: {reservationStatus.configRequired.join(', ')}
              </p>
            )}
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
          <Card className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <MapPin size={18} weight="fill" className="text-orange-500" />
              <h3 className="font-bold text-sm">Map It</h3>
            </div>
            <button
              onClick={() => launch(mapsUrl, {
                integrationType: 'maps',
                actionId: 'open_maps',
                provider: 'google_maps',
                successMessage: 'Opening maps...',
                unavailableReason: availability.maps.available ? undefined : availability.maps.reason,
              })}
              className="w-full flex items-center gap-3 p-3 bg-secondary/50 rounded-lg hover:bg-secondary transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center">
                <MapPin size={16} weight="fill" className="text-orange-500" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium">Open in Maps</p>
                <p className="text-xs text-muted-foreground">
                  {venue.location.address || 'Use live coordinates for directions'}
                </p>
              </div>
              <ArrowSquareOut size={14} className="text-muted-foreground" />
            </button>
          </Card>
        </motion.div>

        <Separator />

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
                    const results = executeShortcut(action, venues, 5, {
                      userLocation,
                      currentUser,
                      pulses,
                    })

                    if (results.length > 0) {
                      trackEvent({
                        type: 'integration_action',
                        timestamp: Date.now(),
                        venueId: venue.id,
                        integrationType: 'shortcuts',
                        actionId: action.id,
                        outcome: 'success',
                      })
                      onVenueClick(results[0])
                      toast.success(action.name)
                      return
                    }

                    trackEvent({
                      type: 'integration_action',
                      timestamp: Date.now(),
                      venueId: venue.id,
                      integrationType: 'shortcuts',
                      actionId: action.id,
                      outcome: 'unavailable',
                      reason: action.type === 'friends'
                        ? 'No recent friend activity yet.'
                        : 'No matching venues available.',
                    })

                    toast.info(action.type === 'friends'
                      ? 'No recent friend activity yet'
                      : 'No matching venues available')
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
