import type { Venue } from './types'

export const SAN_FRANCISCO_LAUNCH_NEIGHBORHOODS = [
  'Mission',
  'Castro',
  'SoMa',
  'North Beach',
  'Haight-Ashbury',
  'Marina',
  'Hayes Valley',
  'Tenderloin',
] as const

export type SanFranciscoLaunchNeighborhood = (typeof SAN_FRANCISCO_LAUNCH_NEIGHBORHOODS)[number]

export const SAN_FRANCISCO_LAUNCH_INVENTORY_SOURCE = 'curated-seed' as const
export const SAN_FRANCISCO_LAUNCH_MIN_VENUES = 25
export const SAN_FRANCISCO_LAUNCH_MAX_VENUES = 40

export interface SanFranciscoLaunchVenue extends Venue {
  city: 'San Francisco'
  state: 'CA'
  neighborhood: SanFranciscoLaunchNeighborhood
  seeded: true
  inventorySource: typeof SAN_FRANCISCO_LAUNCH_INVENTORY_SOURCE
}

function room(
  input: Pick<SanFranciscoLaunchVenue, 'id' | 'name' | 'neighborhood' | 'category'> & {
    lat: number
    lng: number
    address: string
    website?: string
  },
): SanFranciscoLaunchVenue {
  return {
    id: input.id,
    name: input.name,
    location: { lat: input.lat, lng: input.lng, address: input.address },
    city: 'San Francisco',
    state: 'CA',
    neighborhood: input.neighborhood,
    category: input.category,
    pulseScore: 0,
    seeded: true,
    inventorySource: SAN_FRANCISCO_LAUNCH_INVENTORY_SOURCE,
    website: input.website,
  }
}

/**
 * Curated San Francisco launch inventory. The one California city on the coast index.
 * Real, publicly listed rooms. pulseScore stays 0. No scraped photos.
 * Los Angeles and San Diego are not in this catalog.
 */
