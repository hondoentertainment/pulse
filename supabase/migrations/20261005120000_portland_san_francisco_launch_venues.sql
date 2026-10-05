[icon-proxy] Checking for exports in directory: /workspace/node_modules/@phosphor-icons/react
[icon-proxy] Found package file: /workspace/node_modules/@phosphor-icons/react/dist/index.d.ts
[icon-proxy] Loaded 1514 exports from /workspace/node_modules/@phosphor-icons/react/dist/index.d.ts
[icon-proxy] Checking for exports in directory: /workspace/node_modules/@phosphor-icons/react
[icon-proxy] Found package file: /workspace/node_modules/@phosphor-icons/react/dist/index.d.ts
[icon-proxy] Loaded 1514 exports from /workspace/node_modules/@phosphor-icons/react/dist/index.d.ts
-- Idempotent Portland and San Francisco curated venue seeds.
--
-- Source of truth: src/lib/portland-launch-venues.ts and
-- src/lib/san-francisco-launch-venues.ts.
-- venues.id is UUID, so each row uses the same deterministic id the app
-- catalog ships. Share slugs (pdx-crystal-ballroom, sf-chapel) stay aliases.
-- pulse_score stays 0 until a real pulse exists.
-- Soft-deleted matches are left deleted (no resurrection, no duplicate insert).
-- Apply on production project xeldqwhztcnnvazmshzh after merge. Do not mass-delete.

-- Portland, OR: 32 curated rooms.
-- venues.id is UUID. The second column is the app share slug
-- (pdx-crystal-ballroom, sf-chapel) and is not stored; pulses.venue_id
-- uses the UUID.

CREATE UNIQUE INDEX IF NOT EXISTS idx_venues_portland_name_address_alive
  ON venues (lower(name), lower(location_address))
  WHERE city = 'Portland' AND state = 'OR' AND deleted_at IS NULL;

