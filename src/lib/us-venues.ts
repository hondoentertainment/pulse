import type { Venue } from './types'

/**
 * Major US city venues spanning coast to coast.
 * Each city has a mix of categories: nightlife, bars, cafes, restaurants, music venues.
 */

// --- NEW YORK CITY ---
const NYC_VENUES: Venue[] = [
  { id: 'nyc-1', name: 'Brooklyn Mirage', city: 'New York', state: 'NY', location: { lat: 40.7216, lng: -73.9337, address: '140 Stewart Ave, Brooklyn, NY' }, pulseScore: 92, category: 'Nightclub' },
  { id: 'nyc-2', name: 'House of Yes', city: 'New York', state: 'NY', location: { lat: 40.7058, lng: -73.9236, address: '2 Wyckoff Ave, Brooklyn, NY' }, pulseScore: 85, category: 'Nightclub' },
  { id: 'nyc-3', name: 'Elsewhere', city: 'New York', state: 'NY', location: { lat: 40.7097, lng: -73.9225, address: '599 Johnson Ave, Brooklyn, NY' }, pulseScore: 78, category: 'Music Venue' },
  { id: 'nyc-4', name: 'Le Bain', city: 'New York', state: 'NY', location: { lat: 40.7409, lng: -74.0078, address: '848 Washington St, New York, NY' }, pulseScore: 82, category: 'Lounge' },
  { id: 'nyc-5', name: 'Blue Note Jazz Club', city: 'New York', state: 'NY', location: { lat: 40.7313, lng: -74.0001, address: '131 W 3rd St, New York, NY' }, pulseScore: 70, category: 'Music Venue' },
  { id: 'nyc-6', name: 'Devoción', city: 'New York', state: 'NY', location: { lat: 40.7128, lng: -73.9564, address: '69 Grand St, Brooklyn, NY' }, pulseScore: 45, category: 'Café' },
  { id: 'nyc-7', name: 'Dead Rabbit', city: 'New York', state: 'NY', location: { lat: 40.7031, lng: -74.0129, address: '30 Water St, New York, NY' }, pulseScore: 68, category: 'Bar' },
  { id: 'nyc-8', name: 'Attaboy', city: 'New York', state: 'NY', location: { lat: 40.7205, lng: -73.9884, address: '134 Eldridge St, New York, NY' }, pulseScore: 55, category: 'Bar' },
  { id: 'nyc-9', name: 'Joe\'s Pizza', city: 'New York', state: 'NY', location: { lat: 40.7307, lng: -74.0021, address: '7 Carmine St, New York, NY' }, pulseScore: 60, category: 'Restaurant' },
  { id: 'nyc-10', name: 'Roberta\'s', city: 'New York', state: 'NY', location: { lat: 40.7050, lng: -73.9335, address: '261 Moore St, Brooklyn, NY' }, pulseScore: 72, category: 'Restaurant' },
  { id: 'nyc-11', name: 'Other Half Brewing', city: 'New York', state: 'NY', location: { lat: 40.6724, lng: -73.9956, address: '195 Centre St, Brooklyn, NY' }, pulseScore: 65, category: 'Brewery' },
  { id: 'nyc-12', name: 'The Bowery Ballroom', city: 'New York', state: 'NY', location: { lat: 40.7205, lng: -73.9935, address: '6 Delancey St, New York, NY' }, pulseScore: 75, category: 'Music Venue' },
  { id: 'nyc-13', name: 'Webster Hall', city: 'New York', state: 'NY', location: { lat: 40.7321, lng: -73.9899, address: '125 E 11th St, New York, NY' }, pulseScore: 80, category: 'Nightclub' },
  { id: 'nyc-14', name: 'Stumptown Coffee', city: 'New York', state: 'NY', location: { lat: 40.7387, lng: -73.9883, address: '18 W 29th St, New York, NY' }, pulseScore: 38, category: 'Café' },
  { id: 'nyc-15', name: 'Momofuku Ko', city: 'New York', state: 'NY', location: { lat: 40.7255, lng: -73.9903, address: '8 Extra Pl, New York, NY' }, pulseScore: 58, category: 'Restaurant' },
]

// --- LOS ANGELES ---
const LA_VENUES: Venue[] = [
  { id: 'la-1', name: 'Sound Nightclub', city: 'Los Angeles', state: 'CA', location: { lat: 34.0907, lng: -118.3267, address: '1642 N Las Palmas Ave, Los Angeles, CA' }, pulseScore: 88, category: 'Nightclub' },
  { id: 'la-2', name: 'The Viper Room', city: 'Los Angeles', state: 'CA', location: { lat: 34.0901, lng: -118.3856, address: '8852 Sunset Blvd, West Hollywood, CA' }, pulseScore: 72, category: 'Music Venue' },
  { id: 'la-3', name: 'Avalon Hollywood', city: 'Los Angeles', state: 'CA', location: { lat: 34.1013, lng: -118.3249, address: '1735 Vine St, Los Angeles, CA' }, pulseScore: 85, category: 'Nightclub' },
  { id: 'la-4', name: 'The Echo', city: 'Los Angeles', state: 'CA', location: { lat: 34.0775, lng: -118.2601, address: '1822 Sunset Blvd, Los Angeles, CA' }, pulseScore: 65, category: 'Music Venue' },
  { id: 'la-5', name: 'Intelligentsia Coffee', city: 'Los Angeles', state: 'CA', location: { lat: 34.0903, lng: -118.2758, address: '3922 Sunset Blvd, Los Angeles, CA' }, pulseScore: 42, category: 'Café' },
  { id: 'la-6', name: 'The Dresden', city: 'Los Angeles', state: 'CA', location: { lat: 34.1009, lng: -118.2879, address: '1760 N Vermont Ave, Los Angeles, CA' }, pulseScore: 60, category: 'Lounge' },
  { id: 'la-7', name: 'Angel City Brewery', city: 'Los Angeles', state: 'CA', location: { lat: 34.0473, lng: -118.2350, address: '216 Alameda St, Los Angeles, CA' }, pulseScore: 55, category: 'Brewery' },
  { id: 'la-8', name: 'Bestia', city: 'Los Angeles', state: 'CA', location: { lat: 34.0378, lng: -118.2321, address: '2121 E 7th Pl, Los Angeles, CA' }, pulseScore: 78, category: 'Restaurant' },
  { id: 'la-9', name: 'Grand Central Market', city: 'Los Angeles', state: 'CA', location: { lat: 34.0510, lng: -118.2494, address: '317 S Broadway, Los Angeles, CA' }, pulseScore: 68, category: 'Restaurant' },
  { id: 'la-10', name: 'No Vacancy', city: 'Los Angeles', state: 'CA', location: { lat: 34.1017, lng: -118.3282, address: '1727 N Hudson Ave, Los Angeles, CA' }, pulseScore: 76, category: 'Bar' },
  { id: 'la-11', name: 'The Troubadour', city: 'Los Angeles', state: 'CA', location: { lat: 34.0810, lng: -118.3893, address: '9081 Santa Monica Blvd, West Hollywood, CA' }, pulseScore: 70, category: 'Music Venue' },
  { id: 'la-12', name: 'Republique', city: 'Los Angeles', state: 'CA', location: { lat: 34.0686, lng: -118.3431, address: '624 S La Brea Ave, Los Angeles, CA' }, pulseScore: 62, category: 'Restaurant' },
]

// --- CHICAGO ---
const CHICAGO_VENUES: Venue[] = [
  { id: 'chi-1', name: 'Smart Bar', city: 'Chicago', state: 'IL', location: { lat: 41.9392, lng: -87.6638, address: '3730 N Clark St, Chicago, IL' }, pulseScore: 82, category: 'Nightclub' },
  { id: 'chi-2', name: 'Metro Chicago', city: 'Chicago', state: 'IL', location: { lat: 41.9498, lng: -87.6587, address: '3730 N Clark St, Chicago, IL' }, pulseScore: 75, category: 'Music Venue' },
  { id: 'chi-3', name: 'Kingston Mines', city: 'Chicago', state: 'IL', location: { lat: 41.9367, lng: -87.6487, address: '2548 N Halsted St, Chicago, IL' }, pulseScore: 70, category: 'Music Venue' },
  { id: 'chi-4', name: 'The Aviary', city: 'Chicago', state: 'IL', location: { lat: 41.8877, lng: -87.6502, address: '955 W Fulton Market, Chicago, IL' }, pulseScore: 68, category: 'Bar' },
  { id: 'chi-5', name: 'Intelligentsia Millennium Park', city: 'Chicago', state: 'IL', location: { lat: 41.8843, lng: -87.6248, address: '53 E Randolph St, Chicago, IL' }, pulseScore: 40, category: 'Café' },
  { id: 'chi-6', name: 'Girl & The Goat', city: 'Chicago', state: 'IL', location: { lat: 41.8846, lng: -87.6485, address: '809 W Randolph St, Chicago, IL' }, pulseScore: 72, category: 'Restaurant' },
  { id: 'chi-7', name: 'Revolution Brewing', city: 'Chicago', state: 'IL', location: { lat: 41.9217, lng: -87.6906, address: '2323 N Milwaukee Ave, Chicago, IL' }, pulseScore: 58, category: 'Brewery' },
  { id: 'chi-8', name: 'Thalia Hall', city: 'Chicago', state: 'IL', location: { lat: 41.8590, lng: -87.6570, address: '1807 S Allport St, Chicago, IL' }, pulseScore: 65, category: 'Music Venue' },
  { id: 'chi-9', name: 'Au Cheval', city: 'Chicago', state: 'IL', location: { lat: 41.8843, lng: -87.6482, address: '800 W Randolph St, Chicago, IL' }, pulseScore: 60, category: 'Restaurant' },
  { id: 'chi-10', name: 'Spybar', city: 'Chicago', state: 'IL', location: { lat: 41.8920, lng: -87.6324, address: '646 N Franklin St, Chicago, IL' }, pulseScore: 80, category: 'Nightclub' },
]