export const SAN_FRANCISCO_LAUNCH_VENUES: SanFranciscoLaunchVenue[] = [
  room({
    id: 'sf-chapel',
    name: 'The Chapel',
    neighborhood: 'Mission',
    category: 'Music Venue',
    lat: 37.7606,
    lng: -122.4214,
    address: '777 Valencia St, San Francisco, CA',
    website: 'https://www.thechapelsf.com',
  }),
  room({
    id: 'sf-el-rio',
    name: 'El Rio',
    neighborhood: 'Mission',
    category: 'Bar',
    lat: 37.7466,
    lng: -122.4192,
    address: '3158 Mission St, San Francisco, CA',
  }),
  room({
    id: 'sf-make-out-room',
    name: 'Make-Out Room',
    neighborhood: 'Mission',
    category: 'Bar',
    lat: 37.7554,
    lng: -122.4198,
    address: '3225 22nd St, San Francisco, CA',
  }),
  room({
    id: 'sf-brick-and-mortar',
    name: 'Brick & Mortar Music Hall',
    neighborhood: 'Mission',
    category: 'Music Venue',
    lat: 37.7694,
    lng: -122.4198,
    address: '1710 Mission St, San Francisco, CA',
    website: 'https://www.brickandmortarmusic.com',
  }),
  room({
    id: 'sf-zeitgeist',
    name: 'Zeitgeist',
    neighborhood: 'Mission',
    category: 'Bar',
    lat: 37.7701,
    lng: -122.4218,
    address: '199 Valencia St, San Francisco, CA',
  }),
  room({
    id: 'sf-benders',
    name: "Bender's Bar & Grill",
    neighborhood: 'Mission',
    category: 'Bar',
    lat: 37.7599,
    lng: -122.4176,
    address: '806 S Van Ness Ave, San Francisco, CA',
  }),

  room({
    id: 'sf-the-cafe',
    name: 'The Cafe',
    neighborhood: 'Castro',
    category: 'Nightclub',
    lat: 37.7636,
    lng: -122.4328,
    address: '2369 Market St, San Francisco, CA',
  }),
  room({
    id: 'sf-midnight-sun',
    name: 'Midnight Sun',
    neighborhood: 'Castro',
    category: 'Bar',
    lat: 37.7609,
    lng: -122.4336,
    address: '4067 18th St, San Francisco, CA',
  }),
  room({
    id: 'sf-twin-peaks',
    name: 'Twin Peaks Tavern',
    neighborhood: 'Castro',
    category: 'Bar',
    lat: 37.7626,
    lng: -122.4351,
    address: '401 Castro St, San Francisco, CA',
  }),
  room({
    id: 'sf-lookout',
    name: 'Lookout',
    neighborhood: 'Castro',
    category: 'Bar',
    lat: 37.7646,
    lng: -122.4322,
    address: '3600 16th St, San Francisco, CA',
  }),

  room({
    id: 'sf-dna-lounge',
    name: 'DNA Lounge',
    neighborhood: 'SoMa',
    category: 'Nightclub',
    lat: 37.7712,
    lng: -122.4136,
    address: '375 11th St, San Francisco, CA',
    website: 'https://www.dnalounge.com',
  }),
  room({
    id: 'sf-the-endup',
    name: 'The EndUp',
    neighborhood: 'SoMa',
    category: 'Nightclub',
    lat: 37.7779,
    lng: -122.4036,
    address: '401 6th St, San Francisco, CA',
    website: 'https://theendup.com',
  }),
  room({
    id: 'sf-cat-club',
    name: 'Cat Club',
    neighborhood: 'SoMa',
    category: 'Nightclub',
    lat: 37.7755,
    lng: -122.41,
    address: '1190 Folsom St, San Francisco, CA',
  }),
  room({
    id: 'sf-1015-folsom',
    name: '1015 Folsom',
    neighborhood: 'SoMa',
    category: 'Nightclub',
    lat: 37.7781,
    lng: -122.4059,
    address: '1015 Folsom St, San Francisco, CA',
    website: 'https://1015.com',
  }),
  room({
    id: 'sf-great-northern',
    name: 'Great Northern',
    neighborhood: 'SoMa',
    category: 'Music Venue',
    lat: 37.7676,
    lng: -122.4069,
    address: '119 Utah St, San Francisco, CA',
  }),

  room({
    id: 'sf-bimbos',
    name: "Bimbo's 365 Club",
    neighborhood: 'North Beach',
    category: 'Music Venue',
    lat: 37.8036,
    lng: -122.4152,
    address: '1025 Columbus Ave, San Francisco, CA',
    website: 'https://www.bimbos365club.com',
  }),
  room({
    id: 'sf-the-saloon',
    name: 'The Saloon',
    neighborhood: 'North Beach',
    category: 'Bar',
    lat: 37.7988,
    lng: -122.4072,
    address: '1232 Grant Ave, San Francisco, CA',
  }),
  room({
    id: 'sf-vesuvio',
    name: 'Vesuvio Cafe',
    neighborhood: 'North Beach',
    category: 'Bar',
    lat: 37.7976,
    lng: -122.4066,
    address: '255 Columbus Ave, San Francisco, CA',
  }),
  room({
    id: 'sf-tony-niks',
    name: "Tony Nik's Cafe",
    neighborhood: 'North Beach',
    category: 'Bar',
    lat: 37.8002,
    lng: -122.4092,
    address: '1534 Stockton St, San Francisco, CA',
  }),

  room({
    id: 'sf-club-deluxe',
    name: 'Club Deluxe',
    neighborhood: 'Haight-Ashbury',
    category: 'Bar',
    lat: 37.7699,
    lng: -122.4476,
    address: '1511 Haight St, San Francisco, CA',
  }),
  room({
    id: 'sf-milk-bar',
    name: 'Milk Bar',
    neighborhood: 'Haight-Ashbury',
    category: 'Bar',
    lat: 37.7692,
    lng: -122.4522,
    address: '1840 Haight St, San Francisco, CA',
  }),
  room({
    id: 'sf-zam-zam',
    name: 'Zam Zam',
    neighborhood: 'Haight-Ashbury',
    category: 'Bar',
    lat: 37.7696,
    lng: -122.4499,
    address: '1633 Haight St, San Francisco, CA',
  }),
  room({
    id: 'sf-hobsons',
    name: "Hobson's Choice",
    neighborhood: 'Haight-Ashbury',
    category: 'Bar',
    lat: 37.7697,
    lng: -122.4494,
    address: '1601 Haight St, San Francisco, CA',
  }),

  room({
    id: 'sf-balboa-cafe',
    name: 'Balboa Cafe',
    neighborhood: 'Marina',
    category: 'Bar',
    lat: 37.7999,
    lng: -122.4359,
    address: '3199 Fillmore St, San Francisco, CA',
  }),
  room({
    id: 'sf-bus-stop',
    name: 'Bus Stop Saloon',
    neighborhood: 'Marina',
    category: 'Bar',
    lat: 37.7979,
    lng: -122.4306,
    address: '1901 Union St, San Francisco, CA',
  }),
  room({
    id: 'sf-final-final',
    name: 'Final Final',
    neighborhood: 'Marina',
    category: 'Bar',
    lat: 37.8006,
    lng: -122.4462,
    address: '2990 Baker St, San Francisco, CA',
  }),

  room({
    id: 'sf-rickshaw-stop',
    name: 'Rickshaw Stop',
    neighborhood: 'Hayes Valley',
    category: 'Music Venue',
    lat: 37.7762,
    lng: -122.4206,
    address: '155 Fell St, San Francisco, CA',
    website: 'https://www.rickshawstop.com',
  }),
  room({
    id: 'sf-smugglers-cove',
    name: "Smuggler's Cove",
    neighborhood: 'Hayes Valley',
    category: 'Bar',
    lat: 37.7786,
    lng: -122.4229,
    address: '650 Gough St, San Francisco, CA',
  }),
  room({
    id: 'sf-martunis',
    name: "Martuni's",
    neighborhood: 'Hayes Valley',
    category: 'Bar',
    lat: 37.7709,
    lng: -122.4222,
    address: '4 Valencia St, San Francisco, CA',
  }),

  room({
    id: 'sf-gamh',
    name: 'Great American Music Hall',
    neighborhood: 'Tenderloin',
    category: 'Music Venue',
    lat: 37.7849,
    lng: -122.4189,
    address: "859 O'Farrell St, San Francisco, CA",
    website: 'https://gamh.com',
  }),
  room({
    id: 'sf-edinburgh-castle',
    name: 'Edinburgh Castle',
    neighborhood: 'Tenderloin',
    category: 'Bar',
    lat: 37.7862,
    lng: -122.4156,
    address: '950 Geary St, San Francisco, CA',
  }),
  room({
    id: 'sf-aunt-charlies',
    name: "Aunt Charlie's Lounge",
    neighborhood: 'Tenderloin',
    category: 'Bar',
    lat: 37.7832,
    lng: -122.4116,
    address: '133 Turk St, San Francisco, CA',
  }),
]

