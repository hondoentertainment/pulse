import type { Venue } from './types'

/**
 * International city venues for global expansion.
 * Each city has 10-12 venues with a mix of categories.
 * The `state` field is used for country codes on international venues.
 */

// --- LONDON, UK ---
const LONDON_VENUES: Venue[] = [
  { id: 'lon-1', name: 'Fabric', city: 'London', state: 'UK', location: { lat: 51.5198, lng: -0.1055, address: '77A Charterhouse St, London EC1M 6HJ' }, pulseScore: 93, category: 'Nightclub' },
  { id: 'lon-2', name: 'Ministry of Sound', city: 'London', state: 'UK', location: { lat: 51.4986, lng: -0.1008, address: '103 Gaunt St, London SE1 6DP' }, pulseScore: 90, category: 'Nightclub' },
  { id: 'lon-3', name: 'KOKO', city: 'London', state: 'UK', location: { lat: 51.5393, lng: -0.1379, address: '1A Camden High St, London NW1 7JE' }, pulseScore: 82, category: 'Music Venue' },
  { id: 'lon-4', name: 'Ronnie Scott\'s', city: 'London', state: 'UK', location: { lat: 51.5133, lng: -0.1319, address: '47 Frith St, London W1D 4HT' }, pulseScore: 78, category: 'Music Venue' },
  { id: 'lon-5', name: 'The Connaught Bar', city: 'London', state: 'UK', location: { lat: 51.5109, lng: -0.1496, address: 'Carlos Pl, London W1K 2AL' }, pulseScore: 72, category: 'Bar' },
  { id: 'lon-6', name: 'Dishoom King\'s Cross', city: 'London', state: 'UK', location: { lat: 51.5352, lng: -0.1254, address: '5 Stable St, London N1C 4AB' }, pulseScore: 70, category: 'Restaurant' },
  { id: 'lon-7', name: 'Monmouth Coffee Borough', city: 'London', state: 'UK', location: { lat: 51.5049, lng: -0.0911, address: '2 Park St, London SE1 9AB' }, pulseScore: 40, category: 'Café' },
  { id: 'lon-8', name: 'The Bermondsey Beer Mile', city: 'London', state: 'UK', location: { lat: 51.4981, lng: -0.0778, address: 'Druid St, London SE1 2HH' }, pulseScore: 58, category: 'Brewery' },
  { id: 'lon-9', name: 'Printworks London', city: 'London', state: 'UK', location: { lat: 51.5069, lng: -0.0045, address: 'Surrey Quays Rd, London SE16 7PJ' }, pulseScore: 88, category: 'Nightclub' },
  { id: 'lon-10', name: 'Nightjar', city: 'London', state: 'UK', location: { lat: 51.5265, lng: -0.0877, address: '129 City Rd, London EC1V 1JB' }, pulseScore: 68, category: 'Lounge' },
  { id: 'lon-11', name: 'O2 Academy Brixton', city: 'London', state: 'UK', location: { lat: 51.4652, lng: -0.1152, address: '211 Stockwell Rd, London SW9 9SL' }, pulseScore: 80, category: 'Music Venue' },
  { id: 'lon-12', name: 'Sketch', city: 'London', state: 'UK', location: { lat: 51.5128, lng: -0.1400, address: '9 Conduit St, London W1S 2XG' }, pulseScore: 65, category: 'Restaurant' },
]