// --- MIAMI ---
const MIAMI_VENUES: Venue[] = [
  { id: 'mia-1', name: 'LIV', city: 'Miami', state: 'FL', location: { lat: 25.8015, lng: -80.1231, address: '4441 Collins Ave, Miami Beach, FL' }, pulseScore: 95, category: 'Nightclub' },
  { id: 'mia-2', name: 'E11EVEN', city: 'Miami', state: 'FL', location: { lat: 25.7822, lng: -80.1966, address: '29 NE 11th St, Miami, FL' }, pulseScore: 90, category: 'Nightclub' },
  { id: 'mia-3', name: 'Ball & Chain', city: 'Miami', state: 'FL', location: { lat: 25.7658, lng: -80.2199, address: '1513 SW 8th St, Miami, FL' }, pulseScore: 72, category: 'Music Venue' },
  { id: 'mia-4', name: 'Broken Shaker', city: 'Miami', state: 'FL', location: { lat: 25.7943, lng: -80.1343, address: '2727 Indian Creek Dr, Miami Beach, FL' }, pulseScore: 65, category: 'Bar' },
  { id: 'mia-5', name: 'Panther Coffee', city: 'Miami', state: 'FL', location: { lat: 25.7560, lng: -80.2435, address: '2390 NW 2nd Ave, Miami, FL' }, pulseScore: 38, category: 'Café' },
  { id: 'mia-6', name: 'Joe\'s Stone Crab', city: 'Miami', state: 'FL', location: { lat: 25.7690, lng: -80.1396, address: '11 Washington Ave, Miami Beach, FL' }, pulseScore: 75, category: 'Restaurant' },
  { id: 'mia-7', name: 'Wynwood Brewing', city: 'Miami', state: 'FL', location: { lat: 25.8008, lng: -80.1987, address: '565 NW 24th St, Miami, FL' }, pulseScore: 55, category: 'Brewery' },
  { id: 'mia-8', name: 'Club Space', city: 'Miami', state: 'FL', location: { lat: 25.7853, lng: -80.1920, address: '34 NE 11th St, Miami, FL' }, pulseScore: 88, category: 'Nightclub' },
  { id: 'mia-9', name: 'The Wharf Miami', city: 'Miami', state: 'FL', location: { lat: 25.7676, lng: -80.1878, address: '114 SW North River Dr, Miami, FL' }, pulseScore: 78, category: 'Bar' },
  { id: 'mia-10', name: 'Versailles', city: 'Miami', state: 'FL', location: { lat: 25.7653, lng: -80.3067, address: '3555 SW 8th St, Miami, FL' }, pulseScore: 52, category: 'Restaurant' },
]

// --- AUSTIN ---
const AUSTIN_VENUES: Venue[] = [
  { id: 'atx-1', name: 'Rainey Street Bars', city: 'Austin', state: 'TX', location: { lat: 30.2560, lng: -97.7395, address: '76 Rainey St, Austin, TX' }, pulseScore: 82, category: 'Bar' },
  { id: 'atx-2', name: 'Stubb\'s BBQ', city: 'Austin', state: 'TX', location: { lat: 30.2692, lng: -97.7366, address: '801 Red River St, Austin, TX' }, pulseScore: 78, category: 'Music Venue' },
  { id: 'atx-3', name: 'Mohawk', city: 'Austin', state: 'TX', location: { lat: 30.2683, lng: -97.7380, address: '912 Red River St, Austin, TX' }, pulseScore: 70, category: 'Music Venue' },
  { id: 'atx-4', name: 'Elephant Room', city: 'Austin', state: 'TX', location: { lat: 30.2659, lng: -97.7443, address: '315 Congress Ave, Austin, TX' }, pulseScore: 62, category: 'Music Venue' },
  { id: 'atx-5', name: 'Houndstooth Coffee', city: 'Austin', state: 'TX', location: { lat: 30.2683, lng: -97.7434, address: '401 Congress Ave, Austin, TX' }, pulseScore: 35, category: 'Café' },
  { id: 'atx-6', name: 'Franklin Barbecue', city: 'Austin', state: 'TX', location: { lat: 30.2702, lng: -97.7311, address: '900 E 11th St, Austin, TX' }, pulseScore: 80, category: 'Restaurant' },
  { id: 'atx-7', name: 'Lazarus Brewing', city: 'Austin', state: 'TX', location: { lat: 30.2528, lng: -97.7407, address: '1902 E 6th St, Austin, TX' }, pulseScore: 58, category: 'Brewery' },
  { id: 'atx-8', name: 'Summit', city: 'Austin', state: 'TX', location: { lat: 30.2654, lng: -97.7420, address: '120 W 5th St, Austin, TX' }, pulseScore: 85, category: 'Nightclub' },
  { id: 'atx-9', name: 'Banger\'s Sausage House', city: 'Austin', state: 'TX', location: { lat: 30.2556, lng: -97.7388, address: '79 Rainey St, Austin, TX' }, pulseScore: 68, category: 'Bar' },
  { id: 'atx-10', name: 'Broken Spoke', city: 'Austin', state: 'TX', location: { lat: 30.2369, lng: -97.7767, address: '3201 S Lamar Blvd, Austin, TX' }, pulseScore: 55, category: 'Music Venue' },
]

// --- NASHVILLE ---
const NASHVILLE_VENUES: Venue[] = [
  { id: 'nash-1', name: 'Tootsie\'s Orchid Lounge', city: 'Nashville', state: 'TN', location: { lat: 36.1589, lng: -86.7758, address: '422 Broadway, Nashville, TN' }, pulseScore: 88, category: 'Bar' },
  { id: 'nash-2', name: 'Ryman Auditorium', city: 'Nashville', state: 'TN', location: { lat: 36.1614, lng: -86.7774, address: '116 5th Ave N, Nashville, TN' }, pulseScore: 82, category: 'Music Venue' },
  { id: 'nash-3', name: 'The Bluebird Cafe', city: 'Nashville', state: 'TN', location: { lat: 36.1012, lng: -86.8168, address: '4104 Hillsboro Pike, Nashville, TN' }, pulseScore: 75, category: 'Music Venue' },
  { id: 'nash-4', name: 'Acme Feed & Seed', city: 'Nashville', state: 'TN', location: { lat: 36.1567, lng: -86.7742, address: '101 Broadway, Nashville, TN' }, pulseScore: 72, category: 'Bar' },
  { id: 'nash-5', name: 'Barista Parlor', city: 'Nashville', state: 'TN', location: { lat: 36.1729, lng: -86.7590, address: '519 Gallatin Ave, Nashville, TN' }, pulseScore: 40, category: 'Café' },
  { id: 'nash-6', name: 'Hattie B\'s Hot Chicken', city: 'Nashville', state: 'TN', location: { lat: 36.1539, lng: -86.8041, address: '112 19th Ave S, Nashville, TN' }, pulseScore: 70, category: 'Restaurant' },
  { id: 'nash-7', name: 'Yazoo Brewing', city: 'Nashville', state: 'TN', location: { lat: 36.1571, lng: -86.7611, address: '910 Division St, Nashville, TN' }, pulseScore: 52, category: 'Brewery' },
  { id: 'nash-8', name: 'Rudy\'s Jazz Room', city: 'Nashville', state: 'TN', location: { lat: 36.1530, lng: -86.7807, address: '809 Gleaves St, Nashville, TN' }, pulseScore: 60, category: 'Music Venue' },
]

// --- SAN FRANCISCO ---
const SF_VENUES: Venue[] = [
  { id: 'sf-1', name: 'The Fillmore', city: 'San Francisco', state: 'CA', location: { lat: 37.7840, lng: -122.4334, address: '1805 Geary Blvd, San Francisco, CA' }, pulseScore: 80, category: 'Music Venue' },
  { id: 'sf-2', name: 'Audio', city: 'San Francisco', state: 'CA', location: { lat: 37.7707, lng: -122.4120, address: '316 11th St, San Francisco, CA' }, pulseScore: 78, category: 'Nightclub' },
  { id: 'sf-3', name: 'Trick Dog', city: 'San Francisco', state: 'CA', location: { lat: 37.7607, lng: -122.4155, address: '3010 20th St, San Francisco, CA' }, pulseScore: 65, category: 'Bar' },
  { id: 'sf-4', name: 'Blue Bottle Coffee', city: 'San Francisco', state: 'CA', location: { lat: 37.7826, lng: -122.4079, address: '66 Mint St, San Francisco, CA' }, pulseScore: 42, category: 'Café' },
  { id: 'sf-5', name: 'Tartine Manufactory', city: 'San Francisco', state: 'CA', location: { lat: 37.7616, lng: -122.4131, address: '595 Alabama St, San Francisco, CA' }, pulseScore: 55, category: 'Restaurant' },
  { id: 'sf-6', name: 'Anchor Brewing', city: 'San Francisco', state: 'CA', location: { lat: 37.7648, lng: -122.3999, address: '1705 Mariposa St, San Francisco, CA' }, pulseScore: 50, category: 'Brewery' },
  { id: 'sf-7', name: 'The Independent', city: 'San Francisco', state: 'CA', location: { lat: 37.7754, lng: -122.4369, address: '628 Divisadero St, San Francisco, CA' }, pulseScore: 72, category: 'Music Venue' },
  { id: 'sf-8', name: 'Bergerac', city: 'San Francisco', state: 'CA', location: { lat: 37.7700, lng: -122.4193, address: '316 11th St, San Francisco, CA' }, pulseScore: 62, category: 'Bar' },
  { id: 'sf-9', name: 'Foreign Cinema', city: 'San Francisco', state: 'CA', location: { lat: 37.7612, lng: -122.4155, address: '2534 Mission St, San Francisco, CA' }, pulseScore: 68, category: 'Restaurant' },
  { id: 'sf-10', name: 'Temple Nightclub', city: 'San Francisco', state: 'CA', location: { lat: 37.7705, lng: -122.4046, address: '540 Howard St, San Francisco, CA' }, pulseScore: 82, category: 'Nightclub' },
]