export function assertSanFranciscoLaunchInventory(
  venues: SanFranciscoLaunchVenue[] = SAN_FRANCISCO_LAUNCH_VENUES,
) {
  const count = venues.length
  if (count < SAN_FRANCISCO_LAUNCH_MIN_VENUES || count > SAN_FRANCISCO_LAUNCH_MAX_VENUES) {
    throw new Error(
      `San Francisco launch inventory must contain ${SAN_FRANCISCO_LAUNCH_MIN_VENUES}-${SAN_FRANCISCO_LAUNCH_MAX_VENUES} venues, got ${count}`,
    )
  }
  const missing = SAN_FRANCISCO_LAUNCH_NEIGHBORHOODS.filter(
    (neighborhood) => !venues.some((venue) => venue.neighborhood === neighborhood),
  )
  if (missing.length > 0) {
    throw new Error(`San Francisco launch inventory is missing neighborhoods: ${missing.join(', ')}`)
  }
  const bad = venues.filter((venue) => (
    !venue.seeded
    || venue.inventorySource !== SAN_FRANCISCO_LAUNCH_INVENTORY_SOURCE
    || venue.pulseScore !== 0
    || venue.imageUrl
    || venue.city !== 'San Francisco'
    || venue.state !== 'CA'
  ))
  if (bad.length > 0) {
    throw new Error('Every San Francisco launch venue must be a curated seed with pulseScore 0 and no photo')
  }
}

export function getSanFranciscoLaunchVenues(): SanFranciscoLaunchVenue[] {
  assertSanFranciscoLaunchInventory()
  return SAN_FRANCISCO_LAUNCH_VENUES
}
