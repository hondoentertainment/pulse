import type { Venue } from './types'

export const SEATTLE_LAUNCH_NEIGHBORHOODS = [
  'Capitol Hill',
  'Belltown',
  'Fremont',
  'Ballard',
  'Downtown',
] as const

export type SeattleLaunchNeighborhood = (typeof SEATTLE_LAUNCH_NEIGHBORHOODS)[number]

export const SEATTLE_LAUNCH_INVENTORY_SOURCE = 'curated-seed' as const
export const SEATTLE_LAUNCH_MIN_VENUES = 25
export const SEATTLE_LAUNCH_MAX_VENUES = 40

export interface SeattleLaunchVenue extends Venue {
  city: 'Seattle'
  state: 'WA'
  neighborhood: SeattleLaunchNeighborhood
  seeded: true
  inventorySource: typeof SEATTLE_LAUNCH_INVENTORY_SOURCE
}

/**
 * Curated Seattle launch inventory (P0-4).
 *
 * These are real, publicly listed venues used as a seed catalog only.
 * `pulseScore` stays 0 so we never present invented live user reports.
 * Live energy comes from real pulses / live intel after launch.
 */
export const SEATTLE_LAUNCH_VENUES: SeattleLaunchVenue[] = [
  // Capitol Hill
  {
    id: 'venue-1',
    name: 'Neumos',
    location: { lat: 47.6145, lng: -122.3205, address: '925 E Pike St, Seattle, WA' },
    city: 'Seattle',
    state: 'WA',
    neighborhood: 'Capitol Hill',
    category: 'Music Venue',
    pulseScore: 0,
    seeded: true,
    inventorySource: SEATTLE_LAUNCH_INVENTORY_SOURCE,
    hours: {
      wednesday: '8:00 PM - 2:00 AM',
      thursday: '8:00 PM - 2:00 AM',
      friday: '8:00 PM - 2:00 AM',
      saturday: '8:00 PM - 2:00 AM',
    },
    phone: '(206) 709-9442',
    website: 'https://neumos.com',
  },
  {
    id: 'venue-12',
    name: 'Barboza',
    location: { lat: 47.6145, lng: -122.3207, address: '925 E Pike St, Seattle, WA' },
    city: 'Seattle',
    state: 'WA',
    neighborhood: 'Capitol Hill',
    category: 'Lounge',
    pulseScore: 0,
    seeded: true,
    inventorySource: SEATTLE_LAUNCH_INVENTORY_SOURCE,
  },
  {
    id: 'venue-3',
    name: 'Q Nightclub',
    location: { lat: 47.6138, lng: -122.3198, address: '1426 Broadway, Seattle, WA' },
    city: 'Seattle',
    state: 'WA',
    neighborhood: 'Capitol Hill',
    category: 'Nightclub',
    pulseScore: 0,
    seeded: true,
    inventorySource: SEATTLE_LAUNCH_INVENTORY_SOURCE,
    hours: {
      thursday: '9:00 PM - 3:00 AM',
      friday: '9:00 PM - 4:00 AM',
      saturday: '9:00 PM - 4:00 AM',
    },
    phone: '(206) 200-7074',
    website: 'https://qnightclub.com',
  },
  {
    id: 'venue-13',
    name: 'The Unicorn',
    location: { lat: 47.6142, lng: -122.3196, address: '1118 E Pike St, Seattle, WA' },
    city: 'Seattle',
    state: 'WA',
    neighborhood: 'Capitol Hill',
    category: 'Bar',
    pulseScore: 0,
    seeded: true,
    inventorySource: SEATTLE_LAUNCH_INVENTORY_SOURCE,
    hours: {
      monday: '4:00 PM - 2:00 AM',
      tuesday: '4:00 PM - 2:00 AM',
      wednesday: '4:00 PM - 2:00 AM',
      thursday: '4:00 PM - 2:00 AM',
      friday: '4:00 PM - 2:00 AM',
      saturday: '12:00 PM - 2:00 AM',
      sunday: '12:00 PM - 2:00 AM',
    },
    phone: '(206) 325-6492',
    website: 'https://unicornseattle.com',
  },
  {
    id: 'venue-19',
    name: 'Chop Suey',
    location: { lat: 47.6145, lng: -122.3194, address: '1325 E Madison St, Seattle, WA' },
    city: 'Seattle',
    state: 'WA',
    neighborhood: 'Capitol Hill',
    category: 'Music Venue',
    pulseScore: 0,
    seeded: true,
    inventorySource: SEATTLE_LAUNCH_INVENTORY_SOURCE,
  },
  {
    id: 'venue-22',
    name: 'The Comet Tavern',
    location: { lat: 47.6142, lng: -122.3181, address: '922 E Pike St, Seattle, WA' },
    city: 'Seattle',
    state: 'WA',
    neighborhood: 'Capitol Hill',
    category: 'Bar',
    pulseScore: 0,
    seeded: true,
    inventorySource: SEATTLE_LAUNCH_INVENTORY_SOURCE,
  },
  {
    id: 'sea-ch-lindas',
    name: "Linda's Tavern",
    location: { lat: 47.6140, lng: -122.3209, address: '707 E Pine St, Seattle, WA' },
    city: 'Seattle',
    state: 'WA',
    neighborhood: 'Capitol Hill',
    category: 'Bar',
    pulseScore: 0,
    seeded: true,
    inventorySource: SEATTLE_LAUNCH_INVENTORY_SOURCE,
  },
  {
    id: 'sea-ch-neighbours',
    name: 'Neighbours',
    location: { lat: 47.6141, lng: -122.3202, address: '1509 Broadway, Seattle, WA' },
    city: 'Seattle',
    state: 'WA',
    neighborhood: 'Capitol Hill',
    category: 'Nightclub',
    pulseScore: 0,
    seeded: true,
    inventorySource: SEATTLE_LAUNCH_INVENTORY_SOURCE,
  },

  // Belltown
  {
    id: 'venue-2',
    name: 'The Crocodile',
    location: { lat: 47.6134, lng: -122.3443, address: '2505 1st Ave, Seattle, WA' },
    city: 'Seattle',
    state: 'WA',
    neighborhood: 'Belltown',
    category: 'Music Venue',
    pulseScore: 0,
    seeded: true,
    inventorySource: SEATTLE_LAUNCH_INVENTORY_SOURCE,
    hours: {
      tuesday: '6:00 PM - 2:00 AM',
      wednesday: '6:00 PM - 2:00 AM',
      thursday: '6:00 PM - 2:00 AM',
      friday: '6:00 PM - 2:00 AM',
      saturday: '6:00 PM - 2:00 AM',
    },
    phone: '(206) 441-5611',
    website: 'https://thecrocodile.com',
  },
  {
    id: 'venue-18',
    name: 'The 5 Point Cafe',
    location: { lat: 47.6182, lng: -122.3476, address: '415 Cedar St, Seattle, WA' },
    city: 'Seattle',
    state: 'WA',
    neighborhood: 'Belltown',
    category: 'Bar',
    pulseScore: 0,
    seeded: true,
    inventorySource: SEATTLE_LAUNCH_INVENTORY_SOURCE,
  },
  {
    id: 'sea-bt-rendezvous',
    name: 'Rendezvous',
    location: { lat: 47.6148, lng: -122.3456, address: '2322 2nd Ave, Seattle, WA' },
    city: 'Seattle',
    state: 'WA',
    neighborhood: 'Belltown',
    category: 'Bar',
    pulseScore: 0,
    seeded: true,
    inventorySource: SEATTLE_LAUNCH_INVENTORY_SOURCE,
  },
  {
    id: 'sea-bt-shortys',
    name: "Shorty's",
    location: { lat: 47.6149, lng: -122.3452, address: '2222 2nd Ave, Seattle, WA' },
    city: 'Seattle',
    state: 'WA',
    neighborhood: 'Belltown',
    category: 'Bar',
    pulseScore: 0,
    seeded: true,
    inventorySource: SEATTLE_LAUNCH_INVENTORY_SOURCE,
  },
  {
    id: 'sea-bt-robroy',
    name: 'Rob Roy',
    location: { lat: 47.6156, lng: -122.3471, address: '2332 2nd Ave, Seattle, WA' },
    city: 'Seattle',
    state: 'WA',
    neighborhood: 'Belltown',
    category: 'Bar',
    pulseScore: 0,
    seeded: true,
    inventorySource: SEATTLE_LAUNCH_INVENTORY_SOURCE,
  },
  {
    id: 'sea-bt-whisky',
    name: 'The Whisky Bar',
    location: { lat: 47.6131, lng: -122.3458, address: '2122 2nd Ave, Seattle, WA' },
    city: 'Seattle',
    state: 'WA',
    neighborhood: 'Belltown',
    category: 'Bar',
    pulseScore: 0,
    seeded: true,
    inventorySource: SEATTLE_LAUNCH_INVENTORY_SOURCE,
  },

  // Fremont
  {
    id: 'venue-16',
    name: 'Nectar Lounge',
    location: { lat: 47.6516, lng: -122.3542, address: '412 N 36th St, Seattle, WA' },
    city: 'Seattle',
    state: 'WA',
    neighborhood: 'Fremont',
    category: 'Music Venue',
    pulseScore: 0,
    seeded: true,
    inventorySource: SEATTLE_LAUNCH_INVENTORY_SOURCE,
  },
  {
    id: 'venue-34',
    name: 'Fremont Brewing',
    location: { lat: 47.6491, lng: -122.3446, address: '1050 N 34th St, Seattle, WA' },
    city: 'Seattle',
    state: 'WA',
    neighborhood: 'Fremont',
    category: 'Brewery',
    pulseScore: 0,
    seeded: true,
    inventorySource: SEATTLE_LAUNCH_INVENTORY_SOURCE,
    hours: {
      monday: '11:00 AM - 9:00 PM',
      tuesday: '11:00 AM - 9:00 PM',
      wednesday: '11:00 AM - 9:00 PM',
      thursday: '11:00 AM - 9:00 PM',
      friday: '11:00 AM - 10:00 PM',
      saturday: '11:00 AM - 10:00 PM',
      sunday: '11:00 AM - 9:00 PM',
    },
    phone: '(206) 420-2407',
    website: 'https://fremontbrewing.com',
  },
  {
    id: 'venue-31',
    name: 'The George & Dragon Pub',
    location: { lat: 47.6514, lng: -122.3558, address: '206 N 36th St, Seattle, WA' },
    city: 'Seattle',
    state: 'WA',
    neighborhood: 'Fremont',
    category: 'Bar',
    pulseScore: 0,
    seeded: true,
    inventorySource: SEATTLE_LAUNCH_INVENTORY_SOURCE,
  },
  {
    id: 'venue-32',
    name: "Norm's Eatery & Ale House",
    location: { lat: 47.6515, lng: -122.3518, address: '460 N 36th St, Seattle, WA' },
    city: 'Seattle',
    state: 'WA',
    neighborhood: 'Fremont',
    category: 'Bar',
    pulseScore: 0,
    seeded: true,
    inventorySource: SEATTLE_LAUNCH_INVENTORY_SOURCE,
  },
  {
    id: 'venue-36',
    name: 'Fremont Abbey Arts Center',
    location: { lat: 47.6612, lng: -122.3499, address: '4272 Fremont Ave N, Seattle, WA' },
    city: 'Seattle',
    state: 'WA',
    neighborhood: 'Fremont',
    category: 'Music Venue',
    pulseScore: 0,
    seeded: true,
    inventorySource: SEATTLE_LAUNCH_INVENTORY_SOURCE,
  },
  {
    id: 'venue-88',
    name: 'Westward',
    location: { lat: 47.6478, lng: -122.3476, address: '2501 N Northlake Way, Seattle, WA' },
    city: 'Seattle',
    state: 'WA',
    neighborhood: 'Fremont',
    category: 'Restaurant',
    pulseScore: 0,
    seeded: true,
    inventorySource: SEATTLE_LAUNCH_INVENTORY_SOURCE,
  },

  // Ballard
  {
    id: 'venue-10',
    name: 'Tractor Tavern',
    location: { lat: 47.6658, lng: -122.3828, address: '5213 Ballard Ave NW, Seattle, WA' },
    city: 'Seattle',
    state: 'WA',
    neighborhood: 'Ballard',
    category: 'Music Venue',
    pulseScore: 0,
    seeded: true,
    inventorySource: SEATTLE_LAUNCH_INVENTORY_SOURCE,
  },
  {
    id: 'venue-11',
    name: 'The Sunset Tavern',
    location: { lat: 47.6684, lng: -122.3853, address: '5433 Ballard Ave NW, Seattle, WA' },
    city: 'Seattle',
    state: 'WA',
    neighborhood: 'Ballard',
    category: 'Bar',
    pulseScore: 0,
    seeded: true,
    inventorySource: SEATTLE_LAUNCH_INVENTORY_SOURCE,
  },
  {
    id: 'sea-ba-conor',
    name: 'Conor Byrne Pub',
    location: { lat: 47.6667, lng: -122.3836, address: '5140 Ballard Ave NW, Seattle, WA' },
    city: 'Seattle',
    state: 'WA',
    neighborhood: 'Ballard',
    category: 'Bar',
    pulseScore: 0,
    seeded: true,
    inventorySource: SEATTLE_LAUNCH_INVENTORY_SOURCE,
  },
  {
    id: 'sea-ba-hatties',
    name: "Hattie's Hat",
    location: { lat: 47.6681, lng: -122.3847, address: '5231 Ballard Ave NW, Seattle, WA' },
    city: 'Seattle',
    state: 'WA',
    neighborhood: 'Ballard',
    category: 'Bar',
    pulseScore: 0,
    seeded: true,
    inventorySource: SEATTLE_LAUNCH_INVENTORY_SOURCE,
  },
  {
    id: 'sea-ba-noblefir',
    name: 'The Noble Fir',
    location: { lat: 47.6649, lng: -122.3814, address: '5316 Ballard Ave NW, Seattle, WA' },
    city: 'Seattle',
    state: 'WA',
    neighborhood: 'Ballard',
    category: 'Bar',
    pulseScore: 0,
    seeded: true,
    inventorySource: SEATTLE_LAUNCH_INVENTORY_SOURCE,
  },
  {
    id: 'sea-ba-kings',
    name: "King's Hardware",
    location: { lat: 47.6686, lng: -122.3872, address: '5225 Ballard Ave NW, Seattle, WA' },
    city: 'Seattle',
    state: 'WA',
    neighborhood: 'Ballard',
    category: 'Bar',
    pulseScore: 0,
    seeded: true,
    inventorySource: SEATTLE_LAUNCH_INVENTORY_SOURCE,
  },

  // Downtown
  {
    id: 'venue-6',
    name: 'The Showbox',
    location: { lat: 47.6084, lng: -122.3395, address: '1426 1st Ave, Seattle, WA' },
    city: 'Seattle',
    state: 'WA',
    neighborhood: 'Downtown',
    category: 'Music Venue',
    pulseScore: 0,
    seeded: true,
    inventorySource: SEATTLE_LAUNCH_INVENTORY_SOURCE,
    hours: {
      wednesday: '7:00 PM - 2:00 AM',
      thursday: '7:00 PM - 2:00 AM',
      friday: '7:00 PM - 2:00 AM',
      saturday: '7:00 PM - 2:00 AM',
      sunday: '7:00 PM - 2:00 AM',
    },
    phone: '(206) 628-3151',
    website: 'https://showboxpresents.com',
  },
  {
    id: 'venue-7',
    name: 'The Triple Door',
    location: { lat: 47.6082, lng: -122.3368, address: '216 Union St, Seattle, WA' },
    city: 'Seattle',
    state: 'WA',
    neighborhood: 'Downtown',
    category: 'Music Venue',
    pulseScore: 0,
    seeded: true,
    inventorySource: SEATTLE_LAUNCH_INVENTORY_SOURCE,
  },
  {
    id: 'venue-29',
    name: 'The Paramount Theatre',
    location: { lat: 47.6133, lng: -122.3314, address: '911 Pine St, Seattle, WA' },
    city: 'Seattle',
    state: 'WA',
    neighborhood: 'Downtown',
    category: 'Music Venue',
    pulseScore: 0,
    seeded: true,
    inventorySource: SEATTLE_LAUNCH_INVENTORY_SOURCE,
  },
  {
    id: 'venue-30',
    name: 'The Moore Theatre',
    location: { lat: 47.6118, lng: -122.3415, address: '1932 2nd Ave, Seattle, WA' },
    city: 'Seattle',
    state: 'WA',
    neighborhood: 'Downtown',
    category: 'Music Venue',
    pulseScore: 0,
    seeded: true,
    inventorySource: SEATTLE_LAUNCH_INVENTORY_SOURCE,
  },
  {
    id: 'venue-21',
    name: "Dimitriou's Jazz Alley",
    location: { lat: 47.6164, lng: -122.3378, address: '2033 6th Ave, Seattle, WA' },
    city: 'Seattle',
    state: 'WA',
    neighborhood: 'Downtown',
    category: 'Music Venue',
    pulseScore: 0,
    seeded: true,
    inventorySource: SEATTLE_LAUNCH_INVENTORY_SOURCE,
  },
  {
    id: 'venue-8',
    name: 'Foundation Nightclub',
    location: { lat: 47.6018, lng: -122.3341, address: '2218 Western Ave, Seattle, WA' },
    city: 'Seattle',
    state: 'WA',
    neighborhood: 'Downtown',
    category: 'Nightclub',
    pulseScore: 0,
    seeded: true,
    inventorySource: SEATTLE_LAUNCH_INVENTORY_SOURCE,
  },
  {
    id: 'venue-25',
    name: 'The Central Saloon',
    location: { lat: 47.6005, lng: -122.3342, address: '207 1st Ave S, Seattle, WA' },
    city: 'Seattle',
    state: 'WA',
    neighborhood: 'Downtown',
    category: 'Bar',
    pulseScore: 0,
    seeded: true,
    inventorySource: SEATTLE_LAUNCH_INVENTORY_SOURCE,
  },
]