// --- DENVER ---
const DENVER_VENUES: Venue[] = [
  { id: 'den-1', name: 'Temple Nightclub Denver', city: 'Denver', state: 'CO', location: { lat: 39.7537, lng: -104.9954, address: '1136 Broadway, Denver, CO' }, pulseScore: 78, category: 'Nightclub' },
  { id: 'den-2', name: 'Red Rocks Amphitheatre', city: 'Denver', state: 'CO', location: { lat: 39.6654, lng: -105.2057, address: '18300 W Alameda Pkwy, Morrison, CO' }, pulseScore: 92, category: 'Music Venue' },
  { id: 'den-3', name: 'Williams & Graham', city: 'Denver', state: 'CO', location: { lat: 39.7620, lng: -105.0070, address: '3160 Tejon St, Denver, CO' }, pulseScore: 65, category: 'Bar' },
  { id: 'den-4', name: 'Little Man Ice Cream', city: 'Denver', state: 'CO', location: { lat: 39.7610, lng: -105.0068, address: '2620 16th St, Denver, CO' }, pulseScore: 45, category: 'Café' },
  { id: 'den-5', name: 'Great Divide Brewing', city: 'Denver', state: 'CO', location: { lat: 39.7536, lng: -104.9872, address: '2201 Arapahoe St, Denver, CO' }, pulseScore: 58, category: 'Brewery' },
  { id: 'den-6', name: 'Guard and Grace', city: 'Denver', state: 'CO', location: { lat: 39.7478, lng: -104.9970, address: '1801 California St, Denver, CO' }, pulseScore: 70, category: 'Restaurant' },
  { id: 'den-7', name: 'Cervantes Masterpiece', city: 'Denver', state: 'CO', location: { lat: 39.7612, lng: -104.9731, address: '2637 Welton St, Denver, CO' }, pulseScore: 75, category: 'Music Venue' },
  { id: 'den-8', name: 'Death & Co Denver', city: 'Denver', state: 'CO', location: { lat: 39.7590, lng: -104.9882, address: '1280 25th St, Denver, CO' }, pulseScore: 62, category: 'Bar' },
]

// --- ATLANTA ---
const ATLANTA_VENUES: Venue[] = [
  { id: 'atl-1', name: 'Tabernacle', city: 'Atlanta', state: 'GA', location: { lat: 33.7582, lng: -84.3926, address: '152 Luckie St NW, Atlanta, GA' }, pulseScore: 80, category: 'Music Venue' },
  { id: 'atl-2', name: 'Tongue & Groove', city: 'Atlanta', state: 'GA', location: { lat: 33.8148, lng: -84.3685, address: '565 Main St NE, Atlanta, GA' }, pulseScore: 78, category: 'Nightclub' },
  { id: 'atl-3', name: 'The Clermont Lounge', city: 'Atlanta', state: 'GA', location: { lat: 33.7738, lng: -84.3560, address: '789 Ponce de Leon Ave NE, Atlanta, GA' }, pulseScore: 72, category: 'Lounge' },
  { id: 'atl-4', name: 'Monday Night Brewing', city: 'Atlanta', state: 'GA', location: { lat: 33.7393, lng: -84.4148, address: '670 Trabert Ave NW, Atlanta, GA' }, pulseScore: 55, category: 'Brewery' },
  { id: 'atl-5', name: 'Octane Coffee', city: 'Atlanta', state: 'GA', location: { lat: 33.7722, lng: -84.3638, address: '1009 Marietta St NW, Atlanta, GA' }, pulseScore: 38, category: 'Café' },
  { id: 'atl-6', name: 'Staplehouse', city: 'Atlanta', state: 'GA', location: { lat: 33.7611, lng: -84.3515, address: '541 Edgewood Ave SE, Atlanta, GA' }, pulseScore: 68, category: 'Restaurant' },
  { id: 'atl-7', name: 'Terminal West', city: 'Atlanta', state: 'GA', location: { lat: 33.7897, lng: -84.4051, address: '887 W Marietta St NW, Atlanta, GA' }, pulseScore: 75, category: 'Music Venue' },
  { id: 'atl-8', name: 'Ticonderoga Club', city: 'Atlanta', state: 'GA', location: { lat: 33.7735, lng: -84.3527, address: '99 Krog St NE, Atlanta, GA' }, pulseScore: 60, category: 'Bar' },
]

// --- NEW ORLEANS ---
const NOLA_VENUES: Venue[] = [
  { id: 'nola-1', name: 'Preservation Hall', city: 'New Orleans', state: 'LA', location: { lat: 29.9587, lng: -90.0646, address: '726 St Peter St, New Orleans, LA' }, pulseScore: 85, category: 'Music Venue' },
  { id: 'nola-2', name: 'Tipitina\'s', city: 'New Orleans', state: 'LA', location: { lat: 29.9189, lng: -90.1202, address: '501 Napoleon Ave, New Orleans, LA' }, pulseScore: 78, category: 'Music Venue' },
  { id: 'nola-3', name: 'The Spotted Cat', city: 'New Orleans', state: 'LA', location: { lat: 29.9627, lng: -90.0558, address: '623 Frenchmen St, New Orleans, LA' }, pulseScore: 82, category: 'Music Venue' },
  { id: 'nola-4', name: 'Bacchanal Wine', city: 'New Orleans', state: 'LA', location: { lat: 29.9633, lng: -90.0393, address: '600 Poland Ave, New Orleans, LA' }, pulseScore: 68, category: 'Bar' },
  { id: 'nola-5', name: 'French Truck Coffee', city: 'New Orleans', state: 'LA', location: { lat: 29.9526, lng: -90.0716, address: '4536 Dryades St, New Orleans, LA' }, pulseScore: 35, category: 'Café' },
  { id: 'nola-6', name: 'Commander\'s Palace', city: 'New Orleans', state: 'LA', location: { lat: 29.9277, lng: -90.0879, address: '1403 Washington Ave, New Orleans, LA' }, pulseScore: 72, category: 'Restaurant' },
  { id: 'nola-7', name: 'NOLA Brewing', city: 'New Orleans', state: 'LA', location: { lat: 29.9437, lng: -90.0339, address: '3001 Tchoupitoulas St, New Orleans, LA' }, pulseScore: 50, category: 'Brewery' },
  { id: 'nola-8', name: 'One Eyed Jacks', city: 'New Orleans', state: 'LA', location: { lat: 29.9570, lng: -90.0676, address: '615 Toulouse St, New Orleans, LA' }, pulseScore: 70, category: 'Music Venue' },
]

// --- PORTLAND ---
const PORTLAND_VENUES: Venue[] = [
  { id: 'pdx-1', name: 'Doug Fir Lounge', city: 'Portland', state: 'OR', location: { lat: 45.5160, lng: -122.6539, address: '830 E Burnside St, Portland, OR' }, pulseScore: 72, category: 'Music Venue' },
  { id: 'pdx-2', name: 'Stumptown Coffee', city: 'Portland', state: 'OR', location: { lat: 45.5228, lng: -122.6750, address: '128 SW 3rd Ave, Portland, OR' }, pulseScore: 40, category: 'Café' },
  { id: 'pdx-3', name: 'Pok Pok', city: 'Portland', state: 'OR', location: { lat: 45.5046, lng: -122.6360, address: '3226 SE Division St, Portland, OR' }, pulseScore: 65, category: 'Restaurant' },
  { id: 'pdx-4', name: 'Great Notion Brewing', city: 'Portland', state: 'OR', location: { lat: 45.5477, lng: -122.6786, address: '2204 NE Alberta St, Portland, OR' }, pulseScore: 58, category: 'Brewery' },
  { id: 'pdx-5', name: 'Multnomah Whiskey Library', city: 'Portland', state: 'OR', location: { lat: 45.5193, lng: -122.6815, address: '1124 SW Alder St, Portland, OR' }, pulseScore: 68, category: 'Bar' },
  { id: 'pdx-6', name: 'Crystal Ballroom', city: 'Portland', state: 'OR', location: { lat: 45.5228, lng: -122.6816, address: '1332 W Burnside St, Portland, OR' }, pulseScore: 75, category: 'Music Venue' },
  { id: 'pdx-7', name: '45 East', city: 'Portland', state: 'OR', location: { lat: 45.5158, lng: -122.6536, address: '45 SE 3rd Ave, Portland, OR' }, pulseScore: 80, category: 'Nightclub' },
  { id: 'pdx-8', name: 'Lardo', city: 'Portland', state: 'OR', location: { lat: 45.5213, lng: -122.6653, address: '1205 SW Washington St, Portland, OR' }, pulseScore: 52, category: 'Restaurant' },
]

