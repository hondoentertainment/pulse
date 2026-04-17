import { Venue } from './types'
import { US_EXPANSION_VENUES } from './us-venues'
import { applyVenueIntegrationSeeds } from './venue-integration-seeds'

const SEATTLE_VENUES: Venue[] = [
  {
    id: 'venue-1',
    name: 'Neumos',
    location: {
      lat: 47.6145,
      lng: -122.3205,
      address: '925 E Pike St, Seattle, WA'
    },
    pulseScore: 85,
    category: 'Music Venue',
    hours: {
      monday: 'Closed',
      tuesday: 'Closed',
      wednesday: '8:00 PM - 2:00 AM',
      thursday: '8:00 PM - 2:00 AM',
      friday: '8:00 PM - 2:00 AM',
      saturday: '8:00 PM - 2:00 AM',
      sunday: 'Closed'
    },
    phone: '(206) 709-9442',
    website: 'https://neumos.com'
  },
  {
    id: 'venue-2',
    name: 'The Crocodile',
    location: {
      lat: 47.6162,
      lng: -122.3488,
      address: '2200 2nd Ave, Seattle, WA'
    },
    pulseScore: 72,
    category: 'Music Venue',
    hours: {
      monday: 'Closed',
      tuesday: '6:00 PM - 2:00 AM',
      wednesday: '6:00 PM - 2:00 AM',
      thursday: '6:00 PM - 2:00 AM',
      friday: '6:00 PM - 2:00 AM',
      saturday: '6:00 PM - 2:00 AM',
      sunday: 'Closed'
    },
    phone: '(206) 441-4618',
    website: 'https://thecrocodile.com'
  },
  {
    id: 'venue-3',
    name: 'Q Nightclub',
    location: {
      lat: 47.6138,
      lng: -122.3198,
      address: '1426 Broadway, Seattle, WA'
    },
    pulseScore: 92,
    category: 'Nightclub',
    hours: {
      monday: 'Closed',
      tuesday: 'Closed',
      wednesday: 'Closed',
      thursday: '9:00 PM - 3:00 AM',
      friday: '9:00 PM - 4:00 AM',
      saturday: '9:00 PM - 4:00 AM',
      sunday: 'Closed'
    },
    phone: '(206) 200-7074',
    website: 'https://qnightclub.com'
  },
  {
    id: 'venue-4',
    name: 'Kremwerk',
    location: {
      lat: 47.6154,
      lng: -122.3213,
      address: '1809 Minor Ave, Seattle, WA'
    },
    pulseScore: 68,
    category: 'Nightclub'
  },
  {
    id: 'venue-5',
    name: 'Cafe Racer',
    location: {
      lat: 47.6698,
      lng: -122.3214,
      address: '5828 Roosevelt Way NE, Seattle, WA'
    },
    pulseScore: 0,
    category: 'Café',
    hours: {
      monday: '7:00 AM - 10:00 PM',
      tuesday: '7:00 AM - 10:00 PM',
      wednesday: '7:00 AM - 10:00 PM',
      thursday: '7:00 AM - 10:00 PM',
      friday: '7:00 AM - 11:00 PM',
      saturday: '8:00 AM - 11:00 PM',
      sunday: '8:00 AM - 10:00 PM'
    },
    phone: '(206) 523-5282',
    website: 'https://caferacerseattle.com'
  },
  {
    id: 'venue-6',
    name: 'The Showbox',
    location: {
      lat: 47.6088,
      lng: -122.3371,
      address: '1426 1st Ave, Seattle, WA'
    },
    pulseScore: 81,
    category: 'Music Venue',
    hours: {
      monday: 'Closed',
      tuesday: 'Closed',
      wednesday: '7:00 PM - 2:00 AM',
      thursday: '7:00 PM - 2:00 AM',
      friday: '7:00 PM - 2:00 AM',
      saturday: '7:00 PM - 2:00 AM',
      sunday: '7:00 PM - 2:00 AM'
    },
    phone: '(206) 628-3151',
    website: 'https://showboxpresents.com'
  },
  {
    id: 'venue-7',
    name: 'The Triple Door',
    location: {
      lat: 47.6064,
      lng: -122.3334,
      address: '216 Union St, Seattle, WA'
    },
    pulseScore: 58,
    category: 'Music Venue'
  },
  {
    id: 'venue-8',
    name: 'Foundation Nightclub',
    location: {
      lat: 47.5981,
      lng: -122.3293,
      address: '2218 Western Ave, Seattle, WA'
    },
    pulseScore: 88,
    category: 'Nightclub',
    hours: {
      monday: 'Closed',
      tuesday: 'Closed',
      wednesday: 'Closed',
      thursday: '10:00 PM - 3:00 AM',
      friday: '10:00 PM - 4:00 AM',
      saturday: '10:00 PM - 4:00 AM',
      sunday: 'Closed'
    },
    phone: '(206) 223-0480',
    website: 'https://foundationnightclub.com'
  },
  {
    id: 'venue-9',
    name: 'Aston Manor',
    location: {
      lat: 47.6658,
      lng: -122.3138,
      address: '2113 N 45th St, Seattle, WA'
    },
    pulseScore: 0,
    category: 'Bar'
  },
  {
    id: 'venue-10',
    name: 'Tractor Tavern',
    location: {
      lat: 47.6651,
      lng: -122.3841,
      address: '5213 Ballard Ave NW, Seattle, WA'
    },
    pulseScore: 45,
    category: 'Music Venue'
  },
  {
    id: 'venue-11',
    name: 'The Sunset Tavern',
    location: {
      lat: 47.6667,
      lng: -122.3841,
      address: '5433 Ballard Ave NW, Seattle, WA'
    },
    pulseScore: 0,
    category: 'Bar'
  },
  {
    id: 'venue-12',
    name: 'Barboza',
    location: {
      lat: 47.6145,
      lng: -122.3207,
      address: '925 E Pike St, Seattle, WA'
    },
    pulseScore: 64,
    category: 'Lounge'
  },
  {
    id: 'venue-13',
    name: 'The Unicorn',
    location: {
      lat: 47.6142,
      lng: -122.3196,
      address: '1118 E Pike St, Seattle, WA'
    },
    pulseScore: 76,
    category: 'Bar',
    hours: {
      monday: '4:00 PM - 2:00 AM',
      tuesday: '4:00 PM - 2:00 AM',
      wednesday: '4:00 PM - 2:00 AM',
      thursday: '4:00 PM - 2:00 AM',
      friday: '4:00 PM - 2:00 AM',
      saturday: '12:00 PM - 2:00 AM',
      sunday: '12:00 PM - 2:00 AM'
    },
    phone: '(206) 325-6492',
    website: 'https://unicornseattle.com'
  },
  {
    id: 'venue-14',
    name: 'Monkey Loft',
    location: {
      lat: 47.5981,
      lng: -122.3311,
      address: '2915 1st Ave, Seattle, WA'
    },
    pulseScore: 0,
    category: 'Dance Club'
  },
  {
    id: 'venue-15',
    name: 'Espresso Vivace',
    location: {
      lat: 47.6145,
      lng: -122.3208,
      address: '901 E Denny Way, Seattle, WA'
    },
    pulseScore: 0,
    category: 'Café'
  },
  {
    id: 'venue-16',
    name: 'Nectar Lounge',
    location: {
      lat: 47.6709,
      lng: -122.3167,
      address: '412 N 36th St, Seattle, WA'
    },
    pulseScore: 38,
    category: 'Music Venue'
  },
  {
    id: 'venue-17',
    name: 'Re-bar',
    location: {
      lat: 47.6152,
      lng: -122.3202,
      address: '1114 Howell St, Seattle, WA'
    },
    pulseScore: 15,
    category: 'nightlife',
    preTrending: true,
    seeded: true,
    verifiedCheckInCount: 0
  },
  {
    id: 'venue-18',
    name: 'The 5 Point Cafe',
    location: {
      lat: 47.6205,
      lng: -122.3473,
      address: '415 Cedar St, Seattle, WA'
    },
    pulseScore: 0,
    category: 'Bar'
  },
  {
    id: 'venue-19',
    name: 'Chop Suey',
    location: {
      lat: 47.6145,
      lng: -122.3194,
      address: '1325 E Madison St, Seattle, WA'
    },
    pulseScore: 0,
    category: 'Music Venue'
  },
  {
    id: 'venue-20',
    name: 'Columbia City Theater',
    location: {
      lat: 47.5591,
      lng: -122.2922,
      address: '4916 Rainier Ave S, Seattle, WA'
    },
    pulseScore: 0,
    category: 'Music Venue'
  },
  {
    id: 'venue-21',
    name: 'Dimitriou\'s Jazz Alley',
    location: {
      lat: 47.6118,
      lng: -122.3401,
      address: '2033 6th Ave, Seattle, WA'
    },
    pulseScore: 18,
    category: 'music',
    preTrending: true,
    seeded: true,
    verifiedCheckInCount: 0
  },
  {
    id: 'venue-22',
    name: 'The Comet Tavern',
    location: {
      lat: 47.6142,
      lng: -122.3181,
      address: '922 E Pike St, Seattle, WA'
    },
    pulseScore: 0,
    category: 'Bar'
  },
  {
    id: 'venue-23',
    name: 'Ora Seattle',
    location: {
      lat: 47.6163,
      lng: -122.3487,
      address: '2208 1st Ave, Seattle, WA'
    },
    pulseScore: 20,
    category: 'nightlife',
    preTrending: true,
    seeded: true,
    verifiedCheckInCount: 0
  },
  {
    id: 'venue-24',
    name: 'The Black Lodge',
    location: {
      lat: 47.6702,
      lng: -122.3186,
      address: '340 15th Ave E, Seattle, WA'
    },
    pulseScore: 0,
    category: 'Bar'
  },
  {
    id: 'venue-25',
    name: 'The Central Saloon',
    location: {
      lat: 47.6019,
      lng: -122.3332,
      address: '207 1st Ave S, Seattle, WA'
    },
    pulseScore: 0,
    category: 'Bar'
  },
  {
    id: 'venue-26',
    name: 'The Royal Room',
    location: {
      lat: 47.5594,
      lng: -122.2925,
      address: '5000 Rainier Ave S, Seattle, WA'
    },
    pulseScore: 0,
    category: 'Music Venue'
  },
  {
    id: 'venue-27',
    name: 'Lava Lounge',
    location: {
      lat: 47.6599,
      lng: -122.3843,
      address: '2226 2nd Ave, Seattle, WA'
    },
    pulseScore: 0,
    category: 'Lounge'
  },
  {
    id: 'venue-28',
    name: 'El Corazon',
    location: {
      lat: 47.6183,
      lng: -122.3302,
      address: '109 Eastlake Ave E, Seattle, WA'
    },
    pulseScore: 0,
    category: 'Music Venue'
  },
  {
    id: 'venue-29',
    name: 'The Paramount Theatre',
    location: {
      lat: 47.6125,
      lng: -122.3317,
      address: '911 Pine St, Seattle, WA'
    },
    pulseScore: 0,
    category: 'Music Venue'
  },
  {
    id: 'venue-30',
    name: 'The Moore Theatre',
    location: {
      lat: 47.6106,
      lng: -122.3378,
      address: '1932 2nd Ave, Seattle, WA'
    },
    pulseScore: 0,
    category: 'Music Venue'
  },
  {
    id: 'venue-31',
    name: 'The George & Dragon Pub',
    location: {
      lat: 47.6497,
      lng: -122.3499,
      address: '206 N 36th St, Seattle, WA'
    },
    pulseScore: 52,
    category: 'Bar'
  },
  {
    id: 'venue-32',
    name: 'Norm\'s Eatery & Ale House',
    location: {
      lat: 47.6504,
      lng: -122.3503,
      address: '460 N 36th St, Seattle, WA'
    },
    pulseScore: 0,
    category: 'Bar'
  },
  {
    id: 'venue-33',
    name: 'The Nectar Lounge',
    location: {
      lat: 47.6509,
      lng: -122.3508,
      address: '412 N 36th St, Seattle, WA'
    },
    pulseScore: 68,
    category: 'Music Venue'
  },
  {
    id: 'venue-34',
    name: 'Fremont Brewing',
    location: {
      lat: 47.6514,
      lng: -122.3541,
      address: '1050 N 34th St, Seattle, WA'
    },
    pulseScore: 45,
    category: 'Brewery',
    hours: {
      monday: '11:00 AM - 9:00 PM',
      tuesday: '11:00 AM - 9:00 PM',
      wednesday: '11:00 AM - 9:00 PM',
      thursday: '11:00 AM - 9:00 PM',
      friday: '11:00 AM - 10:00 PM',
      saturday: '11:00 AM - 10:00 PM',
      sunday: '11:00 AM - 9:00 PM'
    },
    phone: '(206) 420-2407',
    website: 'https://fremontbrewing.com'
  },
  {
    id: 'venue-35',
    name: 'The Barrel Thief',
    location: {
      lat: 47.6493,
      lng: -122.3492,
      address: '3417 Evanston Ave N, Seattle, WA'
    },
    pulseScore: 0,
    category: 'Bar'
  },
  {
    id: 'venue-36',
    name: 'Fremont Abbey Arts Center',
    location: {
      lat: 47.6515,
      lng: -122.3518,
      address: '4272 Fremont Ave N, Seattle, WA'
    },
    pulseScore: 0,
    category: 'Music Venue'
  },
  {
    id: 'venue-37',
    name: 'Pacific Inn Pub',
    location: {
      lat: 47.6502,
      lng: -122.3480,
      address: '3501 Stone Way N, Seattle, WA'
    },
    pulseScore: 38,
    category: 'Bar'
  },
  {
    id: 'venue-38',
    name: 'Milstead & Co',
    location: {
      lat: 47.6494,
      lng: -122.3491,
      address: '770 N 34th St, Seattle, WA'
    },
    pulseScore: 0,
    category: 'Café'
  },
  {
    id: 'venue-39',
    name: 'Georgetown Liquor Company',
    location: {
      lat: 47.5414,
      lng: -122.3222,
      address: '5501 Airport Way S, Seattle, WA'
    },
    pulseScore: 62,
    category: 'Bar'
  },
  {
    id: 'venue-40',
    name: 'Jules Maes Saloon',
    location: {
      lat: 47.5441,
      lng: -122.3216,
      address: '5919 Airport Way S, Seattle, WA'
    },
    pulseScore: 48,
    category: 'Bar'
  },
  {
    id: 'venue-41',
    name: 'The Backdoor at Roxy\'s',
    location: {
      lat: 47.5428,
      lng: -122.3224,
      address: '462 S Horton St, Seattle, WA'
    },
    pulseScore: 0,
    category: 'Lounge'
  },
  {
    id: 'venue-42',
    name: 'Machine House Brewery',
    location: {
      lat: 47.5421,
      lng: -122.3235,
      address: '5840 Airport Way S, Seattle, WA'
    },
    pulseScore: 56,
    category: 'Brewery'
  },
  {
    id: 'venue-43',
    name: 'Fantagraphics Bookstore & Gallery',
    location: {
      lat: 47.5431,
      lng: -122.3229,
      address: '1201 S Vale St, Seattle, WA'
    },
    pulseScore: 0,
    category: 'Gallery'
  },
  {
    id: 'venue-44',
    name: 'Nine Pound Hammer',
    location: {
      lat: 47.5436,
      lng: -122.3218,
      address: '6009 Airport Way S, Seattle, WA'
    },
    pulseScore: 70,
    category: 'Bar'
  },
  {
    id: 'venue-45',
    name: 'Locöl Barley & Vine',
    location: {
      lat: 47.5419,
      lng: -122.3228,
      address: '5821 Airport Way S, Seattle, WA'
    },
    pulseScore: 0,
    category: 'Bar'
  },
  {
    id: 'venue-46',
    name: 'El Porvenir',
    location: {
      lat: 47.5439,
      lng: -122.3214,
      address: '6013 12th Ave S, Seattle, WA'
    },
    pulseScore: 0,
    category: 'Bar'
  },
  {
    id: 'venue-47',
    name: 'All City Coffee',
    location: {
      lat: 47.5424,
      lng: -122.3221,
      address: '1205 S Vale St, Seattle, WA'
    },
    pulseScore: 0,
    category: 'Café'
  },
  {
    id: 'venue-48',
    name: 'Georgetown Music Studios',
    location: {
      lat: 47.5433,
      lng: -122.3240,
      address: '6200 13th Ave S, Seattle, WA'
    },
    pulseScore: 0,
    category: 'Music Venue'
  },
  {
    id: 'venue-49',
    name: 'Starbucks Reserve Roastery',
    location: {
      lat: 47.6274,
      lng: -122.3366,
      address: '1124 Pike St, Seattle, WA'
    },
    pulseScore: 42,
    category: 'Café',
    hours: {
      monday: '7:00 AM - 9:00 PM',
      tuesday: '7:00 AM - 9:00 PM',
      wednesday: '7:00 AM - 9:00 PM',
      thursday: '7:00 AM - 9:00 PM',
      friday: '7:00 AM - 10:00 PM',
      saturday: '7:00 AM - 10:00 PM',
      sunday: '7:00 AM - 9:00 PM'
    },
    phone: '(206) 624-0173',
    website: 'https://starbucksreserve.com'
  },
  {
    id: 'venue-50',
    name: 'Portage Bay Cafe',
    location: {
      lat: 47.6252,
      lng: -122.3365,
      address: '391 Terry Ave N, Seattle, WA'
    },
    pulseScore: 35,
    category: 'Café'
  },
  {
    id: 'venue-51',
    name: 'Serious Pie',
    location: {
      lat: 47.6248,
      lng: -122.3378,
      address: '401 Westlake Ave N, Seattle, WA'
    },
    pulseScore: 58,
    category: 'Bar'
  },
  {
    id: 'venue-52',
    name: 'Brave Horse Tavern',
    location: {
      lat: 47.6242,
      lng: -122.3364,
      address: '310 Terry Ave N, Seattle, WA'
    },
    pulseScore: 65,
    category: 'Brewery'
  },
  {
    id: 'venue-53',
    name: 'MOD Pizza',
    location: {
      lat: 47.6253,
      lng: -122.3372,
      address: '305 Harrison St, Seattle, WA'
    },
    pulseScore: 28,
    category: 'Café'
  },
  {
    id: 'venue-54',
    name: 'Whole Foods Market',
    location: {
      lat: 47.6205,
      lng: -122.3372,
      address: '2210 Westlake Ave, Seattle, WA'
    },
    pulseScore: 0,
    category: 'Café'
  },
  {
    id: 'venue-55',
    name: 'Chandler\'s Crabhouse',
    location: {
      lat: 47.6253,
      lng: -122.3394,
      address: '901 Fairview Ave N, Seattle, WA'
    },
    pulseScore: 48,
    category: 'Bar'
  },
  {
    id: 'venue-56',
    name: 'RE:public',
    location: {
      lat: 47.6247,
      lng: -122.3368,
      address: '429 Westlake Ave N, Seattle, WA'
    },
    pulseScore: 72,
    category: 'Bar'
  },
  {
    id: 'venue-57',
    name: 'Caffé Ladro',
    location: {
      lat: 47.6235,
      lng: -122.3358,
      address: '452 Terry Ave N, Seattle, WA'
    },
    pulseScore: 0,
    category: 'Café'
  },
  {
    id: 'venue-58',
    name: 'Cupcake Royale',
    location: {
      lat: 47.6228,
      lng: -122.3381,
      address: '108 Republican St, Seattle, WA'
    },
    pulseScore: 0,
    category: 'Café'
  },
  {
    id: 'venue-59',
    name: 'Dough Zone',
    location: {
      lat: 47.6251,
      lng: -122.3370,
      address: '760 Terry Ave N, Seattle, WA'
    },
    pulseScore: 44,
    category: 'Café'
  },
  {
    id: 'venue-60',
    name: 'Barrio South Lake Union',
    location: {
      lat: 47.6239,
      lng: -122.3375,
      address: '925 Westlake Ave N, Seattle, WA'
    },
    pulseScore: 82,
    category: 'Bar',
    hours: {
      monday: '4:00 PM - 12:00 AM',
      tuesday: '4:00 PM - 12:00 AM',
      wednesday: '4:00 PM - 12:00 AM',
      thursday: '4:00 PM - 2:00 AM',
      friday: '4:00 PM - 2:00 AM',
      saturday: '11:00 AM - 2:00 AM',
      sunday: '11:00 AM - 12:00 AM'
    },
    phone: '(206) 588-0065',
    website: 'https://barriorestaurant.com'
  },
  {
    id: 'venue-61',
    name: 'Fogón Cocina Mexicana',
    location: {
      lat: 47.6243,
      lng: -122.3369,
      address: '600 Fairview Ave N, Seattle, WA'
    },
    pulseScore: 54,
    category: 'Bar'
  },
  {
    id: 'venue-62',
    name: 'Local 360',
    location: {
      lat: 47.6166,
      lng: -122.3488,
      address: '2234 1st Ave, Seattle, WA'
    },
    pulseScore: 67,
    category: 'Brewery'
  },
  {
    id: 'venue-63',
    name: 'Café Yarmarka',
    location: {
      lat: 47.6232,
      lng: -122.3352,
      address: '166 S Chandler St, Seattle, WA'
    },
    pulseScore: 0,
    category: 'Café'
  },
  {
    id: 'venue-64',
    name: 'Tat\'s Delicatessen',
    location: {
      lat: 47.6019,
      lng: -122.3342,
      address: '159 Yesler Way, Seattle, WA'
    },
    pulseScore: 38,
    category: 'Café'
  },
  {
    id: 'venue-65',
    name: 'Mbar',
    location: {
      lat: 47.6245,
      lng: -122.3373,
      address: '160 Republican St, Seattle, WA'
    },
    pulseScore: 75,
    category: 'Bar'
  },
  {
    id: 'venue-66',
    name: 'Stoup Brewing',
    location: {
      lat: 47.6668,
      lng: -122.3835,
      address: '1108 NW 52nd St, Seattle, WA'
    },
    pulseScore: 88,
    category: 'Brewery',
    hours: {
      monday: '3:00 PM - 9:00 PM',
      tuesday: '3:00 PM - 9:00 PM',
      wednesday: '3:00 PM - 9:00 PM',
      thursday: '3:00 PM - 10:00 PM',
      friday: '12:00 PM - 11:00 PM',
      saturday: '12:00 PM - 11:00 PM',
      sunday: '12:00 PM - 9:00 PM'
    },
    phone: '(206) 457-5524',
    website: 'https://stoupbrewing.com'
  },
  {
    id: 'venue-67',
    name: 'Urban Coffee Lounge',
    location: {
      lat: 47.6218,
      lng: -122.3369,
      address: '1333 5th Ave, Seattle, WA'
    },
    pulseScore: 0,
    category: 'Café'
  },
  {
    id: 'venue-68',
    name: 'Anchorhead Coffee',
    location: {
      lat: 47.6238,
      lng: -122.3365,
      address: '1600 7th Ave, Seattle, WA'
    },
    pulseScore: 32,
    category: 'Café'
  },
  {
    id: 'venue-69',
    name: 'Daniel\'s Broiler',
    location: {
      lat: 47.6246,
      lng: -122.3370,
      address: '809 Fairview Pl N, Seattle, WA'
    },
    pulseScore: 68,
    category: 'Restaurant'
  },
  {
    id: 'venue-70',
    name: 'Lunchbox Laboratory',
    location: {
      lat: 47.6247,
      lng: -122.3372,
      address: '800 Fairview Ave N, Seattle, WA'
    },
    pulseScore: 54,
    category: 'Restaurant'
  },
  {
    id: 'venue-71',
    name: 'The Whale Wins',
    location: {
      lat: 47.6497,
      lng: -122.3506,
      address: '3506 Stone Way N, Seattle, WA'
    },
    pulseScore: 72,
    category: 'Restaurant'
  },
  {
    id: 'venue-72',
    name: 'Ten Mercer',
    location: {
      lat: 47.6246,
      lng: -122.3563,
      address: '10 Mercer St, Seattle, WA'
    },
    pulseScore: 61,
    category: 'Restaurant'
  },
  {
    id: 'venue-73',
    name: 'Cactus',
    location: {
      lat: 47.6247,
      lng: -122.3371,
      address: '350 Terry Ave N, Seattle, WA'
    },
    pulseScore: 58,
    category: 'Restaurant'
  },
  {
    id: 'venue-74',
    name: 'Duke\'s Seafood',
    location: {
      lat: 47.6251,
      lng: -122.3398,
      address: '901 Fairview Ave N, Seattle, WA'
    },
    pulseScore: 64,
    category: 'Restaurant'
  },
  {
    id: 'venue-75',
    name: 'I Love Sushi on Lake Union',
    location: {
      lat: 47.6251,
      lng: -122.3392,
      address: '1001 Fairview Ave N, Seattle, WA'
    },
    pulseScore: 70,
    category: 'Restaurant'
  },
  {
    id: 'venue-76',
    name: 'Cantinetta',
    location: {
      lat: 47.6250,
      lng: -122.3380,
      address: '1000 Westlake Ave N, Seattle, WA'
    },
    pulseScore: 66,
    category: 'Restaurant'
  },
  {
    id: 'venue-77',
    name: 'Pan Africa Market',
    location: {
      lat: 47.6241,
      lng: -122.3368,
      address: '1521 1st Ave, Seattle, WA'
    },
    pulseScore: 42,
    category: 'Restaurant'
  },
  {
    id: 'venue-78',
    name: 'Mod Market',
    location: {
      lat: 47.6244,
      lng: -122.3364,
      address: '175 Denny Way, Seattle, WA'
    },
    pulseScore: 38,
    category: 'Restaurant'
  },
  {
    id: 'venue-79',
    name: 'Tavolàta',
    location: {
      lat: 47.6164,
      lng: -122.3495,
      address: '2323 2nd Ave, Seattle, WA'
    },
    pulseScore: 76,
    category: 'Restaurant'
  },
  {
    id: 'venue-80',
    name: 'Bambinos Pizzeria',
    location: {
      lat: 47.6243,
      lng: -122.3369,
      address: '401 Fairview Ave N, Seattle, WA'
    },
    pulseScore: 52,
    category: 'Restaurant'
  },
  {
    id: 'venue-81',
    name: 'Orfeo',
    location: {
      lat: 47.6248,
      lng: -122.3374,
      address: '400 Fairview Ave N, Seattle, WA'
    },
    pulseScore: 68,
    category: 'Restaurant'
  },
  {
    id: 'venue-82',
    name: 'Mediterranean Kitchen',
    location: {
      lat: 47.6234,
      lng: -122.3359,
      address: '366 Roy St, Seattle, WA'
    },
    pulseScore: 48,
    category: 'Restaurant'
  },
  {
    id: 'venue-83',
    name: 'Noodle Boat',
    location: {
      lat: 47.6239,
      lng: -122.3362,
      address: '300 Fairview Ave N, Seattle, WA'
    },
    pulseScore: 44,
    category: 'Restaurant'
  },
  {
    id: 'venue-84',
    name: 'Paragon',
    location: {
      lat: 47.6245,
      lng: -122.3558,
      address: '2125 Queen Anne Ave N, Seattle, WA'
    },
    pulseScore: 62,
    category: 'Restaurant'
  },
  {
    id: 'venue-85',
    name: 'Ezell\'s Famous Chicken',
    location: {
      lat: 47.6237,
      lng: -122.3367,
      address: '501 Mercer St, Seattle, WA'
    },
    pulseScore: 56,
    category: 'Restaurant'
  },
  {
    id: 'venue-86',
    name: 'Blue Moon Burgers',
    location: {
      lat: 47.6500,
      lng: -122.3510,
      address: '712 N 34th St, Seattle, WA'
    },
    pulseScore: 50,
    category: 'Restaurant'
  },
  {
    id: 'venue-87',
    name: 'Morsel',
    location: {
      lat: 47.6496,
      lng: -122.3497,
      address: '3520 Fremont Ave N, Seattle, WA'
    },
    pulseScore: 64,
    category: 'Restaurant'
  },
  {
    id: 'venue-88',
    name: 'Westward',
    location: {
      lat: 47.6437,
      lng: -122.3397,
      address: '2501 N Northlake Way, Seattle, WA'
    },
    pulseScore: 82,
    category: 'Restaurant'
  }
]