// --- TOKYO, JAPAN ---
const TOKYO_VENUES: Venue[] = [
  { id: 'tyo-1', name: 'Womb', city: 'Tokyo', state: 'JP', location: { lat: 35.6617, lng: 139.6978, address: '2-16 Maruyamacho, Shibuya, Tokyo' }, pulseScore: 90, category: 'Nightclub' },
  { id: 'tyo-2', name: 'Contact Tokyo', city: 'Tokyo', state: 'JP', location: { lat: 35.6552, lng: 139.6964, address: '2-10-12 Dogenzaka, Shibuya, Tokyo' }, pulseScore: 85, category: 'Nightclub' },
  { id: 'tyo-3', name: 'Blue Note Tokyo', city: 'Tokyo', state: 'JP', location: { lat: 35.6637, lng: 139.7222, address: '6-3-16 Minamiaoyama, Minato, Tokyo' }, pulseScore: 78, category: 'Music Venue' },
  { id: 'tyo-4', name: 'Liquid Room', city: 'Tokyo', state: 'JP', location: { lat: 35.6612, lng: 139.6963, address: '3-16-6 Higashi, Shibuya, Tokyo' }, pulseScore: 75, category: 'Music Venue' },
  { id: 'tyo-5', name: 'Bar High Five', city: 'Tokyo', state: 'JP', location: { lat: 35.6751, lng: 139.7648, address: '4F Efflore Ginza 5, Chuo, Tokyo' }, pulseScore: 70, category: 'Bar' },
  { id: 'tyo-6', name: 'Fuglen Tokyo', city: 'Tokyo', state: 'JP', location: { lat: 35.6651, lng: 139.6944, address: '1-16-11 Tomigaya, Shibuya, Tokyo' }, pulseScore: 42, category: 'Café' },
  { id: 'tyo-7', name: 'Ichiran Shibuya', city: 'Tokyo', state: 'JP', location: { lat: 35.6595, lng: 139.7005, address: '1-22-7 Jinnan, Shibuya, Tokyo' }, pulseScore: 65, category: 'Restaurant' },
  { id: 'tyo-8', name: 'Baird Beer Harajuku Taproom', city: 'Tokyo', state: 'JP', location: { lat: 35.6690, lng: 139.7073, address: '1-20-13 Jingumae, Shibuya, Tokyo' }, pulseScore: 55, category: 'Brewery' },
  { id: 'tyo-9', name: 'Ageha', city: 'Tokyo', state: 'JP', location: { lat: 35.6419, lng: 139.7887, address: '2-2-10 Shinkiba, Koto, Tokyo' }, pulseScore: 88, category: 'Nightclub' },
  { id: 'tyo-10', name: 'New York Bar (Park Hyatt)', city: 'Tokyo', state: 'JP', location: { lat: 35.6867, lng: 139.6917, address: '3-7-1-2 Nishishinjuku, Shinjuku, Tokyo' }, pulseScore: 72, category: 'Lounge' },
  { id: 'tyo-11', name: 'Billboard Live Tokyo', city: 'Tokyo', state: 'JP', location: { lat: 35.6597, lng: 139.7293, address: '4F Tokyo Midtown, 9-7-4 Akasaka, Minato, Tokyo' }, pulseScore: 68, category: 'Music Venue' },
  { id: 'tyo-12', name: 'Gonpachi Nishiazabu', city: 'Tokyo', state: 'JP', location: { lat: 35.6577, lng: 139.7248, address: '1-13-11 Nishiazabu, Minato, Tokyo' }, pulseScore: 60, category: 'Restaurant' },
]

// --- BERLIN, GERMANY ---
const BERLIN_VENUES: Venue[] = [
  { id: 'ber-1', name: 'Berghain', city: 'Berlin', state: 'DE', location: { lat: 52.5108, lng: 13.4426, address: 'Am Wriezener Bhf, 10243 Berlin' }, pulseScore: 95, category: 'Nightclub' },
  { id: 'ber-2', name: 'Tresor', city: 'Berlin', state: 'DE', location: { lat: 52.5098, lng: 13.4200, address: 'Köpenicker Str. 70, 10179 Berlin' }, pulseScore: 88, category: 'Nightclub' },
  { id: 'ber-3', name: 'Watergate', city: 'Berlin', state: 'DE', location: { lat: 52.5018, lng: 13.4425, address: 'Falckensteinstraße 49, 10997 Berlin' }, pulseScore: 85, category: 'Nightclub' },
  { id: 'ber-4', name: 'SO36', city: 'Berlin', state: 'DE', location: { lat: 52.4989, lng: 13.4287, address: 'Oranienstraße 190, 10999 Berlin' }, pulseScore: 75, category: 'Music Venue' },
  { id: 'ber-5', name: 'Lido Berlin', city: 'Berlin', state: 'DE', location: { lat: 52.4952, lng: 13.4411, address: 'Cuvrystraße 7, 10997 Berlin' }, pulseScore: 70, category: 'Music Venue' },
  { id: 'ber-6', name: 'Buck and Breck', city: 'Berlin', state: 'DE', location: { lat: 52.5313, lng: 13.3917, address: 'Brunnenstraße 177, 10119 Berlin' }, pulseScore: 65, category: 'Bar' },
  { id: 'ber-7', name: 'The Barn Coffee', city: 'Berlin', state: 'DE', location: { lat: 52.5292, lng: 13.4064, address: 'Schönhauser Allee 8, 10119 Berlin' }, pulseScore: 38, category: 'Café' },
  { id: 'ber-8', name: 'Markthalle Neun', city: 'Berlin', state: 'DE', location: { lat: 52.5004, lng: 13.4348, address: 'Eisenbahnstraße 42/43, 10997 Berlin' }, pulseScore: 62, category: 'Restaurant' },
  { id: 'ber-9', name: 'BRLO Brwhouse', city: 'Berlin', state: 'DE', location: { lat: 52.5011, lng: 13.3813, address: 'Schöneberger Str. 16, 10963 Berlin' }, pulseScore: 55, category: 'Brewery' },
  { id: 'ber-10', name: 'Clärchens Ballhaus', city: 'Berlin', state: 'DE', location: { lat: 52.5294, lng: 13.3938, address: 'Auguststraße 24, 10117 Berlin' }, pulseScore: 72, category: 'Lounge' },
  { id: 'ber-11', name: 'Astra Kulturhaus', city: 'Berlin', state: 'DE', location: { lat: 52.5112, lng: 13.4512, address: 'Revaler Str. 99, 10245 Berlin' }, pulseScore: 78, category: 'Music Venue' },
]

