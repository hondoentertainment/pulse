-- Seed data: 20 representative venues across diverse US cities and categories
-- Uses deterministic UUIDs so foreign-key references are stable across resets.

INSERT INTO venues (id, name, location_lat, location_lng, location_address, city, state, category, pulse_score, score_velocity, seeded, hours, last_activity, created_at)
VALUES
  -- New York City
  ('a0000000-0000-4000-8000-000000000001', 'Brooklyn Mirage', 40.7216, -73.9337, '140 Stewart Ave, Brooklyn, NY', 'New York', 'NY', 'Nightclub', 92, 2.5, true,
   '{"friday": "10:00 PM - 6:00 AM", "saturday": "10:00 PM - 6:00 AM"}', now() - interval '15 minutes', now()),

  ('a0000000-0000-4000-8000-000000000002', 'Blue Note Jazz Club', 40.7313, -74.0001, '131 W 3rd St, New York, NY', 'New York', 'NY', 'Music Venue', 70, 0.8, true,
   '{"monday": "6:00 PM - 12:00 AM", "tuesday": "6:00 PM - 12:00 AM", "wednesday": "6:00 PM - 12:00 AM", "thursday": "6:00 PM - 12:00 AM", "friday": "6:00 PM - 1:00 AM", "saturday": "6:00 PM - 1:00 AM", "sunday": "6:00 PM - 12:00 AM"}', now() - interval '45 minutes', now()),

  ('a0000000-0000-4000-8000-000000000003', 'Devoción', 40.7128, -73.9564, '69 Grand St, Brooklyn, NY', 'New York', 'NY', 'Café', 45, 0.2, true,
   '{"monday": "7:00 AM - 7:00 PM", "tuesday": "7:00 AM - 7:00 PM", "wednesday": "7:00 AM - 7:00 PM", "thursday": "7:00 AM - 7:00 PM", "friday": "7:00 AM - 7:00 PM", "saturday": "8:00 AM - 7:00 PM", "sunday": "8:00 AM - 7:00 PM"}', now() - interval '2 hours', now()),

  ('a0000000-0000-4000-8000-000000000004', 'Dead Rabbit', 40.7031, -74.0129, '30 Water St, New York, NY', 'New York', 'NY', 'Bar', 68, 1.0, true, NULL, now() - interval '30 minutes', now()),

  -- Los Angeles
  ('a0000000-0000-4000-8000-000000000005', 'Sound Nightclub', 34.0907, -118.3267, '1642 N Las Palmas Ave, Los Angeles, CA', 'Los Angeles', 'CA', 'Nightclub', 88, 3.1, true,
   '{"friday": "10:00 PM - 4:00 AM", "saturday": "10:00 PM - 4:00 AM"}', now() - interval '10 minutes', now()),

  ('a0000000-0000-4000-8000-000000000006', 'Bestia', 34.0378, -118.2321, '2121 E 7th Pl, Los Angeles, CA', 'Los Angeles', 'CA', 'Restaurant', 78, 0.5, true,
   '{"tuesday": "5:00 PM - 11:00 PM", "wednesday": "5:00 PM - 11:00 PM", "thursday": "5:00 PM - 11:00 PM", "friday": "5:00 PM - 12:00 AM", "saturday": "5:00 PM - 12:00 AM", "sunday": "5:00 PM - 10:00 PM"}', now() - interval '1 hour', now()),

  ('a0000000-0000-4000-8000-000000000007', 'Intelligentsia Coffee', 34.0903, -118.2758, '3922 Sunset Blvd, Los Angeles, CA', 'Los Angeles', 'CA', 'Café', 42, 0.1, true,
   '{"monday": "6:00 AM - 6:00 PM", "tuesday": "6:00 AM - 6:00 PM", "wednesday": "6:00 AM - 6:00 PM", "thursday": "6:00 AM - 6:00 PM", "friday": "6:00 AM - 6:00 PM", "saturday": "7:00 AM - 6:00 PM", "sunday": "7:00 AM - 6:00 PM"}', now() - interval '3 hours', now()),

  -- Chicago
  ('a0000000-0000-4000-8000-000000000008', 'Smart Bar', 41.9392, -87.6638, '3730 N Clark St, Chicago, IL', 'Chicago', 'IL', 'Nightclub', 82, 2.0, true,
   '{"wednesday": "9:00 PM - 4:00 AM", "thursday": "9:00 PM - 4:00 AM", "friday": "9:00 PM - 5:00 AM", "saturday": "9:00 PM - 5:00 AM"}', now() - interval '20 minutes', now()),

  ('a0000000-0000-4000-8000-000000000009', 'Girl & The Goat', 41.8846, -87.6485, '809 W Randolph St, Chicago, IL', 'Chicago', 'IL', 'Restaurant', 72, 0.6, true,
   '{"monday": "4:30 PM - 10:00 PM", "tuesday": "4:30 PM - 10:00 PM", "wednesday": "4:30 PM - 10:00 PM", "thursday": "4:30 PM - 10:00 PM", "friday": "4:30 PM - 11:00 PM", "saturday": "4:30 PM - 11:00 PM", "sunday": "4:30 PM - 10:00 PM"}', now() - interval '50 minutes', now()),

  ('a0000000-0000-4000-8000-000000000010', 'Revolution Brewing', 41.9217, -87.6906, '2323 N Milwaukee Ave, Chicago, IL', 'Chicago', 'IL', 'Brewery', 58, 0.3, true, NULL, now() - interval '2 hours', now()),

  -- Miami
  ('a0000000-0000-4000-8000-000000000011', 'LIV', 25.8015, -80.1231, '4441 Collins Ave, Miami Beach, FL', 'Miami', 'FL', 'Nightclub', 95, 4.0, true,
   '{"wednesday": "11:00 PM - 5:00 AM", "friday": "11:00 PM - 5:00 AM", "saturday": "11:00 PM - 5:00 AM", "sunday": "11:00 PM - 5:00 AM"}', now() - interval '5 minutes', now()),

  ('a0000000-0000-4000-8000-000000000012', 'Panther Coffee', 25.7560, -80.2435, '2390 NW 2nd Ave, Miami, FL', 'Miami', 'FL', 'Café', 38, 0.1, true,
   '{"monday": "7:00 AM - 7:00 PM", "tuesday": "7:00 AM - 7:00 PM", "wednesday": "7:00 AM - 7:00 PM", "thursday": "7:00 AM - 7:00 PM", "friday": "7:00 AM - 8:00 PM", "saturday": "8:00 AM - 8:00 PM", "sunday": "8:00 AM - 7:00 PM"}', now() - interval '4 hours', now()),

  -- Austin
  ('a0000000-0000-4000-8000-000000000013', 'Stubb''s BBQ', 30.2692, -97.7366, '801 Red River St, Austin, TX', 'Austin', 'TX', 'Music Venue', 78, 1.5, true,
   '{"tuesday": "11:00 AM - 10:00 PM", "wednesday": "11:00 AM - 10:00 PM", "thursday": "11:00 AM - 10:00 PM", "friday": "11:00 AM - 12:00 AM", "saturday": "11:00 AM - 12:00 AM", "sunday": "11:00 AM - 10:00 PM"}', now() - interval '35 minutes', now()),

  ('a0000000-0000-4000-8000-000000000014', 'Franklin Barbecue', 30.2702, -97.7311, '900 E 11th St, Austin, TX', 'Austin', 'TX', 'Restaurant', 80, 0.9, true,
   '{"tuesday": "11:00 AM - 3:00 PM", "wednesday": "11:00 AM - 3:00 PM", "thursday": "11:00 AM - 3:00 PM", "friday": "11:00 AM - 3:00 PM", "saturday": "11:00 AM - 3:00 PM"}', now() - interval '1 hour', now()),

  -- Nashville
  ('a0000000-0000-4000-8000-000000000015', 'Tootsie''s Orchid Lounge', 36.1589, -86.7758, '422 Broadway, Nashville, TN', 'Nashville', 'TN', 'Bar', 88, 2.2, true,
   '{"monday": "10:00 AM - 3:00 AM", "tuesday": "10:00 AM - 3:00 AM", "wednesday": "10:00 AM - 3:00 AM", "thursday": "10:00 AM - 3:00 AM", "friday": "10:00 AM - 3:00 AM", "saturday": "10:00 AM - 3:00 AM", "sunday": "10:00 AM - 3:00 AM"}', now() - interval '8 minutes', now()),

  ('a0000000-0000-4000-8000-000000000016', 'The Bluebird Cafe', 36.1012, -86.8168, '4104 Hillsboro Pike, Nashville, TN', 'Nashville', 'TN', 'Music Venue', 75, 1.2, true, NULL, now() - interval '1 hour', now()),

  -- San Francisco
  ('a0000000-0000-4000-8000-000000000017', 'The Fillmore', 37.7840, -122.4334, '1805 Geary Blvd, San Francisco, CA', 'San Francisco', 'CA', 'Music Venue', 80, 1.8, true,
   '{"thursday": "7:00 PM - 12:00 AM", "friday": "7:00 PM - 1:00 AM", "saturday": "7:00 PM - 1:00 AM"}', now() - interval '25 minutes', now()),

  -- Seattle
  ('a0000000-0000-4000-8000-000000000018', 'Neumos', 47.6145, -122.3205, '925 E Pike St, Seattle, WA', 'Seattle', 'WA', 'Music Venue', 85, 1.6, true,
   '{"wednesday": "8:00 PM - 2:00 AM", "thursday": "8:00 PM - 2:00 AM", "friday": "8:00 PM - 2:00 AM", "saturday": "8:00 PM - 2:00 AM"}', now() - interval '18 minutes', now()),

  ('a0000000-0000-4000-8000-000000000019', 'Q Nightclub', 47.6138, -122.3198, '1426 Broadway, Seattle, WA', 'Seattle', 'WA', 'Nightclub', 92, 3.0, true,
   '{"thursday": "9:00 PM - 3:00 AM", "friday": "9:00 PM - 4:00 AM", "saturday": "9:00 PM - 4:00 AM"}', now() - interval '12 minutes', now()),

  -- Denver
  ('a0000000-0000-4000-8000-000000000020', 'Red Rocks Amphitheatre', 39.6654, -105.2057, '18300 W Alameda Pkwy, Morrison, CO', 'Denver', 'CO', 'Music Venue', 90, 2.8, true,
   '{"friday": "6:00 PM - 11:00 PM", "saturday": "6:00 PM - 11:00 PM", "sunday": "6:00 PM - 11:00 PM"}', now() - interval '40 minutes', now())