// --- LAS VEGAS ---
const VEGAS_VENUES: Venue[] = [
  { id: 'lv-1', name: 'XS Nightclub', city: 'Las Vegas', state: 'NV', location: { lat: 36.1269, lng: -115.1669, address: '3131 Las Vegas Blvd S, Las Vegas, NV' }, pulseScore: 95, category: 'Nightclub' },
  { id: 'lv-2', name: 'Omnia Nightclub', city: 'Las Vegas', state: 'NV', location: { lat: 36.1160, lng: -115.1733, address: '3570 Las Vegas Blvd S, Las Vegas, NV' }, pulseScore: 92, category: 'Nightclub' },
  { id: 'lv-3', name: 'Hakkasan', city: 'Las Vegas', state: 'NV', location: { lat: 36.1024, lng: -115.1727, address: '3799 Las Vegas Blvd S, Las Vegas, NV' }, pulseScore: 88, category: 'Nightclub' },
  { id: 'lv-4', name: 'Herbs & Rye', city: 'Las Vegas', state: 'NV', location: { lat: 36.1505, lng: -115.1645, address: '3713 W Sahara Ave, Las Vegas, NV' }, pulseScore: 65, category: 'Bar' },
  { id: 'lv-5', name: 'PublicUs', city: 'Las Vegas', state: 'NV', location: { lat: 36.1681, lng: -115.1356, address: '1126 Fremont St, Las Vegas, NV' }, pulseScore: 42, category: 'Café' },
  { id: 'lv-6', name: 'Lotus of Siam', city: 'Las Vegas', state: 'NV', location: { lat: 36.1291, lng: -115.1501, address: '620 E Flamingo Rd, Las Vegas, NV' }, pulseScore: 70, category: 'Restaurant' },
  { id: 'lv-7', name: 'Brooklyn Bowl Las Vegas', city: 'Las Vegas', state: 'NV', location: { lat: 36.1174, lng: -115.1692, address: '3545 Las Vegas Blvd S, Las Vegas, NV' }, pulseScore: 76, category: 'Music Venue' },
  { id: 'lv-8', name: 'Marquee Nightclub', city: 'Las Vegas', state: 'NV', location: { lat: 36.1079, lng: -115.1739, address: '3708 Las Vegas Blvd S, Las Vegas, NV' }, pulseScore: 90, category: 'Nightclub' },
]

// --- BOSTON ---
const BOSTON_VENUES: Venue[] = [
  { id: 'bos-1', name: 'Royale Boston', city: 'Boston', state: 'MA', location: { lat: 42.3499, lng: -71.0668, address: '279 Tremont St, Boston, MA' }, pulseScore: 78, category: 'Nightclub' },
  { id: 'bos-2', name: 'House of Blues Boston', city: 'Boston', state: 'MA', location: { lat: 42.3463, lng: -71.0958, address: '15 Lansdowne St, Boston, MA' }, pulseScore: 75, category: 'Music Venue' },
  { id: 'boston-3', name: 'Drink', city: 'Boston', state: 'MA', location: { lat: 42.3522, lng: -71.0505, address: '348 Congress St, Boston, MA' }, pulseScore: 62, category: 'Bar' },
  { id: 'bos-4', name: 'George Howell Coffee', city: 'Boston', state: 'MA', location: { lat: 42.3559, lng: -71.0565, address: '505 Washington St, Boston, MA' }, pulseScore: 38, category: 'Café' },
  { id: 'bos-5', name: 'Trillium Brewing', city: 'Boston', state: 'MA', location: { lat: 42.3475, lng: -71.0417, address: '369 Congress St, Boston, MA' }, pulseScore: 55, category: 'Brewery' },
  { id: 'bos-6', name: 'Neptune Oyster', city: 'Boston', state: 'MA', location: { lat: 42.3627, lng: -71.0539, address: '63 Salem St, Boston, MA' }, pulseScore: 68, category: 'Restaurant' },
  { id: 'bos-7', name: 'Paradise Rock Club', city: 'Boston', state: 'MA', location: { lat: 42.3512, lng: -71.1172, address: '967 Commonwealth Ave, Boston, MA' }, pulseScore: 70, category: 'Music Venue' },
  { id: 'bos-8', name: 'The Beehive', city: 'Boston', state: 'MA', location: { lat: 42.3448, lng: -71.0705, address: '541 Tremont St, Boston, MA' }, pulseScore: 65, category: 'Bar' },
]

// --- MINNEAPOLIS ---
const MINNEAPOLIS_VENUES: Venue[] = [
  { id: 'msp-1', name: 'First Avenue', city: 'Minneapolis', state: 'MN', location: { lat: 44.9796, lng: -93.2766, address: '701 1st Ave N, Minneapolis, MN' }, pulseScore: 82, category: 'Music Venue' },
  { id: 'msp-2', name: 'Spyhouse Coffee', city: 'Minneapolis', state: 'MN', location: { lat: 44.9895, lng: -93.2475, address: '2451 Nicollet Ave, Minneapolis, MN' }, pulseScore: 40, category: 'Café' },
  { id: 'msp-3', name: 'Surly Brewing', city: 'Minneapolis', state: 'MN', location: { lat: 44.9727, lng: -93.2141, address: '520 Malcolm Ave SE, Minneapolis, MN' }, pulseScore: 62, category: 'Brewery' },
  { id: 'msp-4', name: 'Marvel Bar', city: 'Minneapolis', state: 'MN', location: { lat: 44.9836, lng: -93.2691, address: '50 N 2nd Ave, Minneapolis, MN' }, pulseScore: 58, category: 'Bar' },
  { id: 'msp-5', name: 'The Bachelor Farmer', city: 'Minneapolis', state: 'MN', location: { lat: 44.9842, lng: -93.2696, address: '50 N 2nd Ave, Minneapolis, MN' }, pulseScore: 65, category: 'Restaurant' },
  { id: 'msp-6', name: 'The Saloon', city: 'Minneapolis', state: 'MN', location: { lat: 44.9794, lng: -93.2774, address: '830 Hennepin Ave, Minneapolis, MN' }, pulseScore: 75, category: 'Nightclub' },
]

// --- PHILADELPHIA ---
const PHILLY_VENUES: Venue[] = [
  { id: 'phl-1', name: 'Coda', city: 'Philadelphia', state: 'PA', location: { lat: 39.9471, lng: -75.1579, address: '1712 Walnut St, Philadelphia, PA' }, pulseScore: 78, category: 'Nightclub' },
  { id: 'phl-2', name: 'Union Transfer', city: 'Philadelphia', state: 'PA', location: { lat: 39.9634, lng: -75.1384, address: '1026 Spring Garden St, Philadelphia, PA' }, pulseScore: 75, category: 'Music Venue' },
  { id: 'phl-3', name: 'Elixr Coffee', city: 'Philadelphia', state: 'PA', location: { lat: 39.9494, lng: -75.1646, address: '207 S Sydenham St, Philadelphia, PA' }, pulseScore: 38, category: 'Café' },
  { id: 'phl-4', name: 'Yards Brewing', city: 'Philadelphia', state: 'PA', location: { lat: 39.9684, lng: -75.1340, address: '500 Spring Garden St, Philadelphia, PA' }, pulseScore: 55, category: 'Brewery' },
  { id: 'phl-5', name: 'Zahav', city: 'Philadelphia', state: 'PA', location: { lat: 39.9428, lng: -75.1469, address: '237 St James Pl, Philadelphia, PA' }, pulseScore: 72, category: 'Restaurant' },
  { id: 'phl-6', name: 'The Ranstead Room', city: 'Philadelphia', state: 'PA', location: { lat: 39.9501, lng: -75.1608, address: '2013 Ranstead St, Philadelphia, PA' }, pulseScore: 60, category: 'Bar' },
]

// --- WASHINGTON DC ---
const DC_VENUES: Venue[] = [
  { id: 'dc-1', name: 'Echostage', city: 'Washington', state: 'DC', location: { lat: 38.9205, lng: -76.9532, address: '2135 Queens Chapel Rd NE, Washington, DC' }, pulseScore: 85, category: 'Nightclub' },
  { id: 'dc-2', name: '9:30 Club', city: 'Washington', state: 'DC', location: { lat: 38.9180, lng: -77.0239, address: '815 V St NW, Washington, DC' }, pulseScore: 78, category: 'Music Venue' },
  { id: 'dc-3', name: 'The Gibson', city: 'Washington', state: 'DC', location: { lat: 38.9180, lng: -77.0235, address: '2009 14th St NW, Washington, DC' }, pulseScore: 62, category: 'Bar' },
  { id: 'dc-4', name: 'Compass Coffee', city: 'Washington', state: 'DC', location: { lat: 38.9029, lng: -77.0296, address: '1535 7th St NW, Washington, DC' }, pulseScore: 40, category: 'Café' },
  { id: 'dc-5', name: 'Bluejacket', city: 'Washington', state: 'DC', location: { lat: 38.8744, lng: -76.9946, address: '300 Tingey St SE, Washington, DC' }, pulseScore: 55, category: 'Brewery' },
  { id: 'dc-6', name: 'Rasika', city: 'Washington', state: 'DC', location: { lat: 38.8937, lng: -77.0235, address: '633 D St NW, Washington, DC' }, pulseScore: 70, category: 'Restaurant' },
  { id: 'dc-7', name: 'Flash', city: 'Washington', state: 'DC', location: { lat: 38.9165, lng: -77.0226, address: '645 Florida Ave NW, Washington, DC' }, pulseScore: 80, category: 'Nightclub' },
  { id: 'dc-8', name: 'Black Cat', city: 'Washington', state: 'DC', location: { lat: 38.9175, lng: -77.0232, address: '1811 14th St NW, Washington, DC' }, pulseScore: 68, category: 'Music Venue' },
]

