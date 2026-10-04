import type { Venue } from './types'

export const PORTLAND_LAUNCH_NEIGHBORHOODS = [
  'Pearl District',
  'Old Town',
  'Mississippi',
  'Alberta',
  'Hawthorne',
  'Buckman',
  'Kerns',
  'Eliot',
  'Brooklyn',
] as const

export type PortlandLaunchNeighborhood = (typeof PORTLAND_LAUNCH_NEIGHBORHOODS)[number]

export const PORTLAND_LAUNCH_INVENTORY_SOURCE = 'curated-seed' as const
export const PORTLAND_LAUNCH_MIN_VENUES = 25
export const PORTLAND_LAUNCH_MAX_VENUES = 40

export interface PortlandLaunchVenue extends Venue {
  city: 'Portland'
  state: 'OR'
  neighborhood: PortlandLaunchNeighborhood
  seeded: true
  inventorySource: typeof PORTLAND_LAUNCH_INVENTORY_SOURCE
}

function room(
  input: Pick<PortlandLaunchVenue, 'id' | 'name' | 'neighborhood' | 'category'> & {
    lat: number
    lng: number
    address: string
    website?: string
  },
): PortlandLaunchVenue {
  return {
    id: input.id,
    name: input.name,
    location: { lat: input.lat, lng: input.lng, address: input.address },
    city: 'Portland',
    state: 'OR',
    neighborhood: input.neighborhood,
    category: input.category,
    pulseScore: 0,
    seeded: true,
    inventorySource: PORTLAND_LAUNCH_INVENTORY_SOURCE,
    website: input.website,
  }
}

/**
 * Curated Portland launch inventory.
 * Real, publicly listed rooms. pulseScore stays 0. No scraped photos.
 * A larger Portland catalog, if one is added later, stays behind idle.
 */