// --- MEXICO CITY, MEXICO ---
const CDMX_VENUES: Venue[] = [
  { id: 'cdmx-1', name: 'AM Local', city: 'Mexico City', state: 'MX', location: { lat: 19.4219, lng: -99.1671, address: 'Tonalá 23, Roma Nte., 06700 CDMX' }, pulseScore: 82, category: 'Nightclub' },
  { id: 'cdmx-2', name: 'Patrick Miller', city: 'Mexico City', state: 'MX', location: { lat: 19.4222, lng: -99.1625, address: 'Mérida 17, Roma Nte., 06700 CDMX' }, pulseScore: 85, category: 'Nightclub' },
  { id: 'cdmx-3', name: 'Salón Los Ángeles', city: 'Mexico City', state: 'MX', location: { lat: 19.4444, lng: -99.1503, address: 'Lerdo 206, Guerrero, 06300 CDMX' }, pulseScore: 78, category: 'Music Venue' },
  { id: 'cdmx-4', name: 'Foro Indie Rocks!', city: 'Mexico City', state: 'MX', location: { lat: 19.4142, lng: -99.1640, address: 'Zacatecas 39, Roma Nte., 06700 CDMX' }, pulseScore: 72, category: 'Music Venue' },
  { id: 'cdmx-5', name: 'Licorería Limantour', city: 'Mexico City', state: 'MX', location: { lat: 19.4203, lng: -99.1668, address: 'Álvaro Obregón 106, Roma Nte., 06700 CDMX' }, pulseScore: 70, category: 'Bar' },
  { id: 'cdmx-6', name: 'Café de Nadie', city: 'Mexico City', state: 'MX', location: { lat: 19.4192, lng: -99.1551, address: 'Mérida 67, Roma Nte., 06700 CDMX' }, pulseScore: 42, category: 'Café' },
  { id: 'cdmx-7', name: 'Pujol', city: 'Mexico City', state: 'MX', location: { lat: 19.4327, lng: -99.1891, address: 'Tennyson 133, Polanco, 11560 CDMX' }, pulseScore: 75, category: 'Restaurant' },
  { id: 'cdmx-8', name: 'Falling Piano Brewing Co.', city: 'Mexico City', state: 'MX', location: { lat: 19.4168, lng: -99.1574, address: 'Mérida 132, Roma Nte., 06700 CDMX' }, pulseScore: 52, category: 'Brewery' },
  { id: 'cdmx-9', name: 'Jules Basement', city: 'Mexico City', state: 'MX', location: { lat: 19.4329, lng: -99.1893, address: 'Julio Verne 93, Polanco, 11560 CDMX' }, pulseScore: 68, category: 'Lounge' },
  { id: 'cdmx-10', name: 'El Plaza Condesa', city: 'Mexico City', state: 'MX', location: { lat: 19.4116, lng: -99.1729, address: 'Juan Escutia 4, Condesa, 06140 CDMX' }, pulseScore: 80, category: 'Music Venue' },
  { id: 'cdmx-11', name: 'Contramar', city: 'Mexico City', state: 'MX', location: { lat: 19.4186, lng: -99.1634, address: 'Durango 200, Roma Nte., 06700 CDMX' }, pulseScore: 72, category: 'Restaurant' },
]

// --- TORONTO, CANADA ---
const TORONTO_VENUES: Venue[] = [
  { id: 'tor-1', name: 'Rebel', city: 'Toronto', state: 'CA', location: { lat: 43.6361, lng: -79.3432, address: '11 Polson St, Toronto, ON M5A 1A4' }, pulseScore: 88, category: 'Nightclub' },
  { id: 'tor-2', name: 'CODA', city: 'Toronto', state: 'CA', location: { lat: 43.6558, lng: -79.4146, address: '794 Bathurst St, Toronto, ON M5S 2R6' }, pulseScore: 82, category: 'Nightclub' },
  { id: 'tor-3', name: 'The Horseshoe Tavern', city: 'Toronto', state: 'CA', location: { lat: 43.6477, lng: -79.3988, address: '370 Queen St W, Toronto, ON M5V 2A2' }, pulseScore: 72, category: 'Music Venue' },
  { id: 'tor-4', name: 'The Rex Hotel Jazz & Blues Bar', city: 'Toronto', state: 'CA', location: { lat: 43.6499, lng: -79.3934, address: '194 Queen St W, Toronto, ON M5V 1Z1' }, pulseScore: 68, category: 'Music Venue' },
  { id: 'tor-5', name: 'Bar Raval', city: 'Toronto', state: 'CA', location: { lat: 43.6572, lng: -79.4098, address: '505 College St, Toronto, ON M6G 1A8' }, pulseScore: 65, category: 'Bar' },
  { id: 'tor-6', name: 'Sam James Coffee Bar', city: 'Toronto', state: 'CA', location: { lat: 43.6541, lng: -79.4050, address: '297 Harbord St, Toronto, ON M6G 1G7' }, pulseScore: 38, category: 'Café' },
  { id: 'tor-7', name: 'Canoe Restaurant', city: 'Toronto', state: 'CA', location: { lat: 43.6478, lng: -79.3812, address: '66 Wellington St W, Toronto, ON M5K 1H6' }, pulseScore: 70, category: 'Restaurant' },
  { id: 'tor-8', name: 'Bellwoods Brewery', city: 'Toronto', state: 'CA', location: { lat: 43.6465, lng: -79.4186, address: '124 Ossington Ave, Toronto, ON M6J 2Z5' }, pulseScore: 60, category: 'Brewery' },
  { id: 'tor-9', name: 'Toybox', city: 'Toronto', state: 'CA', location: { lat: 43.6431, lng: -79.4006, address: '473 Adelaide St W, Toronto, ON M5V 1T1' }, pulseScore: 78, category: 'Nightclub' },
  { id: 'tor-10', name: 'Civil Liberties', city: 'Toronto', state: 'CA', location: { lat: 43.6481, lng: -79.4190, address: '878 Bloor St W, Toronto, ON M6G 1M4' }, pulseScore: 62, category: 'Lounge' },
  { id: 'tor-11', name: 'Lee\'s Palace', city: 'Toronto', state: 'CA', location: { lat: 43.6648, lng: -79.4110, address: '529 Bloor St W, Toronto, ON M5S 1Y5' }, pulseScore: 75, category: 'Music Venue' },
]