// --- SAN DIEGO ---
const SD_VENUES: Venue[] = [
  { id: 'sd-1', name: 'OMNIA San Diego', city: 'San Diego', state: 'CA', location: { lat: 32.7140, lng: -117.1620, address: '454 6th Ave, San Diego, CA' }, pulseScore: 82, category: 'Nightclub' },
  { id: 'sd-2', name: 'Casbah', city: 'San Diego', state: 'CA', location: { lat: 32.7489, lng: -117.1698, address: '2501 Kettner Blvd, San Diego, CA' }, pulseScore: 70, category: 'Music Venue' },
  { id: 'sd-3', name: 'Bird Rock Coffee', city: 'San Diego', state: 'CA', location: { lat: 32.8062, lng: -117.2402, address: '5627 La Jolla Blvd, San Diego, CA' }, pulseScore: 38, category: 'Café' },
  { id: 'sd-4', name: 'Stone Brewing', city: 'San Diego', state: 'CA', location: { lat: 32.8953, lng: -117.1152, address: '1999 Citracado Pkwy, Escondido, CA' }, pulseScore: 60, category: 'Brewery' },
  { id: 'sd-5', name: 'Juniper & Ivy', city: 'San Diego', state: 'CA', location: { lat: 32.7523, lng: -117.1715, address: '2228 Kettner Blvd, San Diego, CA' }, pulseScore: 68, category: 'Restaurant' },
  { id: 'sd-6', name: 'False Idol', city: 'San Diego', state: 'CA', location: { lat: 32.7505, lng: -117.1700, address: '675 W Beech St, San Diego, CA' }, pulseScore: 72, category: 'Bar' },
]

// --- HOUSTON ---
const HOUSTON_VENUES: Venue[] = [
  { id: 'hou-1', name: 'Clé', city: 'Houston', state: 'TX', location: { lat: 29.7456, lng: -95.3840, address: '2301 Main St, Houston, TX' }, pulseScore: 82, category: 'Nightclub' },
  { id: 'hou-2', name: 'Continental Club', city: 'Houston', state: 'TX', location: { lat: 29.7420, lng: -95.3845, address: '3700 Main St, Houston, TX' }, pulseScore: 68, category: 'Music Venue' },
  { id: 'hou-3', name: 'Boomtown Coffee', city: 'Houston', state: 'TX', location: { lat: 29.7858, lng: -95.3976, address: '242 W 19th St, Houston, TX' }, pulseScore: 35, category: 'Café' },
  { id: 'hou-4', name: 'Saint Arnold Brewing', city: 'Houston', state: 'TX', location: { lat: 29.7684, lng: -95.3543, address: '2000 Lyons Ave, Houston, TX' }, pulseScore: 55, category: 'Brewery' },
  { id: 'hou-5', name: 'Underbelly Hospitality', city: 'Houston', state: 'TX', location: { lat: 29.7502, lng: -95.3937, address: '1100 Westheimer Rd, Houston, TX' }, pulseScore: 72, category: 'Restaurant' },
  { id: 'hou-6', name: 'Julep', city: 'Houston', state: 'TX', location: { lat: 29.7420, lng: -95.3908, address: '1919 Washington Ave, Houston, TX' }, pulseScore: 60, category: 'Bar' },
]

// --- DETROIT ---
const DETROIT_VENUES: Venue[] = [
  { id: 'det-1', name: 'TV Lounge', city: 'Detroit', state: 'MI', location: { lat: 42.3347, lng: -83.0605, address: '2548 Grand River Ave, Detroit, MI' }, pulseScore: 88, category: 'Nightclub' },
  { id: 'det-2', name: 'Movement Electronic Music Festival Grounds', city: 'Detroit', state: 'MI', location: { lat: 42.3293, lng: -83.0438, address: 'Hart Plaza, 1 Hart Plaza, Detroit, MI' }, pulseScore: 92, category: 'Music Venue' },
  { id: 'det-3', name: 'El Club', city: 'Detroit', state: 'MI', location: { lat: 42.3181, lng: -83.0762, address: '4114 W Vernor Hwy, Detroit, MI' }, pulseScore: 78, category: 'Music Venue' },
  { id: 'det-4', name: 'Marble Bar', city: 'Detroit', state: 'MI', location: { lat: 42.3487, lng: -83.0557, address: '1501 Holden St, Detroit, MI' }, pulseScore: 82, category: 'Nightclub' },
  { id: 'det-5', name: 'The Sugar House', city: 'Detroit', state: 'MI', location: { lat: 42.3317, lng: -83.0469, address: '2130 Michigan Ave, Detroit, MI' }, pulseScore: 65, category: 'Bar' },
  { id: 'det-6', name: 'Astro Coffee', city: 'Detroit', state: 'MI', location: { lat: 42.3317, lng: -83.0802, address: '2124 Michigan Ave, Detroit, MI' }, pulseScore: 38, category: 'Café' },
  { id: 'det-7', name: 'Slows Bar BQ', city: 'Detroit', state: 'MI', location: { lat: 42.3317, lng: -83.0801, address: '2138 Michigan Ave, Detroit, MI' }, pulseScore: 68, category: 'Restaurant' },
  { id: 'det-8', name: 'Batch Brewing Company', city: 'Detroit', state: 'MI', location: { lat: 42.3332, lng: -83.0798, address: '1400 Porter St, Detroit, MI' }, pulseScore: 55, category: 'Brewery' },
  { id: 'det-9', name: 'The Majestic Theatre', city: 'Detroit', state: 'MI', location: { lat: 42.3434, lng: -83.0542, address: '4120 Woodward Ave, Detroit, MI' }, pulseScore: 75, category: 'Music Venue' },
  { id: 'det-10', name: 'Spotlite Detroit', city: 'Detroit', state: 'MI', location: { lat: 42.3445, lng: -83.0567, address: '2905 Beaubien St, Detroit, MI' }, pulseScore: 80, category: 'Nightclub' },
]

// --- PHOENIX ---
const PHOENIX_VENUES: Venue[] = [
  { id: 'phx-1', name: 'Maya Day + Nightclub', city: 'Phoenix', state: 'AZ', location: { lat: 33.4358, lng: -111.9310, address: '7333 E Indian Plaza, Scottsdale, AZ' }, pulseScore: 85, category: 'Nightclub' },
  { id: 'phx-2', name: 'The Van Buren', city: 'Phoenix', state: 'AZ', location: { lat: 33.4487, lng: -112.0653, address: '401 W Van Buren St, Phoenix, AZ' }, pulseScore: 78, category: 'Music Venue' },
  { id: 'phx-3', name: 'Crescent Ballroom', city: 'Phoenix', state: 'AZ', location: { lat: 33.4467, lng: -112.0731, address: '308 N 2nd Ave, Phoenix, AZ' }, pulseScore: 72, category: 'Music Venue' },
  { id: 'phx-4', name: 'Bitter & Twisted Cocktail Parlour', city: 'Phoenix', state: 'AZ', location: { lat: 33.4498, lng: -112.0731, address: '1 W Jefferson St, Phoenix, AZ' }, pulseScore: 68, category: 'Bar' },
  { id: 'phx-5', name: 'Cartel Coffee Lab', city: 'Phoenix', state: 'AZ', location: { lat: 33.4213, lng: -111.9263, address: '7124 E 1st St, Scottsdale, AZ' }, pulseScore: 40, category: 'Café' },
  { id: 'phx-6', name: 'Pizzeria Bianco', city: 'Phoenix', state: 'AZ', location: { lat: 33.4496, lng: -112.0653, address: '623 E Adams St, Phoenix, AZ' }, pulseScore: 72, category: 'Restaurant' },
  { id: 'phx-7', name: 'Wren House Brewing', city: 'Phoenix', state: 'AZ', location: { lat: 33.4637, lng: -112.0540, address: '2125 N 24th St, Phoenix, AZ' }, pulseScore: 58, category: 'Brewery' },
  { id: 'phx-8', name: 'Bar Smith', city: 'Phoenix', state: 'AZ', location: { lat: 33.4490, lng: -112.0689, address: '130 E Washington St, Phoenix, AZ' }, pulseScore: 75, category: 'Nightclub' },
  { id: 'phx-9', name: 'The Rhythm Room', city: 'Phoenix', state: 'AZ', location: { lat: 33.4618, lng: -112.0500, address: '1019 E Indian School Rd, Phoenix, AZ' }, pulseScore: 65, category: 'Music Venue' },
]