WITH catalog (
  id,
  catalog_slug,
  name,
  location_lat,
  location_lng,
  location_address,
  neighborhood,
  category,
  website
) AS (
  VALUES
    ('d0000000-0000-4000-8000-000000000001'::uuid, 'pdx-crystal-ballroom', 'Crystal Ballroom', 45.5229, -122.6842, '1332 W Burnside St, Portland, OR', 'Pearl District', 'Music Venue', 'https://www.crystalballroompdx.com'),
    ('d0000000-0000-4000-8000-000000000002'::uuid, 'pdx-teardrop', 'Teardrop Cocktail Lounge', 45.5254, -122.6812, '1015 NW Everett St, Portland, OR', 'Pearl District', 'Lounge', NULL),
    ('d0000000-0000-4000-8000-000000000003'::uuid, 'pdx-pope-house', 'Pope House Bourbon Lounge', 45.5262, -122.6926, '2075 NW Glisan St, Portland, OR', 'Pearl District', 'Lounge', NULL),
    ('d0000000-0000-4000-8000-000000000004'::uuid, 'pdx-voicebox', 'Voicebox Karaoke', 45.5271, -122.6935, '2112 NW Hoyt St, Portland, OR', 'Pearl District', 'Bar', NULL),
    ('d0000000-0000-4000-8000-000000000005'::uuid, 'pdx-dantes', 'Dante''s', 45.523, -122.6734, '350 W Burnside St, Portland, OR', 'Old Town', 'Nightclub', 'https://danteslive.com'),
    ('d0000000-0000-4000-8000-000000000006'::uuid, 'pdx-roseland', 'Roseland Theater', 45.5236, -122.676, '8 NW 6th Ave, Portland, OR', 'Old Town', 'Music Venue', 'https://www.roselandpdx.com'),
    ('d0000000-0000-4000-8000-000000000007'::uuid, 'pdx-star-theater', 'Star Theater', 45.5237, -122.6756, '13 NW 6th Ave, Portland, OR', 'Old Town', 'Music Venue', NULL),
    ('d0000000-0000-4000-8000-000000000008'::uuid, 'pdx-ground-kontrol', 'Ground Kontrol Classic Arcade', 45.5239, -122.6746, '511 NW Couch St, Portland, OR', 'Old Town', 'Bar', 'https://www.groundkontrol.com'),
    ('d0000000-0000-4000-8000-000000000009'::uuid, 'pdx-shanghai-tunnel', 'Shanghai Tunnel', 45.5223, -122.6729, '211 SW Ankeny St, Portland, OR', 'Old Town', 'Bar', NULL),
    ('d0000000-0000-4000-8000-000000000010'::uuid, 'pdx-cc-slaughters', 'C.C. Slaughters', 45.5246, -122.6732, '219 NW Davis St, Portland, OR', 'Old Town', 'Nightclub', NULL),
    ('d0000000-0000-4000-8000-000000000011'::uuid, 'pdx-mississippi-studios', 'Mississippi Studios', 45.5506, -122.6756, '3939 N Mississippi Ave, Portland, OR', 'Mississippi', 'Music Venue', 'https://www.mississippistudios.com'),
    ('d0000000-0000-4000-8000-000000000012'::uuid, 'pdx-mississippi-pizza', 'Mississippi Pizza Pub', 45.5484, -122.6755, '3552 N Mississippi Ave, Portland, OR', 'Mississippi', 'Bar', NULL),
    ('d0000000-0000-4000-8000-000000000013'::uuid, 'pdx-crow-bar', 'Crow Bar', 45.5509, -122.6757, '3954 N Mississippi Ave, Portland, OR', 'Mississippi', 'Bar', NULL),
    ('d0000000-0000-4000-8000-000000000014'::uuid, 'pdx-liberty-glass', 'Liberty Glass', 45.5472, -122.6759, '938 N Cook St, Portland, OR', 'Mississippi', 'Bar', NULL),
    ('d0000000-0000-4000-8000-000000000015'::uuid, 'pdx-bye-and-bye', 'The Bye and Bye', 45.5592, -122.6553, '1011 NE Alberta St, Portland, OR', 'Alberta', 'Bar', NULL),
    ('d0000000-0000-4000-8000-000000000016'::uuid, 'pdx-radio-room', 'Radio Room', 45.5591, -122.6543, '1101 NE Alberta St, Portland, OR', 'Alberta', 'Bar', NULL),
    ('d0000000-0000-4000-8000-000000000017'::uuid, 'pdx-expatriate', 'Expatriate', 45.5629, -122.6356, '5424 NE 30th Ave, Portland, OR', 'Alberta', 'Bar', NULL),
    ('d0000000-0000-4000-8000-000000000018'::uuid, 'pdx-victoria', 'Victoria Bar', 45.5586, -122.6752, '4835 N Albina Ave, Portland, OR', 'Alberta', 'Bar', NULL),
    ('d0000000-0000-4000-8000-000000000019'::uuid, 'pdx-space-room', 'Space Room Lounge', 45.5122, -122.6133, '4800 SE Hawthorne Blvd, Portland, OR', 'Hawthorne', 'Bar', NULL),
    ('d0000000-0000-4000-8000-000000000020'::uuid, 'pdx-bar-of-the-gods', 'Bar of the Gods', 45.5121, -122.6132, '4801 SE Hawthorne Blvd, Portland, OR', 'Hawthorne', 'Bar', NULL),
    ('d0000000-0000-4000-8000-000000000021'::uuid, 'pdx-bagdad', 'Bagdad Theater & Pub', 45.5123, -122.6266, '3702 SE Hawthorne Blvd, Portland, OR', 'Hawthorne', 'Bar', NULL),
    ('d0000000-0000-4000-8000-000000000022'::uuid, 'pdx-gold-dust', 'Gold Dust Meridian', 45.5124, -122.6319, '3267 SE Hawthorne Blvd, Portland, OR', 'Hawthorne', 'Bar', NULL),
    ('d0000000-0000-4000-8000-000000000023'::uuid, 'pdx-holocene', 'Holocene', 45.5174, -122.6554, '1001 SE Morrison St, Portland, OR', 'Buckman', 'Nightclub', 'https://www.holocene.org'),
    ('d0000000-0000-4000-8000-000000000024'::uuid, 'pdx-revolution-hall', 'Revolution Hall', 45.5196, -122.6519, '1300 SE Stark St, Portland, OR', 'Buckman', 'Music Venue', 'https://www.revolutionhall.com'),
    ('d0000000-0000-4000-8000-000000000025'::uuid, 'pdx-white-owl', 'White Owl Social Club', 45.5136, -122.6577, '1305 SE 8th Ave, Portland, OR', 'Buckman', 'Bar', NULL),
    ('d0000000-0000-4000-8000-000000000026'::uuid, 'pdx-crush', 'Crush Bar', 45.5175, -122.6514, '1400 SE Morrison St, Portland, OR', 'Buckman', 'Bar', NULL),
    ('d0000000-0000-4000-8000-000000000027'::uuid, 'pdx-century', 'Century Bar', 45.5226, -122.6569, '930 SE Sandy Blvd, Portland, OR', 'Buckman', 'Bar', NULL),
    ('d0000000-0000-4000-8000-000000000028'::uuid, 'pdx-rontoms', 'Rontoms', 45.5228, -122.6589, '600 E Burnside St, Portland, OR', 'Kerns', 'Bar', NULL),
    ('d0000000-0000-4000-8000-000000000029'::uuid, 'pdx-swift', 'Swift Lounge', 45.5356, -122.6619, '1932 NE Martin Luther King Jr Blvd, Portland, OR', 'Kerns', 'Bar', NULL),
    ('d0000000-0000-4000-8000-000000000030'::uuid, 'pdx-spirit-of-77', 'Spirit of 77', 45.5269, -122.6616, '500 NE Martin Luther King Jr Blvd, Portland, OR', 'Kerns', 'Bar', NULL),
    ('d0000000-0000-4000-8000-000000000031'::uuid, 'pdx-wonder-ballroom', 'Wonder Ballroom', 45.5412, -122.6636, '128 NE Russell St, Portland, OR', 'Eliot', 'Music Venue', 'https://www.wonderballroom.com'),
    ('d0000000-0000-4000-8000-000000000032'::uuid, 'pdx-aladdin', 'Aladdin Theater', 45.5011, -122.6546, '3017 SE Milwaukie Ave, Portland, OR', 'Brooklyn', 'Music Venue', 'https://www.aladdin-theater.com')
),
updated AS (
  UPDATE venues v
  SET
    name = c.name,
    location_lat = c.location_lat,
    location_lng = c.location_lng,
    location_address = c.location_address,
    city = 'Portland',
    state = 'OR',
    neighborhood = c.neighborhood,
    category = c.category,
    seeded = true,
    inventory_source = 'curated-seed',
    website = c.website,
    pulse_score = CASE WHEN v.last_pulse_at IS NULL THEN 0 ELSE v.pulse_score END,
    score_velocity = CASE WHEN v.last_pulse_at IS NULL THEN 0 ELSE v.score_velocity END
  FROM catalog c
  WHERE v.deleted_at IS NULL
    AND (
      v.id = c.id
      OR (
        lower(v.name) = lower(c.name)
        AND lower(v.location_address) = lower(c.location_address)
        AND v.city = 'Portland'
        AND v.state = 'OR'
      )
    )
  RETURNING v.id
)
INSERT INTO venues (
  id,
  name,
  location_lat,
  location_lng,
  location_address,
  city,
  state,
  neighborhood,
  category,
  pulse_score,
  score_velocity,
  seeded,
  inventory_source,
  website
)
SELECT
  c.id,
  c.name,
  c.location_lat,
  c.location_lng,
  c.location_address,
  'Portland',
  'OR',
  c.neighborhood,
  c.category,
  0,
  0,
  true,
  'curated-seed',
  c.website