// --- SYDNEY, AUSTRALIA ---
const SYDNEY_VENUES: Venue[] = [
  { id: 'syd-1', name: 'Chinese Laundry', city: 'Sydney', state: 'AU', location: { lat: -33.8813, lng: 151.2008, address: '111 Sussex St, Sydney NSW 2000' }, pulseScore: 85, category: 'Nightclub' },
  { id: 'syd-2', name: 'Ivy Pool Club', city: 'Sydney', state: 'AU', location: { lat: -33.8689, lng: 151.2078, address: '330 George St, Sydney NSW 2000' }, pulseScore: 82, category: 'Nightclub' },
  { id: 'syd-3', name: 'The Enmore Theatre', city: 'Sydney', state: 'AU', location: { lat: -33.8983, lng: 151.1735, address: '118-132 Enmore Rd, Newtown NSW 2042' }, pulseScore: 78, category: 'Music Venue' },
  { id: 'syd-4', name: 'Oxford Art Factory', city: 'Sydney', state: 'AU', location: { lat: -33.8794, lng: 151.2130, address: '38-46 Oxford St, Darlinghurst NSW 2010' }, pulseScore: 72, category: 'Music Venue' },
  { id: 'syd-5', name: 'Maybe Sammy', city: 'Sydney', state: 'AU', location: { lat: -33.8605, lng: 151.2073, address: '115 Harrington St, The Rocks NSW 2000' }, pulseScore: 70, category: 'Bar' },
  { id: 'syd-6', name: 'Single O Surry Hills', city: 'Sydney', state: 'AU', location: { lat: -33.8849, lng: 151.2131, address: '60-64 Reservoir St, Surry Hills NSW 2010' }, pulseScore: 40, category: 'Café' },
  { id: 'syd-7', name: 'Quay Restaurant', city: 'Sydney', state: 'AU', location: { lat: -33.8568, lng: 151.2098, address: 'Upper Level, Overseas Passenger Terminal, The Rocks NSW 2000' }, pulseScore: 72, category: 'Restaurant' },
  { id: 'syd-8', name: 'Young Henrys', city: 'Sydney', state: 'AU', location: { lat: -33.8974, lng: 151.1746, address: '76 Wilford St, Newtown NSW 2042' }, pulseScore: 58, category: 'Brewery' },
  { id: 'syd-9', name: 'Marquee Sydney', city: 'Sydney', state: 'AU', location: { lat: -33.8689, lng: 151.2093, address: 'The Star, 80 Pyrmont St, Pyrmont NSW 2009' }, pulseScore: 80, category: 'Nightclub' },
  { id: 'syd-10', name: 'Baxter Inn', city: 'Sydney', state: 'AU', location: { lat: -33.8695, lng: 151.2053, address: '152-156 Clarence St, Sydney NSW 2000' }, pulseScore: 66, category: 'Lounge' },
  { id: 'syd-11', name: 'The Metro Theatre', city: 'Sydney', state: 'AU', location: { lat: -33.8741, lng: 151.2067, address: '624 George St, Sydney NSW 2000' }, pulseScore: 74, category: 'Music Venue' },
]