// --- DALLAS ---
const DALLAS_VENUES: Venue[] = [
  { id: 'dal-1', name: 'It\'ll Do Club', city: 'Dallas', state: 'TX', location: { lat: 32.7801, lng: -96.7936, address: '4322 Elm St, Dallas, TX' }, pulseScore: 82, category: 'Nightclub' },
  { id: 'dal-2', name: 'Trees', city: 'Dallas', state: 'TX', location: { lat: 32.7860, lng: -96.7969, address: '2709 Elm St, Dallas, TX' }, pulseScore: 72, category: 'Music Venue' },
  { id: 'dal-3', name: 'The Granada Theater', city: 'Dallas', state: 'TX', location: { lat: 32.8272, lng: -96.7697, address: '3524 Greenville Ave, Dallas, TX' }, pulseScore: 75, category: 'Music Venue' },
  { id: 'dal-4', name: 'Midnight Rambler', city: 'Dallas', state: 'TX', location: { lat: 32.7813, lng: -96.7975, address: '1530 Main St, Dallas, TX' }, pulseScore: 68, category: 'Bar' },
  { id: 'dal-5', name: 'Houndstooth Coffee', city: 'Dallas', state: 'TX', location: { lat: 32.8057, lng: -96.7941, address: '1900 N Henderson Ave, Dallas, TX' }, pulseScore: 38, category: 'Café' },
  { id: 'dal-6', name: 'Pecan Lodge', city: 'Dallas', state: 'TX', location: { lat: 32.7861, lng: -96.7868, address: '2702 Main St, Dallas, TX' }, pulseScore: 74, category: 'Restaurant' },
  { id: 'dal-7', name: 'Deep Ellum Brewing', city: 'Dallas', state: 'TX', location: { lat: 32.7820, lng: -96.7828, address: '2823 Saint Louis St, Dallas, TX' }, pulseScore: 58, category: 'Brewery' },
  { id: 'dal-8', name: 'Lizard Lounge', city: 'Dallas', state: 'TX', location: { lat: 32.7871, lng: -96.7954, address: '2424 Swiss Ave, Dallas, TX' }, pulseScore: 78, category: 'Nightclub' },
  { id: 'dal-9', name: 'The Rustic', city: 'Dallas', state: 'TX', location: { lat: 32.8039, lng: -96.7946, address: '3656 Howell St, Dallas, TX' }, pulseScore: 70, category: 'Lounge' },
]

// --- SALT LAKE CITY ---
const SLC_VENUES: Venue[] = [
  { id: 'slc-1', name: 'Sky SLC', city: 'Salt Lake City', state: 'UT', location: { lat: 40.7608, lng: -111.8911, address: '149 W Pierpont Ave, Salt Lake City, UT' }, pulseScore: 80, category: 'Nightclub' },
  { id: 'slc-2', name: 'The Depot', city: 'Salt Lake City', state: 'UT', location: { lat: 40.7678, lng: -111.9048, address: '13 N 400 W, Salt Lake City, UT' }, pulseScore: 75, category: 'Music Venue' },
  { id: 'slc-3', name: 'Urban Lounge', city: 'Salt Lake City', state: 'UT', location: { lat: 40.7547, lng: -111.8695, address: '241 S 500 E, Salt Lake City, UT' }, pulseScore: 72, category: 'Music Venue' },
  { id: 'slc-4', name: 'Water Witch Bar', city: 'Salt Lake City', state: 'UT', location: { lat: 40.7633, lng: -111.8914, address: '163 W 900 S, Salt Lake City, UT' }, pulseScore: 62, category: 'Bar' },
  { id: 'slc-5', name: 'La Barba Coffee', city: 'Salt Lake City', state: 'UT', location: { lat: 40.7604, lng: -111.8855, address: '327 W 200 S, Salt Lake City, UT' }, pulseScore: 38, category: 'Café' },
  { id: 'slc-6', name: 'Red Iguana', city: 'Salt Lake City', state: 'UT', location: { lat: 40.7707, lng: -111.9111, address: '736 W North Temple, Salt Lake City, UT' }, pulseScore: 70, category: 'Restaurant' },
  { id: 'slc-7', name: 'Epic Brewing', city: 'Salt Lake City', state: 'UT', location: { lat: 40.7534, lng: -111.8895, address: '825 S State St, Salt Lake City, UT' }, pulseScore: 55, category: 'Brewery' },
  { id: 'slc-8', name: 'The Great Saltair', city: 'Salt Lake City', state: 'UT', location: { lat: 40.7655, lng: -112.1031, address: '12408 Saltair Dr, Magna, UT' }, pulseScore: 68, category: 'Music Venue' },
]

// --- TAMPA ---
const TAMPA_VENUES: Venue[] = [
  { id: 'tpa-1', name: 'Club Prana', city: 'Tampa', state: 'FL', location: { lat: 27.9473, lng: -82.4585, address: '1619 E 7th Ave, Tampa, FL' }, pulseScore: 80, category: 'Nightclub' },
  { id: 'tpa-2', name: 'The Ritz Ybor', city: 'Tampa', state: 'FL', location: { lat: 27.9601, lng: -82.4371, address: '1503 E 7th Ave, Tampa, FL' }, pulseScore: 78, category: 'Music Venue' },
  { id: 'tpa-3', name: 'Crowbar', city: 'Tampa', state: 'FL', location: { lat: 27.9601, lng: -82.4357, address: '1812 17th St N, Tampa, FL' }, pulseScore: 72, category: 'Music Venue' },
  { id: 'tpa-4', name: 'The Hub', city: 'Tampa', state: 'FL', location: { lat: 27.9486, lng: -82.4612, address: '719 N Franklin St, Tampa, FL' }, pulseScore: 62, category: 'Bar' },
  { id: 'tpa-5', name: 'Buddy Brew Coffee', city: 'Tampa', state: 'FL', location: { lat: 27.9454, lng: -82.4572, address: '2020 N Adale Mabry Hwy, Tampa, FL' }, pulseScore: 40, category: 'Café' },
  { id: 'tpa-6', name: 'Columbia Restaurant', city: 'Tampa', state: 'FL', location: { lat: 27.9602, lng: -82.4363, address: '2117 E 7th Ave, Tampa, FL' }, pulseScore: 72, category: 'Restaurant' },
  { id: 'tpa-7', name: 'Cigar City Brewing', city: 'Tampa', state: 'FL', location: { lat: 27.9588, lng: -82.5100, address: '3924 W Spruce St, Tampa, FL' }, pulseScore: 62, category: 'Brewery' },
  { id: 'tpa-8', name: 'The Castle', city: 'Tampa', state: 'FL', location: { lat: 27.9603, lng: -82.4356, address: '2004 N 16th St, Tampa, FL' }, pulseScore: 76, category: 'Nightclub' },
  { id: 'tpa-9', name: 'Fly Bar & Restaurant', city: 'Tampa', state: 'FL', location: { lat: 27.9501, lng: -82.4582, address: '1202 N Franklin St, Tampa, FL' }, pulseScore: 60, category: 'Lounge' },
]

// --- CHARLOTTE ---
const CHARLOTTE_VENUES: Venue[] = [
  { id: 'clt-1', name: 'Label', city: 'Charlotte', state: 'NC', location: { lat: 35.2257, lng: -80.8423, address: '900 NC Music Factory Blvd, Charlotte, NC' }, pulseScore: 82, category: 'Nightclub' },
  { id: 'clt-2', name: 'The Fillmore Charlotte', city: 'Charlotte', state: 'NC', location: { lat: 35.2257, lng: -80.8451, address: '820 Hamilton St, Charlotte, NC' }, pulseScore: 78, category: 'Music Venue' },
  { id: 'clt-3', name: 'Neighborhood Theatre', city: 'Charlotte', state: 'NC', location: { lat: 35.2435, lng: -80.8124, address: '511 E 36th St, Charlotte, NC' }, pulseScore: 70, category: 'Music Venue' },
  { id: 'clt-4', name: 'The Cellar at Duckworth\'s', city: 'Charlotte', state: 'NC', location: { lat: 35.2271, lng: -80.8431, address: '330 N Tryon St, Charlotte, NC' }, pulseScore: 62, category: 'Bar' },
  { id: 'clt-5', name: 'Undercurrent Coffee', city: 'Charlotte', state: 'NC', location: { lat: 35.2243, lng: -80.8483, address: '2010 South Blvd, Charlotte, NC' }, pulseScore: 38, category: 'Café' },
  { id: 'clt-6', name: 'Midwood Smokehouse', city: 'Charlotte', state: 'NC', location: { lat: 35.2280, lng: -80.8123, address: '1401 Central Ave, Charlotte, NC' }, pulseScore: 68, category: 'Restaurant' },
  { id: 'clt-7', name: 'NoDa Brewing', city: 'Charlotte', state: 'NC', location: { lat: 35.2440, lng: -80.8118, address: '2921 N Tryon St, Charlotte, NC' }, pulseScore: 58, category: 'Brewery' },
  { id: 'clt-8', name: 'Roxbury Nightclub', city: 'Charlotte', state: 'NC', location: { lat: 35.2274, lng: -80.8437, address: '225 N Caldwell St, Charlotte, NC' }, pulseScore: 76, category: 'Nightclub' },
]