ON CONFLICT (id) DO NOTHING;

-- Curated Seattle launch inventory (P0-4). pulse_score stays 0 — no invented live reports.
UPDATE venues
SET pulse_score = 0,
    score_velocity = 0,
    last_activity = NULL,
    inventory_source = 'curated-seed',
    neighborhood = CASE name
      WHEN 'Neumos' THEN 'Capitol Hill'
      WHEN 'Q Nightclub' THEN 'Capitol Hill'
      ELSE neighborhood
    END
WHERE city = 'Seattle' AND state = 'WA';

INSERT INTO venues (id, name, location_lat, location_lng, location_address, city, state, neighborhood, category, pulse_score, score_velocity, seeded, inventory_source, hours, last_activity, created_at)
VALUES
  ('c0000000-0000-4000-8000-000000000001', 'Barboza', 47.6145, -122.3207, '925 E Pike St, Seattle, WA', 'Seattle', 'WA', 'Capitol Hill', 'Lounge', 0, 0, true, 'curated-seed', NULL, NULL, now()),
  ('c0000000-0000-4000-8000-000000000002', 'The Unicorn', 47.6142, -122.3196, '1118 E Pike St, Seattle, WA', 'Seattle', 'WA', 'Capitol Hill', 'Bar', 0, 0, true, 'curated-seed', NULL, NULL, now()),
  ('c0000000-0000-4000-8000-000000000003', 'Chop Suey', 47.6145, -122.3194, '1325 E Madison St, Seattle, WA', 'Seattle', 'WA', 'Capitol Hill', 'Music Venue', 0, 0, true, 'curated-seed', NULL, NULL, now()),
  ('c0000000-0000-4000-8000-000000000004', 'The Comet Tavern', 47.6142, -122.3181, '922 E Pike St, Seattle, WA', 'Seattle', 'WA', 'Capitol Hill', 'Bar', 0, 0, true, 'curated-seed', NULL, NULL, now()),
  ('c0000000-0000-4000-8000-000000000005', 'Linda''s Tavern', 47.6140, -122.3209, '707 E Pine St, Seattle, WA', 'Seattle', 'WA', 'Capitol Hill', 'Bar', 0, 0, true, 'curated-seed', NULL, NULL, now()),
  ('c0000000-0000-4000-8000-000000000006', 'Neighbours', 47.6141, -122.3202, '1509 Broadway, Seattle, WA', 'Seattle', 'WA', 'Capitol Hill', 'Nightclub', 0, 0, true, 'curated-seed', NULL, NULL, now()),
  ('c0000000-0000-4000-8000-000000000007', 'The Crocodile', 47.6134, -122.3443, '2505 1st Ave, Seattle, WA', 'Seattle', 'WA', 'Belltown', 'Music Venue', 0, 0, true, 'curated-seed', NULL, NULL, now()),
  ('c0000000-0000-4000-8000-000000000008', 'The 5 Point Cafe', 47.6182, -122.3476, '415 Cedar St, Seattle, WA', 'Seattle', 'WA', 'Belltown', 'Bar', 0, 0, true, 'curated-seed', NULL, NULL, now()),
  ('c0000000-0000-4000-8000-000000000009', 'Rendezvous', 47.6148, -122.3456, '2322 2nd Ave, Seattle, WA', 'Seattle', 'WA', 'Belltown', 'Bar', 0, 0, true, 'curated-seed', NULL, NULL, now()),
  ('c0000000-0000-4000-8000-000000000010', 'Shorty''s', 47.6149, -122.3452, '2222 2nd Ave, Seattle, WA', 'Seattle', 'WA', 'Belltown', 'Bar', 0, 0, true, 'curated-seed', NULL, NULL, now()),
  ('c0000000-0000-4000-8000-000000000011', 'Rob Roy', 47.6156, -122.3471, '2332 2nd Ave, Seattle, WA', 'Seattle', 'WA', 'Belltown', 'Bar', 0, 0, true, 'curated-seed', NULL, NULL, now()),
  ('c0000000-0000-4000-8000-000000000012', 'The Whisky Bar', 47.6131, -122.3458, '2122 2nd Ave, Seattle, WA', 'Seattle', 'WA', 'Belltown', 'Bar', 0, 0, true, 'curated-seed', NULL, NULL, now()),
  ('c0000000-0000-4000-8000-000000000013', 'Nectar Lounge', 47.6516, -122.3542, '412 N 36th St, Seattle, WA', 'Seattle', 'WA', 'Fremont', 'Music Venue', 0, 0, true, 'curated-seed', NULL, NULL, now()),
  ('c0000000-0000-4000-8000-000000000014', 'Fremont Brewing', 47.6491, -122.3446, '1050 N 34th St, Seattle, WA', 'Seattle', 'WA', 'Fremont', 'Brewery', 0, 0, true, 'curated-seed', NULL, NULL, now()),
  ('c0000000-0000-4000-8000-000000000015', 'The George & Dragon Pub', 47.6514, -122.3558, '206 N 36th St, Seattle, WA', 'Seattle', 'WA', 'Fremont', 'Bar', 0, 0, true, 'curated-seed', NULL, NULL, now()),
  ('c0000000-0000-4000-8000-000000000016', 'Norm''s Eatery & Ale House', 47.6515, -122.3518, '460 N 36th St, Seattle, WA', 'Seattle', 'WA', 'Fremont', 'Bar', 0, 0, true, 'curated-seed', NULL, NULL, now()),
  ('c0000000-0000-4000-8000-000000000017', 'Fremont Abbey Arts Center', 47.6612, -122.3499, '4272 Fremont Ave N, Seattle, WA', 'Seattle', 'WA', 'Fremont', 'Music Venue', 0, 0, true, 'curated-seed', NULL, NULL, now()),
  ('c0000000-0000-4000-8000-000000000018', 'Westward', 47.6478, -122.3476, '2501 N Northlake Way, Seattle, WA', 'Seattle', 'WA', 'Fremont', 'Restaurant', 0, 0, true, 'curated-seed', NULL, NULL, now()),
  ('c0000000-0000-4000-8000-000000000019', 'Tractor Tavern', 47.6658, -122.3828, '5213 Ballard Ave NW, Seattle, WA', 'Seattle', 'WA', 'Ballard', 'Music Venue', 0, 0, true, 'curated-seed', NULL, NULL, now()),
  ('c0000000-0000-4000-8000-000000000020', 'The Sunset Tavern', 47.6684, -122.3853, '5433 Ballard Ave NW, Seattle, WA', 'Seattle', 'WA', 'Ballard', 'Bar', 0, 0, true, 'curated-seed', NULL, NULL, now()),
  ('c0000000-0000-4000-8000-000000000021', 'Conor Byrne Pub', 47.6667, -122.3836, '5140 Ballard Ave NW, Seattle, WA', 'Seattle', 'WA', 'Ballard', 'Bar', 0, 0, true, 'curated-seed', NULL, NULL, now()),
  ('c0000000-0000-4000-8000-000000000022', 'Hattie''s Hat', 47.6681, -122.3847, '5231 Ballard Ave NW, Seattle, WA', 'Seattle', 'WA', 'Ballard', 'Bar', 0, 0, true, 'curated-seed', NULL, NULL, now()),
  ('c0000000-0000-4000-8000-000000000023', 'The Noble Fir', 47.6649, -122.3814, '5316 Ballard Ave NW, Seattle, WA', 'Seattle', 'WA', 'Ballard', 'Bar', 0, 0, true, 'curated-seed', NULL, NULL, now()),
  ('c0000000-0000-4000-8000-000000000024', 'King''s Hardware', 47.6686, -122.3872, '5225 Ballard Ave NW, Seattle, WA', 'Seattle', 'WA', 'Ballard', 'Bar', 0, 0, true, 'curated-seed', NULL, NULL, now()),
  ('c0000000-0000-4000-8000-000000000025', 'The Showbox', 47.6084, -122.3395, '1426 1st Ave, Seattle, WA', 'Seattle', 'WA', 'Downtown', 'Music Venue', 0, 0, true, 'curated-seed', NULL, NULL, now()),
  ('c0000000-0000-4000-8000-000000000026', 'The Triple Door', 47.6082, -122.3368, '216 Union St, Seattle, WA', 'Seattle', 'WA', 'Downtown', 'Music Venue', 0, 0, true, 'curated-seed', NULL, NULL, now()),
  ('c0000000-0000-4000-8000-000000000027', 'The Paramount Theatre', 47.6133, -122.3314, '911 Pine St, Seattle, WA', 'Seattle', 'WA', 'Downtown', 'Music Venue', 0, 0, true, 'curated-seed', NULL, NULL, now()),
  ('c0000000-0000-4000-8000-000000000028', 'The Moore Theatre', 47.6118, -122.3415, '1932 2nd Ave, Seattle, WA', 'Seattle', 'WA', 'Downtown', 'Music Venue', 0, 0, true, 'curated-seed', NULL, NULL, now()),
  ('c0000000-0000-4000-8000-000000000029', 'Dimitriou''s Jazz Alley', 47.6164, -122.3378, '2033 6th Ave, Seattle, WA', 'Seattle', 'WA', 'Downtown', 'Music Venue', 0, 0, true, 'curated-seed', NULL, NULL, now()),
  ('c0000000-0000-4000-8000-000000000030', 'Foundation Nightclub', 47.6018, -122.3341, '2218 Western Ave, Seattle, WA', 'Seattle', 'WA', 'Downtown', 'Nightclub', 0, 0, true, 'curated-seed', NULL, NULL, now()),
  ('c0000000-0000-4000-8000-000000000031', 'The Central Saloon', 47.6005, -122.3342, '207 1st Ave S, Seattle, WA', 'Seattle', 'WA', 'Downtown', 'Bar', 0, 0, true, 'curated-seed', NULL, NULL, now())
ON CONFLICT (id) DO NOTHING;
