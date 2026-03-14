import type { Venue } from './types'

type VenueIntegrationSeed = NonNullable<Venue['integrations']>

const VENUE_INTEGRATION_SEEDS: Record<string, VenueIntegrationSeed> = {
  'venue-1': {
    music: {
      spotifyUrl: 'https://open.spotify.com/search/Neumos%20Seattle',
      playlistName: 'Capitol Hill After Dark',
      searchTerm: 'Neumos Seattle live music',
    },
    maps: {
      googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=925%20E%20Pike%20St%2C%20Seattle%2C%20WA',
    },
  },
  'venue-2': {
    music: {
      spotifyUrl: 'https://open.spotify.com/search/The%20Crocodile%20Seattle',
      playlistName: 'Belltown Soundcheck',
      searchTerm: 'The Crocodile Seattle live music',
    },
  },
  'venue-3': {
    music: {
      spotifyUrl: 'https://open.spotify.com/search/Q%20Nightclub%20Seattle',
      playlistName: 'Late Night Pulse',
      searchTerm: 'Q Nightclub Seattle dance',
    },
  },
  'venue-6': {
    music: {
      spotifyUrl: 'https://open.spotify.com/search/The%20Showbox%20Seattle',
      playlistName: 'Showbox House Lights',
      searchTerm: 'The Showbox Seattle concert',
    },
  },
  'venue-13': {
    music: {
      spotifyUrl: 'https://open.spotify.com/search/The%20Unicorn%20Seattle',
      playlistName: 'Carnival Chaos',
      searchTerm: 'The Unicorn Seattle party',
    },
    maps: {
      googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=1118%20E%20Pike%20St%2C%20Seattle%2C%20WA',
    },
  },
  'venue-49': {
    music: {
      spotifyUrl: 'https://open.spotify.com/search/Starbucks%20Reserve%20Seattle',
      playlistName: 'Roastery Crowd',
      searchTerm: 'Starbucks Reserve Seattle coffeehouse',
    },
    maps: {
      googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=1124%20Pike%20St%2C%20Seattle%2C%20WA',
    },
  },
  'venue-50': {
    reservations: {
      opentableUrl: 'https://www.opentable.com/s?term=Portage%20Bay%20Cafe%20Seattle',
      resyUrl: 'https://resy.com/search?query=Portage%20Bay%20Cafe%20Seattle',
    },
  },
  'venue-60': {
    music: {
      spotifyUrl: 'https://open.spotify.com/search/Barrio%20South%20Lake%20Union',
      playlistName: 'South Lake Union Heat Check',
      searchTerm: 'Barrio South Lake Union happy hour',
    },
    reservations: {
      opentableUrl: 'https://www.opentable.com/s?term=Barrio%20South%20Lake%20Union',
      resyUrl: 'https://resy.com/search?query=Barrio%20South%20Lake%20Union',
    },
    maps: {
      googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=925%20Westlake%20Ave%20N%2C%20Seattle%2C%20WA',
    },
  },
  'venue-65': {
    music: {
      spotifyUrl: 'https://open.spotify.com/search/Mbar%20Seattle',
      playlistName: 'Rooftop Gold Hour',
      searchTerm: 'Mbar Seattle rooftop',
    },
    reservations: {
      opentableUrl: 'https://www.opentable.com/s?term=Mbar%20Seattle',
      resyUrl: 'https://resy.com/search?query=Mbar%20Seattle',
    },
  },
  'venue-69': {
    reservations: {
      opentableUrl: 'https://www.opentable.com/s?term=Daniel%27s%20Broiler%20Seattle',
      resyUrl: 'https://resy.com/search?query=Daniel%27s%20Broiler%20Seattle',
    },
  },
  'venue-71': {
    reservations: {
      opentableUrl: 'https://www.opentable.com/s?term=The%20Whale%20Wins%20Seattle',
      resyUrl: 'https://resy.com/search?query=The%20Whale%20Wins%20Seattle',
    },
  },
  'venue-79': {
    reservations: {
      opentableUrl: 'https://www.opentable.com/s?term=Tavolata%20Seattle',
      resyUrl: 'https://resy.com/search?query=Tavolata%20Seattle',
    },
  },
  'venue-88': {
    reservations: {
      opentableUrl: 'https://www.opentable.com/s?term=Westward%20Seattle',
      resyUrl: 'https://resy.com/search?query=Westward%20Seattle',
    },
    maps: {
      googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=2501%20N%20Northlake%20Way%2C%20Seattle%2C%20WA',
    },
  },
}

function mergeIntegrations(
  base: Venue['integrations'],
  next: VenueIntegrationSeed | undefined
): Venue['integrations'] {
  if (!next) return base

  return {
    music: {
      ...base?.music,
      ...next.music,
    },
    reservations: {
      ...base?.reservations,
      ...next.reservations,
    },
    maps: {
      ...base?.maps,
      ...next.maps,
    },
  }
}

export function applyVenueIntegrationSeeds(venues: Venue[]): Venue[] {
  return venues.map((venue) => ({
    ...venue,
    integrations: mergeIntegrations(venue.integrations, VENUE_INTEGRATION_SEEDS[venue.id]),
  }))
}