// --- SEOUL, SOUTH KOREA ---
const SEOUL_VENUES: Venue[] = [
  { id: 'sel-1', name: 'Cakeshop', city: 'Seoul', state: 'KR', location: { lat: 37.5561, lng: 126.9926, address: '134 Itaewon-ro, Yongsan-gu, Seoul' }, pulseScore: 85, category: 'Nightclub' },
  { id: 'sel-2', name: 'Octagon', city: 'Seoul', state: 'KR', location: { lat: 37.5213, lng: 127.0328, address: '645 Nonhyeon-ro, Gangnam-gu, Seoul' }, pulseScore: 90, category: 'Nightclub' },
  { id: 'sel-3', name: 'Club Soap', city: 'Seoul', state: 'KR', location: { lat: 37.5569, lng: 126.9912, address: '119 Itaewon-ro, Yongsan-gu, Seoul' }, pulseScore: 78, category: 'Nightclub' },
  { id: 'sel-4', name: 'MUV Hall', city: 'Seoul', state: 'KR', location: { lat: 37.5572, lng: 127.0480, address: '97 Wangsimni-ro, Seongdong-gu, Seoul' }, pulseScore: 72, category: 'Music Venue' },
  { id: 'sel-5', name: 'Jongno 3-ga Pojangmacha Strip', city: 'Seoul', state: 'KR', location: { lat: 37.5710, lng: 126.9920, address: 'Jongno 3-ga, Jongno-gu, Seoul' }, pulseScore: 68, category: 'Bar' },
  { id: 'sel-6', name: 'Fritz Coffee Company', city: 'Seoul', state: 'KR', location: { lat: 37.5565, lng: 126.9700, address: '17 Dokseo-dang-ro, Mapo-gu, Seoul' }, pulseScore: 42, category: 'Café' },
  { id: 'sel-7', name: 'Jungsik', city: 'Seoul', state: 'KR', location: { lat: 37.5246, lng: 127.0403, address: '11 Seolleung-ro 158-gil, Gangnam-gu, Seoul' }, pulseScore: 70, category: 'Restaurant' },
  { id: 'sel-8', name: 'Amazing Brewing Co.', city: 'Seoul', state: 'KR', location: { lat: 37.5432, lng: 127.0551, address: '16 Seongsui-ro 7-gil, Seongdong-gu, Seoul' }, pulseScore: 55, category: 'Brewery' },
  { id: 'sel-9', name: 'Alice Cheongdam', city: 'Seoul', state: 'KR', location: { lat: 37.5244, lng: 127.0494, address: '18 Dosan-daero 67-gil, Gangnam-gu, Seoul' }, pulseScore: 82, category: 'Lounge' },
  { id: 'sel-10', name: 'Gwangjang Market Night Eats', city: 'Seoul', state: 'KR', location: { lat: 37.5700, lng: 126.9996, address: '88 Changgyeonggung-ro, Jongno-gu, Seoul' }, pulseScore: 65, category: 'Restaurant' },
  { id: 'sel-11', name: 'Rolling Hall', city: 'Seoul', state: 'KR', location: { lat: 37.5486, lng: 127.0465, address: '38 Achasan-ro, Seongdong-gu, Seoul' }, pulseScore: 74, category: 'Music Venue' },
]

// --- BANGKOK, THAILAND ---
const BANGKOK_VENUES: Venue[] = [
  { id: 'bkk-1', name: 'Onyx', city: 'Bangkok', state: 'TH', location: { lat: 13.7483, lng: 100.5335, address: 'RCA, 29 Soi Soonvijai, Din Daeng, Bangkok' }, pulseScore: 88, category: 'Nightclub' },
  { id: 'bkk-2', name: 'Sing Sing Theater', city: 'Bangkok', state: 'TH', location: { lat: 13.7355, lng: 100.5510, address: '45 Sukhumvit Soi 45, Watthana, Bangkok' }, pulseScore: 82, category: 'Nightclub' },
  { id: 'bkk-3', name: 'Saxophone Pub', city: 'Bangkok', state: 'TH', location: { lat: 13.7630, lng: 100.5388, address: '3/8 Phayathai Rd, Ratchathewi, Bangkok' }, pulseScore: 72, category: 'Music Venue' },
  { id: 'bkk-4', name: 'Bamboo Bar (Mandarin Oriental)', city: 'Bangkok', state: 'TH', location: { lat: 13.7234, lng: 100.5158, address: '48 Oriental Ave, Bang Rak, Bangkok' }, pulseScore: 75, category: 'Bar' },
  { id: 'bkk-5', name: 'Teens of Thailand', city: 'Bangkok', state: 'TH', location: { lat: 13.7399, lng: 100.5072, address: '76 Soi Nana, Phra Nakhon, Bangkok' }, pulseScore: 65, category: 'Bar' },
  { id: 'bkk-6', name: 'Roots Coffee', city: 'Bangkok', state: 'TH', location: { lat: 13.7381, lng: 100.5545, address: 'The Commons, 335 Sukhumvit Soi 17, Bangkok' }, pulseScore: 40, category: 'Café' },
  { id: 'bkk-7', name: 'Gaggan Anand', city: 'Bangkok', state: 'TH', location: { lat: 13.7405, lng: 100.5467, address: '68/1 Soi Langsuan, Lumphini, Bangkok' }, pulseScore: 72, category: 'Restaurant' },
  { id: 'bkk-8', name: 'Devanom Craft Beer', city: 'Bangkok', state: 'TH', location: { lat: 13.7362, lng: 100.5530, address: '1/4-5 Sukhumvit Soi 33, Watthana, Bangkok' }, pulseScore: 52, category: 'Brewery' },
  { id: 'bkk-9', name: 'Vesper', city: 'Bangkok', state: 'TH', location: { lat: 13.7360, lng: 100.5417, address: '10/15 Convent Rd, Silom, Bang Rak, Bangkok' }, pulseScore: 68, category: 'Lounge' },
  { id: 'bkk-10', name: 'Beam', city: 'Bangkok', state: 'TH', location: { lat: 13.7369, lng: 100.5568, address: '72 Sukhumvit Soi 55, Watthana, Bangkok' }, pulseScore: 80, category: 'Music Venue' },
  { id: 'bkk-11', name: 'Jay Fai', city: 'Bangkok', state: 'TH', location: { lat: 13.7534, lng: 100.5042, address: '327 Maha Chai Rd, Phra Nakhon, Bangkok' }, pulseScore: 70, category: 'Restaurant' },
]