// Add city/state to Seattle venues for consistency
const seattleWithCity = SEATTLE_VENUES.map(v => ({
  ...v,
  city: v.city ?? 'Seattle',
  state: v.state ?? 'WA',
}))

/** All venues across the US — Seattle + 18 other major cities */
export const MOCK_VENUES: Venue[] = applyVenueIntegrationSeeds([...seattleWithCity, ...US_EXPANSION_VENUES])

/** Seattle-only venues (backward compatible) */
export const SEATTLE_ONLY_VENUES = SEATTLE_VENUES

export const SIMULATED_USER_LOCATION = {
  lat: 47.6145,
  lng: -122.3205
}

export function getSimulatedLocation(): Promise<GeolocationPosition> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        coords: {
          latitude: SIMULATED_USER_LOCATION.lat,
          longitude: SIMULATED_USER_LOCATION.lng,
          accuracy: 10,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null
        },
        timestamp: Date.now()
      } as GeolocationPosition)
    }, 100)
  })
}

/**
 * DEV-only loader for the seeded mock venue catalogue. Returns an empty
 * array in production so the bundle doesn't ship demo data. Use via
 * `src/lib/data` when `USE_SUPABASE_BACKEND` is off.
 */
export function loadMockVenueFixtures(): Venue[] {
  if (!import.meta.env.DEV) return []
  return MOCK_VENUES
}
