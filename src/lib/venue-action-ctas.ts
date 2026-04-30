import {
  getBestRideshareOption,
  getAvailableReservations,
  getVenueIntegrationAvailability,
  getVenueMapsUrl,
  getVenueReservationLinks,
  getVenueTicketUrl,
  type IntegrationType,
} from './integrations'
import type { VenueLiveData } from './live-intelligence'
import type { Venue } from './types'

export type VenueActionId =
  | 'directions'
  | 'ride'
  | 'reserve'
  | 'tickets'
  | 'surge_watch'
  | 'guest_list'

export interface VenueActionCta {
  id: VenueActionId
  label: string
  shortLabel: string
  description: string
  integrationType?: IntegrationType
  provider?: string
  href?: string
  disabledReason?: string
  badge?: string
  tone: 'primary' | 'secondary' | 'accent' | 'success'
  kind: 'launch' | 'toggle' | 'status'
  isActive?: boolean
}

interface VenueActionOptions {
  userLocation?: { lat: number; lng: number } | null
  liveData?: VenueLiveData | null
  isWatchingSurge?: boolean
}

export function getVenueActionCtas(
  venue: Venue,
  {
    userLocation = null,
    liveData = null,
    isWatchingSurge = false,
  }: VenueActionOptions = {}
): VenueActionCta[] {
  const availability = getVenueIntegrationAvailability(venue, userLocation)
  const reservationLinks = getVenueReservationLinks(venue)
  const reservation = [...getAvailableReservations(reservationLinks)]
    .sort((a, b) => {
      if (a.kind === 'direct' && b.kind !== 'direct') return -1
      if (a.kind !== 'direct' && b.kind === 'direct') return 1
      return 0
    })[0] ?? reservationLinks[0]
  const ride = userLocation ? getBestRideshareOption(venue, userLocation.lat, userLocation.lng) : null
  const guestListStatus = liveData?.doorMode.guestListStatus ?? null
  const guestListDescription = guestListStatus
    ? `Guest list ${guestListStatus}${liveData?.operatorNote ? ` • ${liveData.operatorNote}` : ''}`
    : liveData?.operatorNote ?? 'No guest list update posted yet'

  return [
    {
      id: 'directions',
      label: 'Directions',
      shortLabel: 'Directions',
      description: venue.location.address || 'Open this venue in maps',
      integrationType: 'maps',
      href: getVenueMapsUrl(venue),
      disabledReason: availability.maps.available ? undefined : availability.maps.reason,
      badge: availability.maps.available ? 'Live route' : 'Unavailable',
      tone: 'primary',
      kind: 'launch',
    },
    {
      id: 'ride',
      label: ride ? `Book ${ride.provider === 'uber' ? 'Uber' : 'Lyft'}` : 'Book a Ride',
      shortLabel: 'Ride',
      description: ride ? ride.label : 'Enable location to compare rides',
      integrationType: 'rideshare',
      provider: ride?.provider,
      href: ride?.deepLink,
      disabledReason: availability.rideshare.available ? undefined : availability.rideshare.reason,
      badge: ride ? `${ride.estimatedMinutes} min` : 'Location needed',
      tone: 'accent',
      kind: 'launch',
    },
    {
      id: 'reserve',
      label: reservation?.provider === 'resy' ? 'Reserve on Resy' : 'Reserve a Table',
      shortLabel: 'Reserve',
      description: reservation
        ? reservation.kind === 'direct'
          ? `Linked ${reservation.provider === 'resy' ? 'Resy' : 'OpenTable'} page`
          : 'Search results for this venue'
        : 'No reservation link configured',
      integrationType: 'reservation',
      provider: reservation?.provider,
      href: reservation?.deepLink,
      disabledReason: reservation ? undefined : availability.reservation.reason,
      badge: reservation?.kind === 'direct' ? 'Direct' : reservation ? 'Search' : 'Unavailable',
      tone: 'success',
      kind: 'launch',
    },
    {
      id: 'tickets',
      label: 'Tickets & Events',
      shortLabel: 'Tickets',
      description: venue.website ? 'Open the venue site for entry info and events' : 'Search tickets and event listings for this venue',
      integrationType: 'tickets',
      href: getVenueTicketUrl(venue),
      disabledReason: availability.tickets.available ? undefined : availability.tickets.reason,
      badge: venue.website ? 'Venue site' : 'Search',
      tone: 'secondary',
      kind: 'launch',
    },
    {
      id: 'surge_watch',
      label: isWatchingSurge ? 'Watching Surge' : 'Notify on Surge',
      shortLabel: isWatchingSurge ? 'Watching' : 'Watch',
      description: isWatchingSurge
        ? 'We will keep this venue on your radar when energy spikes.'
        : 'Save this venue for future surge alerts.',
      integrationType: 'shortcuts',
      badge: isWatchingSurge ? 'Alert on' : 'Alert off',
      tone: isWatchingSurge ? 'success' : 'secondary',
      kind: 'toggle',
      isActive: isWatchingSurge,
    },
    {
      id: 'guest_list',
      label: guestListStatus ? `Guest List ${capitalizeLabel(guestListStatus)}` : 'Guest List Status',
      shortLabel: 'Guest List',
      description: guestListDescription,
      badge: guestListStatus ? capitalizeLabel(guestListStatus) : 'No post',
      tone: guestListStatus === 'open' ? 'success' : guestListStatus === 'limited' ? 'accent' : 'secondary',
      kind: 'status',
      isActive: guestListStatus === 'open',
    },
  ]
}

function capitalizeLabel(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