// --- BARCELONA, SPAIN ---
const BARCELONA_VENUES: Venue[] = [
  { id: 'bcn-1', name: 'Razzmatazz', city: 'Barcelona', state: 'ES', location: { lat: 41.3974, lng: 2.1917, address: 'Carrer dels Almogàvers, 122, 08018 Barcelona' }, pulseScore: 88, category: 'Nightclub' },
  { id: 'bcn-2', name: 'Opium Barcelona', city: 'Barcelona', state: 'ES', location: { lat: 41.3848, lng: 2.2005, address: 'Passeig Marítim de la Barceloneta, 34, 08003 Barcelona' }, pulseScore: 82, category: 'Nightclub' },
  { id: 'bcn-3', name: 'Sala Apolo', city: 'Barcelona', state: 'ES', location: { lat: 41.3743, lng: 2.1680, address: 'Carrer Nou de la Rambla, 113, 08004 Barcelona' }, pulseScore: 80, category: 'Music Venue' },
  { id: 'bcn-4', name: 'Jamboree Jazz Club', city: 'Barcelona', state: 'ES', location: { lat: 41.3800, lng: 2.1742, address: 'Plaça Reial, 17, 08002 Barcelona' }, pulseScore: 72, category: 'Music Venue' },
  { id: 'bcn-5', name: 'Paradiso', city: 'Barcelona', state: 'ES', location: { lat: 41.3846, lng: 2.1837, address: 'Carrer de Rera Palau, 4, 08003 Barcelona' }, pulseScore: 70, category: 'Bar' },
  { id: 'bcn-6', name: 'Satan\'s Coffee Corner', city: 'Barcelona', state: 'ES', location: { lat: 41.3841, lng: 2.1750, address: 'Carrer de l\'Arc de Sant Ramon del Call, 11, 08002 Barcelona' }, pulseScore: 42, category: 'Café' },
  { id: 'bcn-7', name: 'Tickets Bar', city: 'Barcelona', state: 'ES', location: { lat: 41.3721, lng: 2.1612, address: 'Avinguda del Paral·lel, 164, 08015 Barcelona' }, pulseScore: 75, category: 'Restaurant' },
  { id: 'bcn-8', name: 'Cervecería La Cervecita Nuestra de Cada Día', city: 'Barcelona', state: 'ES', location: { lat: 41.3900, lng: 2.1612, address: 'Carrer del Parlament, 25, 08015 Barcelona' }, pulseScore: 55, category: 'Brewery' },
  { id: 'bcn-9', name: 'Dry Martini', city: 'Barcelona', state: 'ES', location: { lat: 41.3916, lng: 2.1533, address: 'Carrer d\'Aribau, 162, 08036 Barcelona' }, pulseScore: 66, category: 'Lounge' },
  { id: 'bcn-10', name: 'Pacha Barcelona', city: 'Barcelona', state: 'ES', location: { lat: 41.3853, lng: 2.1945, address: 'Passeig Marítim de la Barceloneta, 38, 08003 Barcelona' }, pulseScore: 85, category: 'Nightclub' },
  { id: 'bcn-11', name: 'Cal Pep', city: 'Barcelona', state: 'ES', location: { lat: 41.3838, lng: 2.1822, address: 'Plaça de les Olles, 8, 08003 Barcelona' }, pulseScore: 68, category: 'Restaurant' },
]