export function assertSeattleLaunchInventory(venues: SeattleLaunchVenue[] = SEATTLE_LAUNCH_VENUES) {
  const count = venues.length
  if (count < SEATTLE_LAUNCH_MIN_VENUES || count > SEATTLE_LAUNCH_MAX_VENUES) {
    throw new Error(
      `Seattle launch inventory must contain ${SEATTLE_LAUNCH_MIN_VENUES}-${SEATTLE_LAUNCH_MAX_VENUES} venues, got ${count}`,
    )
  }

  const missingNeighborhoods = SEATTLE_LAUNCH_NEIGHBORHOODS.filter(
    (neighborhood) => !venues.some((venue) => venue.neighborhood === neighborhood),
  )
  if (missingNeighborhoods.length > 0) {
    throw new Error(`Seattle launch inventory is missing neighborhoods: ${missingNeighborhoods.join(', ')}`)
  }

  const unseeded = venues.filter((venue) => !venue.seeded || venue.inventorySource !== SEATTLE_LAUNCH_INVENTORY_SOURCE)
  if (unseeded.length > 0) {
    throw new Error('Every Seattle launch venue must be marked curated-seed')
  }
}

export function getSeattleLaunchVenues(): SeattleLaunchVenue[] {
  assertSeattleLaunchInventory()
  return SEATTLE_LAUNCH_VENUES
}

export function getSeattleLaunchNeighborhoodCoverage(
  venues: SeattleLaunchVenue[] = SEATTLE_LAUNCH_VENUES,
): Record<SeattleLaunchNeighborhood, number> {
  return SEATTLE_LAUNCH_NEIGHBORHOODS.reduce((acc, neighborhood) => {
    acc[neighborhood] = venues.filter((venue) => venue.neighborhood === neighborhood).length
    return acc
  }, {} as Record<SeattleLaunchNeighborhood, number>)
}