// --- PITTSBURGH ---
const PITTSBURGH_VENUES: Venue[] = [
  { id: 'pit-1', name: 'Cruze Bar', city: 'Pittsburgh', state: 'PA', location: { lat: 40.4484, lng: -79.9992, address: '1600 Smallman St, Pittsburgh, PA' }, pulseScore: 78, category: 'Nightclub' },
  { id: 'pit-2', name: 'Mr. Smalls Theatre', city: 'Pittsburgh', state: 'PA', location: { lat: 40.4727, lng: -79.9572, address: '400 Lincoln Ave, Millvale, PA' }, pulseScore: 75, category: 'Music Venue' },
  { id: 'pit-3', name: 'Stage AE', city: 'Pittsburgh', state: 'PA', location: { lat: 40.4467, lng: -80.0158, address: '400 N Shore Dr, Pittsburgh, PA' }, pulseScore: 80, category: 'Music Venue' },
  { id: 'pit-4', name: 'Speakeasy', city: 'Pittsburgh', state: 'PA', location: { lat: 40.4450, lng: -79.9959, address: '2000 Smallman St, Pittsburgh, PA' }, pulseScore: 65, category: 'Bar' },
  { id: 'pit-5', name: 'La Prima Espresso', city: 'Pittsburgh', state: 'PA', location: { lat: 40.4490, lng: -79.9911, address: '205 21st St, Pittsburgh, PA' }, pulseScore: 40, category: 'Café' },
  { id: 'pit-6', name: 'Primanti Bros.', city: 'Pittsburgh', state: 'PA', location: { lat: 40.4483, lng: -79.9980, address: '46 18th St, Pittsburgh, PA' }, pulseScore: 65, category: 'Restaurant' },
  { id: 'pit-7', name: 'Church Brew Works', city: 'Pittsburgh', state: 'PA', location: { lat: 40.4600, lng: -79.9529, address: '3525 Liberty Ave, Pittsburgh, PA' }, pulseScore: 62, category: 'Brewery' },
  { id: 'pit-8', name: 'Spirit', city: 'Pittsburgh', state: 'PA', location: { lat: 40.4650, lng: -79.9586, address: '242 51st St, Pittsburgh, PA' }, pulseScore: 72, category: 'Music Venue' },
  { id: 'pit-9', name: 'Goldmark', city: 'Pittsburgh', state: 'PA', location: { lat: 40.4397, lng: -80.0024, address: '707 Penn Ave, Pittsburgh, PA' }, pulseScore: 60, category: 'Lounge' },
]

// --- COLUMBUS ---
const COLUMBUS_VENUES: Venue[] = [
  { id: 'cmh-1', name: 'Skully\'s Music-Diner', city: 'Columbus', state: 'OH', location: { lat: 39.9834, lng: -83.0048, address: '1151 N High St, Columbus, OH' }, pulseScore: 78, category: 'Nightclub' },
  { id: 'cmh-2', name: 'Newport Music Hall', city: 'Columbus', state: 'OH', location: { lat: 39.9849, lng: -83.0073, address: '1722 N High St, Columbus, OH' }, pulseScore: 75, category: 'Music Venue' },
  { id: 'cmh-3', name: 'Ace of Cups', city: 'Columbus', state: 'OH', location: { lat: 39.9835, lng: -83.0063, address: '2619 N High St, Columbus, OH' }, pulseScore: 70, category: 'Music Venue' },
  { id: 'cmh-4', name: 'The Little Bar', city: 'Columbus', state: 'OH', location: { lat: 39.9776, lng: -83.0034, address: '1127 N High St, Columbus, OH' }, pulseScore: 62, category: 'Bar' },
  { id: 'cmh-5', name: 'Fox in the Snow Cafe', city: 'Columbus', state: 'OH', location: { lat: 39.9647, lng: -82.9876, address: '1031 N 4th St, Columbus, OH' }, pulseScore: 42, category: 'Café' },
  { id: 'cmh-6', name: 'The Pearl', city: 'Columbus', state: 'OH', location: { lat: 39.9694, lng: -82.9963, address: '641 N High St, Columbus, OH' }, pulseScore: 68, category: 'Restaurant' },
  { id: 'cmh-7', name: 'Land-Grant Brewing', city: 'Columbus', state: 'OH', location: { lat: 39.9556, lng: -82.9837, address: '424 W Town St, Columbus, OH' }, pulseScore: 58, category: 'Brewery' },
  { id: 'cmh-8', name: 'Dahlia Nightclub', city: 'Columbus', state: 'OH', location: { lat: 39.9706, lng: -83.0007, address: '684 N High St, Columbus, OH' }, pulseScore: 80, category: 'Nightclub' },
  { id: 'cmh-9', name: 'Rumba Cafe', city: 'Columbus', state: 'OH', location: { lat: 39.9647, lng: -82.9878, address: '2507 Summit St, Columbus, OH' }, pulseScore: 65, category: 'Lounge' },
]

// --- KANSAS CITY ---
const KC_VENUES: Venue[] = [
  { id: 'kc-1', name: 'Mosaic Ultra Lounge', city: 'Kansas City', state: 'MO', location: { lat: 39.0997, lng: -94.5786, address: '1331 Grand Blvd, Kansas City, MO' }, pulseScore: 80, category: 'Nightclub' },
  { id: 'kc-2', name: 'Knuckleheads Saloon', city: 'Kansas City', state: 'MO', location: { lat: 39.0912, lng: -94.5548, address: '2715 Rochester Ave, Kansas City, MO' }, pulseScore: 78, category: 'Music Venue' },
  { id: 'kc-3', name: 'The Truman', city: 'Kansas City', state: 'MO', location: { lat: 39.0867, lng: -94.5830, address: '601 E Truman Rd, Kansas City, MO' }, pulseScore: 75, category: 'Music Venue' },
  { id: 'kc-4', name: 'Green Lady Lounge', city: 'Kansas City', state: 'MO', location: { lat: 39.0560, lng: -94.5889, address: '1809 Grand Blvd, Kansas City, MO' }, pulseScore: 70, category: 'Bar' },
  { id: 'kc-5', name: 'Messenger Coffee Co.', city: 'Kansas City', state: 'MO', location: { lat: 39.0910, lng: -94.5780, address: '1624 Grand Blvd, Kansas City, MO' }, pulseScore: 40, category: 'Café' },
  { id: 'kc-6', name: 'Joe\'s Kansas City BBQ', city: 'Kansas City', state: 'MO', location: { lat: 39.0539, lng: -94.6277, address: '3002 W 47th Ave, Kansas City, KS' }, pulseScore: 75, category: 'Restaurant' },
  { id: 'kc-7', name: 'Boulevard Brewing Co.', city: 'Kansas City', state: 'MO', location: { lat: 39.0825, lng: -94.5989, address: '2534 Madison Ave, Kansas City, MO' }, pulseScore: 62, category: 'Brewery' },
  { id: 'kc-8', name: 'Riot Room', city: 'Kansas City', state: 'MO', location: { lat: 39.0560, lng: -94.5936, address: '4048 Broadway Blvd, Kansas City, MO' }, pulseScore: 68, category: 'Music Venue' },
  { id: 'kc-9', name: 'The Hey! Hey! Club', city: 'Kansas City', state: 'MO', location: { lat: 39.0547, lng: -94.5853, address: '4310 Main St, Kansas City, MO' }, pulseScore: 60, category: 'Lounge' },
]

// --- MILWAUKEE ---
const MILWAUKEE_VENUES: Venue[] = [
  { id: 'mke-1', name: 'The Rave / Eagles Club', city: 'Milwaukee', state: 'WI', location: { lat: 43.0430, lng: -87.9392, address: '2401 W Wisconsin Ave, Milwaukee, WI' }, pulseScore: 78, category: 'Music Venue' },
  { id: 'mke-2', name: 'The Cooperage', city: 'Milwaukee', state: 'WI', location: { lat: 43.0249, lng: -87.9049, address: '822 S Water St, Milwaukee, WI' }, pulseScore: 72, category: 'Music Venue' },
  { id: 'mke-3', name: 'Sabbatic', city: 'Milwaukee', state: 'WI', location: { lat: 43.0255, lng: -87.9211, address: '700 S 2nd St, Milwaukee, WI' }, pulseScore: 75, category: 'Nightclub' },
  { id: 'mke-4', name: 'Bryant\'s Cocktail Lounge', city: 'Milwaukee', state: 'WI', location: { lat: 43.0177, lng: -87.9313, address: '1579 S 9th St, Milwaukee, WI' }, pulseScore: 65, category: 'Bar' },
  { id: 'mke-5', name: 'Colectivo Coffee', city: 'Milwaukee', state: 'WI', location: { lat: 43.0442, lng: -87.8969, address: '2211 N Prospect Ave, Milwaukee, WI' }, pulseScore: 42, category: 'Café' },
  { id: 'mke-6', name: 'Lakefront Brewery', city: 'Milwaukee', state: 'WI', location: { lat: 43.0543, lng: -87.9052, address: '1872 N Commerce St, Milwaukee, WI' }, pulseScore: 62, category: 'Brewery' },
  { id: 'mke-7', name: 'Kopp\'s Frozen Custard', city: 'Milwaukee', state: 'WI', location: { lat: 43.0655, lng: -87.9748, address: '5373 N Port Washington Rd, Glendale, WI' }, pulseScore: 55, category: 'Restaurant' },
  { id: 'mke-8', name: 'Mad Planet', city: 'Milwaukee', state: 'WI', location: { lat: 43.0605, lng: -87.9082, address: '533 E Center St, Milwaukee, WI' }, pulseScore: 80, category: 'Nightclub' },
  { id: 'mke-9', name: 'At Random', city: 'Milwaukee', state: 'WI', location: { lat: 43.0150, lng: -87.9342, address: '2501 S Delaware Ave, Milwaukee, WI' }, pulseScore: 58, category: 'Lounge' },
]