// --- AMSTERDAM, NETHERLANDS ---
const AMSTERDAM_VENUES: Venue[] = [
  { id: 'ams-1', name: 'De School', city: 'Amsterdam', state: 'NL', location: { lat: 52.3471, lng: 4.8427, address: 'Doctor Jan van Breemenstraat 1, 1056 AB Amsterdam' }, pulseScore: 88, category: 'Nightclub' },
  { id: 'ams-2', name: 'Shelter', city: 'Amsterdam', state: 'NL', location: { lat: 52.3836, lng: 4.9028, address: 'Overhoeksplein 3, 1031 KS Amsterdam' }, pulseScore: 85, category: 'Nightclub' },
  { id: 'ams-3', name: 'Paradiso', city: 'Amsterdam', state: 'NL', location: { lat: 52.3622, lng: 4.8837, address: 'Weteringschans 6-8, 1017 SG Amsterdam' }, pulseScore: 82, category: 'Music Venue' },
  { id: 'ams-4', name: 'Melkweg', city: 'Amsterdam', state: 'NL', location: { lat: 52.3645, lng: 4.8820, address: 'Lijnbaansgracht 234A, 1017 PH Amsterdam' }, pulseScore: 80, category: 'Music Venue' },
  { id: 'ams-5', name: 'Tales & Spirits', city: 'Amsterdam', state: 'NL', location: { lat: 52.3697, lng: 4.8919, address: 'Lijnbaansteeg 5-7, 1012 TE Amsterdam' }, pulseScore: 68, category: 'Bar' },
  { id: 'ams-6', name: 'Lot Sixty One Coffee', city: 'Amsterdam', state: 'NL', location: { lat: 52.3676, lng: 4.8671, address: 'Kinkerstraat 112, 1053 ED Amsterdam' }, pulseScore: 40, category: 'Café' },
  { id: 'ams-7', name: 'Rijks Restaurant', city: 'Amsterdam', state: 'NL', location: { lat: 52.3600, lng: 4.8852, address: 'Museumstraat 2, 1071 XX Amsterdam' }, pulseScore: 72, category: 'Restaurant' },
  { id: 'ams-8', name: 'Brouwerij \'t IJ', city: 'Amsterdam', state: 'NL', location: { lat: 52.3664, lng: 4.9264, address: 'Funenkade 7, 1018 AL Amsterdam' }, pulseScore: 62, category: 'Brewery' },
  { id: 'ams-9', name: 'Air Amsterdam', city: 'Amsterdam', state: 'NL', location: { lat: 52.3594, lng: 4.8942, address: 'Amstelstraat 16, 1017 DA Amsterdam' }, pulseScore: 78, category: 'Nightclub' },
  { id: 'ams-10', name: 'Door 74', city: 'Amsterdam', state: 'NL', location: { lat: 52.3656, lng: 4.8818, address: 'Reguliersdwarsstraat 74, 1017 BN Amsterdam' }, pulseScore: 65, category: 'Lounge' },
  { id: 'ams-11', name: 'Bimhuis', city: 'Amsterdam', state: 'NL', location: { lat: 52.3790, lng: 4.9098, address: 'Piet Heinkade 3, 1019 BR Amsterdam' }, pulseScore: 70, category: 'Music Venue' },
]

// --- BUENOS AIRES, ARGENTINA ---
const BUENOSAIRES_VENUES: Venue[] = [
  { id: 'bue-1', name: 'Crobar', city: 'Buenos Aires', state: 'AR', location: { lat: -34.5834, lng: -58.4209, address: 'Av. Pres. Figueroa Alcorta 6400, C1426 CABA' }, pulseScore: 88, category: 'Nightclub' },
  { id: 'bue-2', name: 'Niceto Club', city: 'Buenos Aires', state: 'AR', location: { lat: -34.5878, lng: -58.4353, address: 'Niceto Vega 5510, C1414 CABA' }, pulseScore: 82, category: 'Nightclub' },
  { id: 'bue-3', name: 'La Trastienda', city: 'Buenos Aires', state: 'AR', location: { lat: -34.6213, lng: -58.3822, address: 'Balcarce 460, C1064 CABA' }, pulseScore: 75, category: 'Music Venue' },
  { id: 'bue-4', name: 'Thelonious Club', city: 'Buenos Aires', state: 'AR', location: { lat: -34.6032, lng: -58.3938, address: 'Nicaragua 5549, C1414 CABA' }, pulseScore: 70, category: 'Music Venue' },
  { id: 'bue-5', name: 'Florería Atlántico', city: 'Buenos Aires', state: 'AR', location: { lat: -34.5909, lng: -58.3824, address: 'Arroyo 872, C1007 CABA' }, pulseScore: 72, category: 'Bar' },
  { id: 'bue-6', name: 'LAB Tostadores de Café', city: 'Buenos Aires', state: 'AR', location: { lat: -34.5874, lng: -58.4302, address: 'Humboldt 1542, C1414 CABA' }, pulseScore: 40, category: 'Café' },
  { id: 'bue-7', name: 'Don Julio', city: 'Buenos Aires', state: 'AR', location: { lat: -34.5883, lng: -58.4276, address: 'Guatemala 4699, C1425 CABA' }, pulseScore: 75, category: 'Restaurant' },
  { id: 'bue-8', name: 'Cervecería Antares', city: 'Buenos Aires', state: 'AR', location: { lat: -34.5870, lng: -58.4327, address: 'Armenia 1447, C1414 CABA' }, pulseScore: 55, category: 'Brewery' },
  { id: 'bue-9', name: 'Frank\'s Bar', city: 'Buenos Aires', state: 'AR', location: { lat: -34.5910, lng: -58.4266, address: 'Arévalo 1445, C1414 CABA' }, pulseScore: 66, category: 'Lounge' },
  { id: 'bue-10', name: 'Bahrein Buenos Aires', city: 'Buenos Aires', state: 'AR', location: { lat: -34.6106, lng: -58.3726, address: 'Lavalle 345, C1047 CABA' }, pulseScore: 80, category: 'Nightclub' },
  { id: 'bue-11', name: 'La Catedral', city: 'Buenos Aires', state: 'AR', location: { lat: -34.6037, lng: -58.4254, address: 'Sarmiento 4006, C1197 CABA' }, pulseScore: 68, category: 'Music Venue' },
]