export const PORTLAND_LAUNCH_VENUES: PortlandLaunchVenue[] = [
  room({
    id: 'pdx-crystal-ballroom',
    name: 'Crystal Ballroom',
    neighborhood: 'Pearl District',
    category: 'Music Venue',
    lat: 45.5229,
    lng: -122.6842,
    address: '1332 W Burnside St, Portland, OR',
    website: 'https://www.crystalballroompdx.com',
  }),
  room({
    id: 'pdx-teardrop',
    name: 'Teardrop Cocktail Lounge',
    neighborhood: 'Pearl District',
    category: 'Lounge',
    lat: 45.5254,
    lng: -122.6812,
    address: '1015 NW Everett St, Portland, OR',
  }),
  room({
    id: 'pdx-pope-house',
    name: 'Pope House Bourbon Lounge',
    neighborhood: 'Pearl District',
    category: 'Lounge',
    lat: 45.5262,
    lng: -122.6926,
    address: '2075 NW Glisan St, Portland, OR',
  }),
  room({
    id: 'pdx-voicebox',
    name: 'Voicebox Karaoke',
    neighborhood: 'Pearl District',
    category: 'Bar',
    lat: 45.5271,
    lng: -122.6935,
    address: '2112 NW Hoyt St, Portland, OR',
  }),

  room({
    id: 'pdx-dantes',
    name: "Dante's",
    neighborhood: 'Old Town',
    category: 'Nightclub',
    lat: 45.523,
    lng: -122.6734,
    address: '350 W Burnside St, Portland, OR',
    website: 'https://danteslive.com',
  }),
  room({
    id: 'pdx-roseland',
    name: 'Roseland Theater',
    neighborhood: 'Old Town',
    category: 'Music Venue',
    lat: 45.5236,
    lng: -122.676,
    address: '8 NW 6th Ave, Portland, OR',
    website: 'https://www.roselandpdx.com',
  }),
  room({
    id: 'pdx-star-theater',
    name: 'Star Theater',
    neighborhood: 'Old Town',
    category: 'Music Venue',
    lat: 45.5237,
    lng: -122.6756,
    address: '13 NW 6th Ave, Portland, OR',
  }),
  room({
    id: 'pdx-ground-kontrol',
    name: 'Ground Kontrol Classic Arcade',
    neighborhood: 'Old Town',
    category: 'Bar',
    lat: 45.5239,
    lng: -122.6746,
    address: '511 NW Couch St, Portland, OR',
    website: 'https://www.groundkontrol.com',
  }),
  room({
    id: 'pdx-shanghai-tunnel',
    name: 'Shanghai Tunnel',
    neighborhood: 'Old Town',
    category: 'Bar',
    lat: 45.5223,
    lng: -122.6729,
    address: '211 SW Ankeny St, Portland, OR',
  }),
  room({
    id: 'pdx-cc-slaughters',
    name: 'C.C. Slaughters',
    neighborhood: 'Old Town',
    category: 'Nightclub',
    lat: 45.5246,
    lng: -122.6732,
    address: '219 NW Davis St, Portland, OR',
  }),

  room({
    id: 'pdx-mississippi-studios',
    name: 'Mississippi Studios',
    neighborhood: 'Mississippi',
    category: 'Music Venue',
    lat: 45.5506,
    lng: -122.6756,
    address: '3939 N Mississippi Ave, Portland, OR',
    website: 'https://www.mississippistudios.com',
  }),
  room({
    id: 'pdx-mississippi-pizza',
    name: 'Mississippi Pizza Pub',
    neighborhood: 'Mississippi',
    category: 'Bar',
    lat: 45.5484,
    lng: -122.6755,
    address: '3552 N Mississippi Ave, Portland, OR',
  }),
  room({
    id: 'pdx-crow-bar',
    name: 'Crow Bar',
    neighborhood: 'Mississippi',
    category: 'Bar',
    lat: 45.5509,
    lng: -122.6757,
    address: '3954 N Mississippi Ave, Portland, OR',
  }),
  room({
    id: 'pdx-liberty-glass',
    name: 'Liberty Glass',
    neighborhood: 'Mississippi',
    category: 'Bar',
    lat: 45.5472,
    lng: -122.6759,
    address: '938 N Cook St, Portland, OR',
  }),

  room({
    id: 'pdx-bye-and-bye',
    name: 'The Bye and Bye',
    neighborhood: 'Alberta',
    category: 'Bar',
    lat: 45.5592,
    lng: -122.6553,
    address: '1011 NE Alberta St, Portland, OR',
  }),
  room({
    id: 'pdx-radio-room',
    name: 'Radio Room',
    neighborhood: 'Alberta',
    category: 'Bar',
    lat: 45.5591,
    lng: -122.6543,
    address: '1101 NE Alberta St, Portland, OR',
  }),
  room({
    id: 'pdx-expatriate',
    name: 'Expatriate',
    neighborhood: 'Alberta',
    category: 'Bar',
    lat: 45.5629,
    lng: -122.6356,
    address: '5424 NE 30th Ave, Portland, OR',
  }),
  room({
    id: 'pdx-victoria',
    name: 'Victoria Bar',
    neighborhood: 'Alberta',
    category: 'Bar',
    lat: 45.5586,
    lng: -122.6752,
    address: '4835 N Albina Ave, Portland, OR',
  }),

  room({
    id: 'pdx-space-room',
    name: 'Space Room Lounge',
    neighborhood: 'Hawthorne',
    category: 'Bar',
    lat: 45.5122,
    lng: -122.6133,
    address: '4800 SE Hawthorne Blvd, Portland, OR',
  }),
  room({
    id: 'pdx-bar-of-the-gods',
    name: 'Bar of the Gods',
    neighborhood: 'Hawthorne',
    category: 'Bar',
    lat: 45.5121,
    lng: -122.6132,
    address: '4801 SE Hawthorne Blvd, Portland, OR',
  }),
  room({
    id: 'pdx-bagdad',
    name: 'Bagdad Theater & Pub',
    neighborhood: 'Hawthorne',
    category: 'Bar',
    lat: 45.5123,
    lng: -122.6266,
    address: '3702 SE Hawthorne Blvd, Portland, OR',
  }),
  room({
    id: 'pdx-gold-dust',
    name: 'Gold Dust Meridian',
    neighborhood: 'Hawthorne',
    category: 'Bar',
    lat: 45.5124,
    lng: -122.6319,
    address: '3267 SE Hawthorne Blvd, Portland, OR',
  }),

  room({
    id: 'pdx-holocene',
    name: 'Holocene',
    neighborhood: 'Buckman',
    category: 'Nightclub',
    lat: 45.5174,
    lng: -122.6554,
    address: '1001 SE Morrison St, Portland, OR',
    website: 'https://www.holocene.org',
  }),
  room({
    id: 'pdx-revolution-hall',
    name: 'Revolution Hall',
    neighborhood: 'Buckman',
    category: 'Music Venue',
    lat: 45.5196,
    lng: -122.6519,
    address: '1300 SE Stark St, Portland, OR',
    website: 'https://www.revolutionhall.com',
  }),
  room({
    id: 'pdx-white-owl',
    name: 'White Owl Social Club',
    neighborhood: 'Buckman',
    category: 'Bar',
    lat: 45.5136,
    lng: -122.6577,
    address: '1305 SE 8th Ave, Portland, OR',
  }),
  room({
    id: 'pdx-crush',
    name: 'Crush Bar',
    neighborhood: 'Buckman',
    category: 'Bar',
    lat: 45.5175,
    lng: -122.6514,
    address: '1400 SE Morrison St, Portland, OR',
  }),
  room({
    id: 'pdx-century',
    name: 'Century Bar',
    neighborhood: 'Buckman',
    category: 'Bar',
    lat: 45.5226,
    lng: -122.6569,
    address: '930 SE Sandy Blvd, Portland, OR',
  }),

  room({
    id: 'pdx-rontoms',
    name: 'Rontoms',
    neighborhood: 'Kerns',
    category: 'Bar',
    lat: 45.5228,
    lng: -122.6589,
    address: '600 E Burnside St, Portland, OR',
  }),
  room({
    id: 'pdx-swift',
    name: 'Swift Lounge',
    neighborhood: 'Kerns',
    category: 'Bar',
    lat: 45.5356,
    lng: -122.6619,
    address: '1932 NE Martin Luther King Jr Blvd, Portland, OR',
  }),
  room({
    id: 'pdx-spirit-of-77',
    name: 'Spirit of 77',
    neighborhood: 'Kerns',
    category: 'Bar',
    lat: 45.5269,
    lng: -122.6616,
    address: '500 NE Martin Luther King Jr Blvd, Portland, OR',
  }),

  room({
    id: 'pdx-wonder-ballroom',
    name: 'Wonder Ballroom',
    neighborhood: 'Eliot',
    category: 'Music Venue',
    lat: 45.5412,
    lng: -122.6636,
    address: '128 NE Russell St, Portland, OR',
    website: 'https://www.wonderballroom.com',
  }),
  room({
    id: 'pdx-aladdin',
    name: 'Aladdin Theater',
    neighborhood: 'Brooklyn',
    category: 'Music Venue',
    lat: 45.5011,
    lng: -122.6546,
    address: '3017 SE Milwaukie Ave, Portland, OR',
    website: 'https://www.aladdin-theater.com',
  }),
]