FROM catalog c
WHERE NOT EXISTS (
  SELECT 1
  FROM venues v
  WHERE v.id = c.id
     OR (
       lower(v.name) = lower(c.name)
       AND lower(v.location_address) = lower(c.location_address)
       AND v.city = 'Portland'
       AND v.state = 'OR'
     )
);

-- San Francisco, CA: 32 curated rooms.
-- venues.id is UUID. The second column is the app share slug
-- (pdx-crystal-ballroom, sf-chapel) and is not stored; pulses.venue_id
-- uses the UUID.

CREATE UNIQUE INDEX IF NOT EXISTS idx_venues_san_francisco_name_address_alive
  ON venues (lower(name), lower(location_address))
  WHERE city = 'San Francisco' AND state = 'CA' AND deleted_at IS NULL;

WITH catalog (
  id,
  catalog_slug,
  name,
  location_lat,
  location_lng,
  location_address,
  neighborhood,
  category,
  website
) AS (
  VALUES
    ('e0000000-0000-4000-8000-000000000001'::uuid, 'sf-chapel', 'The Chapel', 37.7606, -122.4214, '777 Valencia St, San Francisco, CA', 'Mission', 'Music Venue', 'https://www.thechapelsf.com'),
    ('e0000000-0000-4000-8000-000000000002'::uuid, 'sf-el-rio', 'El Rio', 37.7466, -122.4192, '3158 Mission St, San Francisco, CA', 'Mission', 'Bar', NULL),
    ('e0000000-0000-4000-8000-000000000003'::uuid, 'sf-make-out-room', 'Make-Out Room', 37.7554, -122.4198, '3225 22nd St, San Francisco, CA', 'Mission', 'Bar', NULL),
    ('e0000000-0000-4000-8000-000000000004'::uuid, 'sf-brick-and-mortar', 'Brick & Mortar Music Hall', 37.7694, -122.4198, '1710 Mission St, San Francisco, CA', 'Mission', 'Music Venue', 'https://www.brickandmortarmusic.com'),
    ('e0000000-0000-4000-8000-000000000005'::uuid, 'sf-zeitgeist', 'Zeitgeist', 37.7701, -122.4218, '199 Valencia St, San Francisco, CA', 'Mission', 'Bar', NULL),
    ('e0000000-0000-4000-8000-000000000006'::uuid, 'sf-benders', 'Bender''s Bar & Grill', 37.7599, -122.4176, '806 S Van Ness Ave, San Francisco, CA', 'Mission', 'Bar', NULL),
    ('e0000000-0000-4000-8000-000000000007'::uuid, 'sf-the-cafe', 'The Cafe', 37.7636, -122.4328, '2369 Market St, San Francisco, CA', 'Castro', 'Nightclub', NULL),
    ('e0000000-0000-4000-8000-000000000008'::uuid, 'sf-midnight-sun', 'Midnight Sun', 37.7609, -122.4336, '4067 18th St, San Francisco, CA', 'Castro', 'Bar', NULL),
    ('e0000000-0000-4000-8000-000000000009'::uuid, 'sf-twin-peaks', 'Twin Peaks Tavern', 37.7626, -122.4351, '401 Castro St, San Francisco, CA', 'Castro', 'Bar', NULL),
    ('e0000000-0000-4000-8000-000000000010'::uuid, 'sf-lookout', 'Lookout', 37.7646, -122.4322, '3600 16th St, San Francisco, CA', 'Castro', 'Bar', NULL),
    ('e0000000-0000-4000-8000-000000000011'::uuid, 'sf-dna-lounge', 'DNA Lounge', 37.7712, -122.4136, '375 11th St, San Francisco, CA', 'SoMa', 'Nightclub', 'https://www.dnalounge.com'),
    ('e0000000-0000-4000-8000-000000000012'::uuid, 'sf-the-endup', 'The EndUp', 37.7779, -122.4036, '401 6th St, San Francisco, CA', 'SoMa', 'Nightclub', 'https://theendup.com'),
    ('e0000000-0000-4000-8000-000000000013'::uuid, 'sf-cat-club', 'Cat Club', 37.7755, -122.41, '1190 Folsom St, San Francisco, CA', 'SoMa', 'Nightclub', NULL),
    ('e0000000-0000-4000-8000-000000000014'::uuid, 'sf-1015-folsom', '1015 Folsom', 37.7781, -122.4059, '1015 Folsom St, San Francisco, CA', 'SoMa', 'Nightclub', 'https://1015.com'),
    ('e0000000-0000-4000-8000-000000000015'::uuid, 'sf-great-northern', 'Great Northern', 37.7676, -122.4069, '119 Utah St, San Francisco, CA', 'SoMa', 'Music Venue', NULL),
    ('e0000000-0000-4000-8000-000000000016'::uuid, 'sf-bimbos', 'Bimbo''s 365 Club', 37.8036, -122.4152, '1025 Columbus Ave, San Francisco, CA', 'North Beach', 'Music Venue', 'https://www.bimbos365club.com'),
    ('e0000000-0000-4000-8000-000000000017'::uuid, 'sf-the-saloon', 'The Saloon', 37.7988, -122.4072, '1232 Grant Ave, San Francisco, CA', 'North Beach', 'Bar', NULL),
    ('e0000000-0000-4000-8000-000000000018'::uuid, 'sf-vesuvio', 'Vesuvio Cafe', 37.7976, -122.4066, '255 Columbus Ave, San Francisco, CA', 'North Beach', 'Bar', NULL),
    ('e0000000-0000-4000-8000-000000000019'::uuid, 'sf-tony-niks', 'Tony Nik''s Cafe', 37.8002, -122.4092, '1534 Stockton St, San Francisco, CA', 'North Beach', 'Bar', NULL),
    ('e0000000-0000-4000-8000-000000000020'::uuid, 'sf-club-deluxe', 'Club Deluxe', 37.7699, -122.4476, '1511 Haight St, San Francisco, CA', 'Haight-Ashbury', 'Bar', NULL),
    ('e0000000-0000-4000-8000-000000000021'::uuid, 'sf-milk-bar', 'Milk Bar', 37.7692, -122.4522, '1840 Haight St, San Francisco, CA', 'Haight-Ashbury', 'Bar', NULL),
    ('e0000000-0000-4000-8000-000000000022'::uuid, 'sf-zam-zam', 'Zam Zam', 37.7696, -122.4499, '1633 Haight St, San Francisco, CA', 'Haight-Ashbury', 'Bar', NULL),
    ('e0000000-0000-4000-8000-000000000023'::uuid, 'sf-hobsons', 'Hobson''s Choice', 37.7697, -122.4494, '1601 Haight St, San Francisco, CA', 'Haight-Ashbury', 'Bar', NULL),
    ('e0000000-0000-4000-8000-000000000024'::uuid, 'sf-balboa-cafe', 'Balboa Cafe', 37.7999, -122.4359, '3199 Fillmore St, San Francisco, CA', 'Marina', 'Bar', NULL),
    ('e0000000-0000-4000-8000-000000000025'::uuid, 'sf-bus-stop', 'Bus Stop Saloon', 37.7979, -122.4306, '1901 Union St, San Francisco, CA', 'Marina', 'Bar', NULL),
    ('e0000000-0000-4000-8000-000000000026'::uuid, 'sf-final-final', 'Final Final', 37.8006, -122.4462, '2990 Baker St, San Francisco, CA', 'Marina', 'Bar', NULL),
    ('e0000000-0000-4000-8000-000000000027'::uuid, 'sf-rickshaw-stop', 'Rickshaw Stop', 37.7762, -122.4206, '155 Fell St, San Francisco, CA', 'Hayes Valley', 'Music Venue', 'https://www.rickshawstop.com'),
    ('e0000000-0000-4000-8000-000000000028'::uuid, 'sf-smugglers-cove', 'Smuggler''s Cove', 37.7786, -122.4229, '650 Gough St, San Francisco, CA', 'Hayes Valley', 'Bar', NULL),
    ('e0000000-0000-4000-8000-000000000029'::uuid, 'sf-martunis', 'Martuni''s', 37.7709, -122.4222, '4 Valencia St, San Francisco, CA', 'Hayes Valley', 'Bar', NULL),
    ('e0000000-0000-4000-8000-000000000030'::uuid, 'sf-gamh', 'Great American Music Hall', 37.7849, -122.4189, '859 O''Farrell St, San Francisco, CA', 'Tenderloin', 'Music Venue', 'https://gamh.com'),
    ('e0000000-0000-4000-8000-000000000031'::uuid, 'sf-edinburgh-castle', 'Edinburgh Castle', 37.7862, -122.4156, '950 Geary St, San Francisco, CA', 'Tenderloin', 'Bar', NULL),
    ('e0000000-0000-4000-8000-000000000032'::uuid, 'sf-aunt-charlies', 'Aunt Charlie''s Lounge', 37.7832, -122.4116, '133 Turk St, San Francisco, CA', 'Tenderloin', 'Bar', NULL)
),
updated AS (
  UPDATE venues v
  SET
    name = c.name,
    location_lat = c.location_lat,
    location_lng = c.location_lng,
    location_address = c.location_address,
    city = 'San Francisco',
    state = 'CA',
    neighborhood = c.neighborhood,
    category = c.category,
    seeded = true,
    inventory_source = 'curated-seed',
    website = c.website,
    pulse_score = CASE WHEN v.last_pulse_at IS NULL THEN 0 ELSE v.pulse_score END,
    score_velocity = CASE WHEN v.last_pulse_at IS NULL THEN 0 ELSE v.score_velocity END
  FROM catalog c
  WHERE v.deleted_at IS NULL
    AND (
      v.id = c.id
      OR (
        lower(v.name) = lower(c.name)
        AND lower(v.location_address) = lower(c.location_address)
        AND v.city = 'San Francisco'
        AND v.state = 'CA'
      )
    )
  RETURNING v.id
)
INSERT INTO venues (
  id,
  name,
  location_lat,
  location_lng,
  location_address,
  city,
  state,
  neighborhood,
  category,
  pulse_score,
  score_velocity,
  seeded,
  inventory_source,
  website
)
SELECT
  c.id,
  c.name,
  c.location_lat,
  c.location_lng,
  c.location_address,
  'San Francisco',
  'CA',
  c.neighborhood,
  c.category,
  0,
  0,
  true,
  'curated-seed',
  c.website
FROM catalog c
WHERE NOT EXISTS (
  SELECT 1
  FROM venues v
  WHERE v.id = c.id
     OR (
       lower(v.name) = lower(c.name)
       AND lower(v.location_address) = lower(c.location_address)
       AND v.city = 'San Francisco'
       AND v.state = 'CA'
     )
);