// --- DUBAI, UAE ---
const DUBAI_VENUES: Venue[] = [
  { id: 'dxb-1', name: 'White Dubai', city: 'Dubai', state: 'AE', location: { lat: 25.2119, lng: 55.2742, address: 'Meydan Racecourse, Nad Al Sheba, Dubai' }, pulseScore: 90, category: 'Nightclub' },
  { id: 'dxb-2', name: 'Soho Garden DXB', city: 'Dubai', state: 'AE', location: { lat: 25.2119, lng: 55.2718, address: 'Meydan Racecourse, Nad Al Sheba, Dubai' }, pulseScore: 88, category: 'Nightclub' },
  { id: 'dxb-3', name: 'Blue Marlin Ibiza UAE', city: 'Dubai', state: 'AE', location: { lat: 24.9973, lng: 55.1494, address: 'Golden Tulip Al Jazira Resort, Ghantoot' }, pulseScore: 82, category: 'Nightclub' },
  { id: 'dxb-4', name: 'Dubai Opera', city: 'Dubai', state: 'AE', location: { lat: 25.1953, lng: 55.2700, address: 'Sheikh Mohammed bin Rashid Blvd, Downtown Dubai' }, pulseScore: 78, category: 'Music Venue' },
  { id: 'dxb-5', name: 'Galaxy Bar (Wafi)', city: 'Dubai', state: 'AE', location: { lat: 25.2276, lng: 55.3180, address: 'Wafi Mall, Oud Metha Rd, Dubai' }, pulseScore: 68, category: 'Bar' },
  { id: 'dxb-6', name: 'RAW Coffee Company', city: 'Dubai', state: 'AE', location: { lat: 25.1195, lng: 55.2011, address: 'Al Quoz Industrial Area 4, Dubai' }, pulseScore: 42, category: 'Café' },
  { id: 'dxb-7', name: 'Nobu Dubai', city: 'Dubai', state: 'AE', location: { lat: 25.2176, lng: 55.2530, address: 'Atlantis The Palm, Crescent Rd, Dubai' }, pulseScore: 75, category: 'Restaurant' },
  { id: 'dxb-8', name: 'Side Hustle Brews & Spirits', city: 'Dubai', state: 'AE', location: { lat: 25.0789, lng: 55.1401, address: 'Al Quoz, Dubai' }, pulseScore: 52, category: 'Brewery' },
  { id: 'dxb-9', name: 'Gold On 27', city: 'Dubai', state: 'AE', location: { lat: 25.2112, lng: 55.2730, address: 'Burj Al Arab, Jumeirah St, Dubai' }, pulseScore: 72, category: 'Lounge' },
  { id: 'dxb-10', name: 'Base Dubai', city: 'Dubai', state: 'AE', location: { lat: 25.2348, lng: 55.2638, address: 'Al Meydan Rd, Nad Al Sheba, Dubai' }, pulseScore: 85, category: 'Nightclub' },
  { id: 'dxb-11', name: 'Pierchic', city: 'Dubai', state: 'AE', location: { lat: 25.1369, lng: 55.1844, address: 'Al Qasr Hotel, Jumeirah Beach, Dubai' }, pulseScore: 70, category: 'Restaurant' },
]

/**
 * All international venues combined.
 */
export const GLOBAL_EXPANSION_VENUES: Venue[] = [
  ...LONDON_VENUES,
  ...TOKYO_VENUES,
  ...BERLIN_VENUES,
  ...CDMX_VENUES,
  ...TORONTO_VENUES,
  ...SYDNEY_VENUES,
  ...SEOUL_VENUES,
  ...BANGKOK_VENUES,
  ...BARCELONA_VENUES,
  ...AMSTERDAM_VENUES,
  ...BUENOSAIRES_VENUES,
  ...DUBAI_VENUES,
]

/**
 * International city center coordinates.
 */
export const GLOBAL_CITY_LOCATIONS: Record<string, { lat: number; lng: number; name: string }> = {
  london: { lat: 51.5074, lng: -0.1278, name: 'London, UK' },
  tokyo: { lat: 35.6762, lng: 139.6503, name: 'Tokyo, Japan' },
  berlin: { lat: 52.5200, lng: 13.4050, name: 'Berlin, Germany' },
  mexicocity: { lat: 19.4326, lng: -99.1332, name: 'Mexico City, Mexico' },
  toronto: { lat: 43.6532, lng: -79.3832, name: 'Toronto, Canada' },
  sydney: { lat: -33.8688, lng: 151.2093, name: 'Sydney, Australia' },
  seoul: { lat: 37.5665, lng: 126.9780, name: 'Seoul, South Korea' },
  bangkok: { lat: 13.7563, lng: 100.5018, name: 'Bangkok, Thailand' },
  barcelona: { lat: 41.3874, lng: 2.1686, name: 'Barcelona, Spain' },
  amsterdam: { lat: 52.3676, lng: 4.9041, name: 'Amsterdam, Netherlands' },
  buenosaires: { lat: -34.6037, lng: -58.3816, name: 'Buenos Aires, Argentina' },
  dubai: { lat: 25.2048, lng: 55.2708, name: 'Dubai, UAE' },
}