// --- HONOLULU ---
const HONOLULU_VENUES: Venue[] = [
  { id: 'hnl-1', name: 'Addiction Nightclub', city: 'Honolulu', state: 'HI', location: { lat: 21.2866, lng: -157.8375, address: '1775 Ala Moana Blvd, Honolulu, HI' }, pulseScore: 82, category: 'Nightclub' },
  { id: 'hnl-2', name: 'The Republik', city: 'Honolulu', state: 'HI', location: { lat: 21.2925, lng: -157.8445, address: '1349 Kapi\'olani Blvd, Honolulu, HI' }, pulseScore: 75, category: 'Music Venue' },
  { id: 'hnl-3', name: 'Duke\'s Waikiki', city: 'Honolulu', state: 'HI', location: { lat: 21.2766, lng: -157.8274, address: '2335 Kalakaua Ave, Honolulu, HI' }, pulseScore: 70, category: 'Bar' },
  { id: 'hnl-4', name: 'Bar Leather Apron', city: 'Honolulu', state: 'HI', location: { lat: 21.3095, lng: -157.8610, address: '745 Fort Street Mall, Honolulu, HI' }, pulseScore: 68, category: 'Bar' },
  { id: 'hnl-5', name: 'Morning Glass Coffee', city: 'Honolulu', state: 'HI', location: { lat: 21.2892, lng: -157.8399, address: '2955 E Manoa Rd, Honolulu, HI' }, pulseScore: 40, category: 'Café' },
  { id: 'hnl-6', name: 'Helena\'s Hawaiian Food', city: 'Honolulu', state: 'HI', location: { lat: 21.3179, lng: -157.8660, address: '1240 N School St, Honolulu, HI' }, pulseScore: 65, category: 'Restaurant' },
  { id: 'hnl-7', name: 'Honolulu Beerworks', city: 'Honolulu', state: 'HI', location: { lat: 21.3034, lng: -157.8614, address: '328 Cooke St, Honolulu, HI' }, pulseScore: 55, category: 'Brewery' },
  { id: 'hnl-8', name: 'Scarlet Honolulu', city: 'Honolulu', state: 'HI', location: { lat: 21.2821, lng: -157.8317, address: '80 S Pauahi St, Honolulu, HI' }, pulseScore: 78, category: 'Nightclub' },
  { id: 'hnl-9', name: 'The Dragon Upstairs', city: 'Honolulu', state: 'HI', location: { lat: 21.3113, lng: -157.8623, address: '1038 Nu\'uanu Ave, Honolulu, HI' }, pulseScore: 62, category: 'Music Venue' },
]

// --- ANCHORAGE ---
const ANCHORAGE_VENUES: Venue[] = [
  { id: 'anc-1', name: 'Williwaw', city: 'Anchorage', state: 'AK', location: { lat: 61.2176, lng: -149.8836, address: '609 F St, Anchorage, AK' }, pulseScore: 78, category: 'Nightclub' },
  { id: 'anc-2', name: 'Bear Tooth Theatrepub', city: 'Anchorage', state: 'AK', location: { lat: 61.1973, lng: -149.9086, address: '1230 W 27th Ave, Anchorage, AK' }, pulseScore: 70, category: 'Music Venue' },
  { id: 'anc-3', name: 'Humpy\'s Great Alaskan Alehouse', city: 'Anchorage', state: 'AK', location: { lat: 61.2176, lng: -149.8820, address: '610 W 6th Ave, Anchorage, AK' }, pulseScore: 65, category: 'Bar' },
  { id: 'anc-4', name: '49th State Brewing', city: 'Anchorage', state: 'AK', location: { lat: 61.2176, lng: -149.8901, address: '717 W 3rd Ave, Anchorage, AK' }, pulseScore: 60, category: 'Brewery' },
  { id: 'anc-5', name: 'Side Street Espresso', city: 'Anchorage', state: 'AK', location: { lat: 61.2168, lng: -149.8875, address: '412 G St, Anchorage, AK' }, pulseScore: 35, category: 'Café' },
  { id: 'anc-6', name: 'Moose\'s Tooth', city: 'Anchorage', state: 'AK', location: { lat: 61.1956, lng: -149.8764, address: '3300 Old Seward Hwy, Anchorage, AK' }, pulseScore: 68, category: 'Restaurant' },
  { id: 'anc-7', name: 'Mad Myrna\'s', city: 'Anchorage', state: 'AK', location: { lat: 61.2170, lng: -149.8855, address: '530 E 5th Ave, Anchorage, AK' }, pulseScore: 72, category: 'Nightclub' },
  { id: 'anc-8', name: 'Cyrano\'s Theatre Company', city: 'Anchorage', state: 'AK', location: { lat: 61.2162, lng: -149.8923, address: '413 D St, Anchorage, AK' }, pulseScore: 55, category: 'Music Venue' },
]

/**
 * All US venues combined — Seattle + 30 other cities.
 * Import this alongside MOCK_VENUES for nationwide coverage.
 */
export const US_EXPANSION_VENUES: Venue[] = [
  ...NYC_VENUES,
  ...LA_VENUES,
  ...CHICAGO_VENUES,
  ...MIAMI_VENUES,
  ...AUSTIN_VENUES,
  ...NASHVILLE_VENUES,
  ...SF_VENUES,
  ...DENVER_VENUES,
  ...ATLANTA_VENUES,
  ...NOLA_VENUES,
  ...PORTLAND_VENUES,
  ...VEGAS_VENUES,
  ...BOSTON_VENUES,
  ...MINNEAPOLIS_VENUES,
  ...PHILLY_VENUES,
  ...DC_VENUES,
  ...SD_VENUES,
  ...HOUSTON_VENUES,
  ...DETROIT_VENUES,
  ...PHOENIX_VENUES,
  ...DALLAS_VENUES,
  ...SLC_VENUES,
  ...TAMPA_VENUES,
  ...CHARLOTTE_VENUES,
  ...PITTSBURGH_VENUES,
  ...COLUMBUS_VENUES,
  ...KC_VENUES,
  ...MILWAUKEE_VENUES,
  ...HONOLULU_VENUES,
  ...ANCHORAGE_VENUES,
]

/**
 * Major US city center coordinates for simulated location.
 */
export const US_CITY_LOCATIONS: Record<string, { lat: number; lng: number; name: string }> = {
  seattle: { lat: 47.6145, lng: -122.3205, name: 'Seattle, WA' },
  nyc: { lat: 40.7128, lng: -74.0060, name: 'New York, NY' },
  la: { lat: 34.0522, lng: -118.2437, name: 'Los Angeles, CA' },
  chicago: { lat: 41.8781, lng: -87.6298, name: 'Chicago, IL' },
  miami: { lat: 25.7617, lng: -80.1918, name: 'Miami, FL' },
  austin: { lat: 30.2672, lng: -97.7431, name: 'Austin, TX' },
  nashville: { lat: 36.1627, lng: -86.7816, name: 'Nashville, TN' },
  sf: { lat: 37.7749, lng: -122.4194, name: 'San Francisco, CA' },
  denver: { lat: 39.7392, lng: -104.9903, name: 'Denver, CO' },
  atlanta: { lat: 33.7490, lng: -84.3880, name: 'Atlanta, GA' },
  nola: { lat: 29.9511, lng: -90.0715, name: 'New Orleans, LA' },
  portland: { lat: 45.5152, lng: -122.6784, name: 'Portland, OR' },
  vegas: { lat: 36.1699, lng: -115.1398, name: 'Las Vegas, NV' },
  boston: { lat: 42.3601, lng: -71.0589, name: 'Boston, MA' },
  minneapolis: { lat: 44.9778, lng: -93.2650, name: 'Minneapolis, MN' },
  philly: { lat: 39.9526, lng: -75.1652, name: 'Philadelphia, PA' },
  dc: { lat: 38.9072, lng: -77.0369, name: 'Washington, DC' },
  sandiego: { lat: 32.7157, lng: -117.1611, name: 'San Diego, CA' },
  houston: { lat: 29.7604, lng: -95.3698, name: 'Houston, TX' },
  detroit: { lat: 42.3314, lng: -83.0458, name: 'Detroit, MI' },
  phoenix: { lat: 33.4484, lng: -112.0740, name: 'Phoenix, AZ' },
  dallas: { lat: 32.7767, lng: -96.7970, name: 'Dallas, TX' },
  slc: { lat: 40.7608, lng: -111.8910, name: 'Salt Lake City, UT' },
  tampa: { lat: 27.9506, lng: -82.4572, name: 'Tampa, FL' },
  charlotte: { lat: 35.2271, lng: -80.8431, name: 'Charlotte, NC' },
  pittsburgh: { lat: 40.4406, lng: -79.9959, name: 'Pittsburgh, PA' },
  columbus: { lat: 39.9612, lng: -82.9988, name: 'Columbus, OH' },
  kansascity: { lat: 39.0997, lng: -94.5786, name: 'Kansas City, MO' },
  milwaukee: { lat: 43.0389, lng: -87.9065, name: 'Milwaukee, WI' },
  honolulu: { lat: 21.3069, lng: -157.8583, name: 'Honolulu, HI' },
  anchorage: { lat: 61.2181, lng: -149.9003, name: 'Anchorage, AK' },
}

/**
 * Find the nearest city to a given location.
 */
export function getNearestCity(lat: number, lng: number): { key: string; name: string; distance: number } {
  let nearest = { key: 'seattle', name: 'Seattle, WA', distance: Infinity }

  for (const [key, city] of Object.entries(US_CITY_LOCATIONS)) {
    const R = 3958.8
    const dLat = ((city.lat - lat) * Math.PI) / 180
    const dLng = ((city.lng - lng) * Math.PI) / 180
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat * Math.PI) / 180) * Math.cos((city.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    const distance = R * c

    if (distance < nearest.distance) {
      nearest = { key, name: city.name, distance }
    }
  }

  return nearest
}

/**
 * DEV-only loader for US expansion venues. Returns empty array outside
 * of dev builds so production bundles don't include fixture data.
 */
export function loadUSVenueFixtures(): Venue[] {
  if (!import.meta.env.DEV) return []
  return US_EXPANSION_VENUES
}