export function assertPortlandLaunchInventory(venues: PortlandLaunchVenue[] = PORTLAND_LAUNCH_VENUES) {
  const count = venues.length
  if (count < PORTLAND_LAUNCH_MIN_VENUES || count > PORTLAND_LAUNCH_MAX_VENUES) {
    throw new Error(
      `Portland launch inventory must contain ${PORTLAND_LAUNCH_MIN_VENUES}-${PORTLAND_LAUNCH_MAX_VENUES} venues, got ${count}`,
    )
  }
  const missing = PORTLAND_LAUNCH_NEIGHBORHOODS.filter(
    (neighborhood) => !venues.some((venue) => venue.neighborhood === neighborhood),
  )
  if (missing.length > 0) {
    throw new Error(`Portland launch inventory is missing neighborhoods: ${missing.join(', ')}`)
  }
  const bad = venues.filter((venue) => (
    !venue.seeded
    || venue.inventorySource !== PORTLAND_LAUNCH_INVENTORY_SOURCE
    || venue.pulseScore !== 0
    || venue.imageUrl
    || venue.city !== 'Portland'
    || venue.state !== 'OR'
  ))
  if (bad.length > 0) {
    throw new Error('Every Portland launch venue must be a curated seed with pulseScore 0 and no photo')
  }
}

export function getPortlandLaunchVenues(): PortlandLaunchVenue[] {
  assertPortlandLaunchInventory()
  return PORTLAND_LAUNCH_VENUES
}
