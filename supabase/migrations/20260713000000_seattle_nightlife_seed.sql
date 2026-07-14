-- Seattle nightlife curated seed: UPSERTs the ~32 venues in
-- `src/lib/seattle-nightlife-catalog.ts` into `venues` so the curated
-- catalog data (PRD P0-4) is queryable from the database, not just the
-- client-side fallback bundle.
--
-- Idempotent: re-running this migration re-applies the curated fields
-- (name, location, neighborhood, category, phone/website, dress code,
-- cover charge, price range, indoor/outdoor, hours, maps link) without
-- disturbing dynamic/live fields that may have since been computed or
-- enriched for these rows (pulse_score, score_velocity, last_pulse_at,
-- place_id, enriched_at, enrichment_source, menu_url, capacity_hint,
-- accessibility_features). Those are only set on first insert.
--
-- IDs are fixed UUIDs (b0000000-0000-4000-8000-0000000000NN, matching
-- catalog array order 1-32) so this migration and the TS catalog can be
-- cross-referenced by position, and so re-runs always target the same
-- rows regardless of environment.

INSERT INTO venues (
  id, name, location_lat, location_lng, location_address, city, state,
  neighborhood, category, category_key, pulse_score, phone, website,
  dress_code, cover_charge_cents, cover_charge_note, price_range,
  indoor_outdoor, hours, seeded, integrations
) VALUES
  -- sea-neumos
  ('b0000000-0000-4000-8000-000000000001', 'Neumos', 47.6145, -122.3205, '925 E Pike St, Seattle, WA', 'Seattle', 'WA',
   'Capitol Hill', 'Music Venue', 'music_venue', 85, '(206) 709-9442', 'https://neumos.com',
   'casual', 2000, 'Ticketed shows vary', 2,
   'indoor', '{"wednesday":"7:00 PM - 2:00 AM","thursday":"7:00 PM - 2:00 AM","friday":"7:00 PM - 2:00 AM","saturday":"7:00 PM - 2:00 AM","sunday":"Closed","monday":"Closed","tuesday":"Closed"}'::jsonb, true,
   '{"maps":{"googleMapsUrl":"https://www.google.com/maps/search/?api=1&query=Neumos%20925%20E%20Pike%20St%2C%20Seattle%2C%20WA"}}'::jsonb),
  -- sea-barboza
  ('b0000000-0000-4000-8000-000000000002', 'Barboza', 47.6145, -122.3207, '925 E Pike St, Seattle, WA', 'Seattle', 'WA',
   'Capitol Hill', 'Nightclub', 'nightclub', 78, NULL, NULL,
   'smart_casual', 1500, NULL, 2,
   'indoor', '{"thursday":"9:00 PM - 2:00 AM","friday":"9:00 PM - 3:00 AM","saturday":"9:00 PM - 3:00 AM"}'::jsonb, true,
   '{"maps":{"googleMapsUrl":"https://www.google.com/maps/search/?api=1&query=Barboza%20925%20E%20Pike%20St%2C%20Seattle%2C%20WA"}}'::jsonb),
  -- sea-q-nightclub
  ('b0000000-0000-4000-8000-000000000003', 'Q Nightclub', 47.6138, -122.3198, '1426 Broadway, Seattle, WA', 'Seattle', 'WA',
   'Capitol Hill', 'Nightclub', 'nightclub', 92, '(206) 200-7074', 'https://qnightclub.com',
   'smart_casual', 2000, NULL, 3,
   'indoor', '{"thursday":"9:00 PM - 3:00 AM","friday":"9:00 PM - 4:00 AM","saturday":"9:00 PM - 4:00 AM"}'::jsonb, true,
   '{"maps":{"googleMapsUrl":"https://www.google.com/maps/search/?api=1&query=Q%20Nightclub%201426%20Broadway%2C%20Seattle%2C%20WA"}}'::jsonb),
  -- sea-kremwerk
  ('b0000000-0000-4000-8000-000000000004', 'Kremwerk', 47.6154, -122.3213, '1809 Minor Ave, Seattle, WA', 'Seattle', 'WA',
   'Capitol Hill', 'Nightclub', 'nightclub', 68, NULL, NULL,
   'casual', 1000, NULL, 2,
   'indoor', '{"thursday":"9:00 PM - 2:00 AM","friday":"9:00 PM - 3:00 AM","saturday":"9:00 PM - 3:00 AM"}'::jsonb, true,
   '{"maps":{"googleMapsUrl":"https://www.google.com/maps/search/?api=1&query=Kremwerk%201809%20Minor%20Ave%2C%20Seattle%2C%20WA"}}'::jsonb),
  -- sea-neighbourhood
  ('b0000000-0000-4000-8000-000000000005', 'Neighbourhood', 47.6142, -122.3189, '1509 E Madison St, Seattle, WA', 'Seattle', 'WA',
   'Capitol Hill', 'Bar', 'bar', 64, NULL, NULL,
   'casual', 0, 'Usually free', 2,
   'indoor', '{"monday":"4:00 PM - 2:00 AM","tuesday":"4:00 PM - 2:00 AM","wednesday":"4:00 PM - 2:00 AM","thursday":"4:00 PM - 2:00 AM","friday":"4:00 PM - 2:00 AM","saturday":"4:00 PM - 2:00 AM","sunday":"4:00 PM - 2:00 AM"}'::jsonb, true,
   '{"maps":{"googleMapsUrl":"https://www.google.com/maps/search/?api=1&query=Neighbourhood%201509%20E%20Madison%20St%2C%20Seattle%2C%20WA"}}'::jsonb),
  -- sea-rhein-haus
  ('b0000000-0000-4000-8000-000000000006', 'Rhein Haus', 47.6131, -122.3165, '912 12th Ave, Seattle, WA', 'Seattle', 'WA',
   'Capitol Hill', 'Bar', 'bar', 70, '(206) 325-5409', 'https://rheinhausseattle.com',
   'casual', 0, NULL, 2,
   'indoor', '{"monday":"4:00 PM - 12:00 AM","tuesday":"4:00 PM - 12:00 AM","wednesday":"4:00 PM - 12:00 AM","thursday":"4:00 PM - 1:00 AM","friday":"4:00 PM - 2:00 AM","saturday":"11:00 AM - 2:00 AM","sunday":"11:00 AM - 12:00 AM"}'::jsonb, true,
   '{"maps":{"googleMapsUrl":"https://www.google.com/maps/search/?api=1&query=Rhein%20Haus%20912%2012th%20Ave%2C%20Seattle%2C%20WA"}}'::jsonb),
  -- sea-canon
  ('b0000000-0000-4000-8000-000000000007', 'Canon', 47.614, -122.3168, '928 12th Ave, Seattle, WA', 'Seattle', 'WA',
   'Capitol Hill', 'Cocktail Bar', 'cocktail_bar', 74, NULL, 'https://canonseattle.com',
   'smart_casual', 0, NULL, 3,
   'indoor', '{"tuesday":"5:00 PM - 12:00 AM","wednesday":"5:00 PM - 12:00 AM","thursday":"5:00 PM - 1:00 AM","friday":"5:00 PM - 2:00 AM","saturday":"5:00 PM - 2:00 AM"}'::jsonb, true,
   '{"maps":{"googleMapsUrl":"https://www.google.com/maps/search/?api=1&query=Canon%20928%2012th%20Ave%2C%20Seattle%2C%20WA"}}'::jsonb),
  -- sea-crocodile
  ('b0000000-0000-4000-8000-000000000008', 'The Crocodile', 47.6162, -122.3488, '2200 2nd Ave, Seattle, WA', 'Seattle', 'WA',
   'Belltown', 'Music Venue', 'music_venue', 72, '(206) 441-4618', 'https://thecrocodile.com',
   'casual', 2500, 'Show dependent', 2,
   'indoor', '{"wednesday":"7:00 PM - 2:00 AM","thursday":"7:00 PM - 2:00 AM","friday":"7:00 PM - 2:00 AM","saturday":"7:00 PM - 2:00 AM","monday":"Closed","sunday":"Closed"}'::jsonb, true,
   '{"maps":{"googleMapsUrl":"https://www.google.com/maps/search/?api=1&query=The%20Crocodile%202200%202nd%20Ave%2C%20Seattle%2C%20WA"}}'::jsonb),
  -- sea-rumpus-room
  ('b0000000-0000-4000-8000-000000000009', 'Rumpus Room', 47.6135, -122.3455, '2222 2nd Ave, Seattle, WA', 'Seattle', 'WA',
   'Belltown', 'Nightclub', 'nightclub', 80, NULL, NULL,
   'smart_casual', 1500, NULL, 2,
   'indoor', '{"thursday":"9:00 PM - 2:00 AM","friday":"9:00 PM - 3:00 AM","saturday":"9:00 PM - 3:00 AM"}'::jsonb, true,
   '{"maps":{"googleMapsUrl":"https://www.google.com/maps/search/?api=1&query=Rumpus%20Room%202222%202nd%20Ave%2C%20Seattle%2C%20WA"}}'::jsonb),
  -- sea-lava-lounge
  ('b0000000-0000-4000-8000-000000000010', 'Lava Lounge', 47.6139, -122.3458, '2226 2nd Ave, Seattle, WA', 'Seattle', 'WA',
   'Belltown', 'Lounge', 'lounge', 55, NULL, NULL,
   'casual', 0, NULL, 2,
   'indoor', '{"monday":"4:00 PM - 2:00 AM","tuesday":"4:00 PM - 2:00 AM","wednesday":"4:00 PM - 2:00 AM","thursday":"4:00 PM - 2:00 AM","friday":"4:00 PM - 2:00 AM","saturday":"4:00 PM - 2:00 AM","sunday":"4:00 PM - 2:00 AM"}'::jsonb, true,
   '{"maps":{"googleMapsUrl":"https://www.google.com/maps/search/?api=1&query=Lava%20Lounge%202226%202nd%20Ave%2C%20Seattle%2C%20WA"}}'::jsonb),
  -- sea-tula
  ('b0000000-0000-4000-8000-000000000011', E'Tula''s Restaurant & Jazz Club', 47.6148, -122.3442, '2214 2nd Ave, Seattle, WA', 'Seattle', 'WA',
   'Belltown', 'Music Venue', 'music_venue', 58, NULL, NULL,
   'smart_casual', 1000, NULL, 3,
   'indoor', '{"wednesday":"7:00 PM - 12:00 AM","thursday":"7:00 PM - 12:00 AM","friday":"7:00 PM - 1:00 AM","saturday":"7:00 PM - 1:00 AM"}'::jsonb, true,
   '{"maps":{"googleMapsUrl":"https://www.google.com/maps/search/?api=1&query=Tula%27s%20Restaurant%20%26%20Jazz%20Club%202214%202nd%20Ave%2C%20Seattle%2C%20WA"}}'::jsonb),
  -- sea-shortys
  ('b0000000-0000-4000-8000-000000000012', E'Shorty''s', 47.6132, -122.3451, '2222 2nd Ave, Seattle, WA', 'Seattle', 'WA',
   'Belltown', 'Bar', 'bar', 62, NULL, NULL,
   'casual', 0, NULL, 1,
   'indoor', '{"monday":"12:00 PM - 2:00 AM","tuesday":"12:00 PM - 2:00 AM","wednesday":"12:00 PM - 2:00 AM","thursday":"12:00 PM - 2:00 AM","friday":"12:00 PM - 2:00 AM","saturday":"12:00 PM - 2:00 AM","sunday":"12:00 PM - 2:00 AM"}'::jsonb, true,
   '{"maps":{"googleMapsUrl":"https://www.google.com/maps/search/?api=1&query=Shorty%27s%202222%202nd%20Ave%2C%20Seattle%2C%20WA"}}'::jsonb),
  -- sea-tractor
  ('b0000000-0000-4000-8000-000000000013', 'Tractor Tavern', 47.6651, -122.3841, '5213 Ballard Ave NW, Seattle, WA', 'Seattle', 'WA',
   'Ballard', 'Music Venue', 'music_venue', 66, '(206) 789-3599', 'https://tractortavern.com',
   'casual', 1500, NULL, 2,
   'indoor', '{"wednesday":"7:00 PM - 2:00 AM","thursday":"7:00 PM - 2:00 AM","friday":"7:00 PM - 2:00 AM","saturday":"7:00 PM - 2:00 AM"}'::jsonb, true,
   '{"maps":{"googleMapsUrl":"https://www.google.com/maps/search/?api=1&query=Tractor%20Tavern%205213%20Ballard%20Ave%20NW%2C%20Seattle%2C%20WA"}}'::jsonb),
  -- sea-sunset
  ('b0000000-0000-4000-8000-000000000014', 'The Sunset Tavern', 47.6667, -122.3841, '5433 Ballard Ave NW, Seattle, WA', 'Seattle', 'WA',
   'Ballard', 'Music Venue', 'music_venue', 60, NULL, NULL,
   'casual', 1200, NULL, 2,
   'indoor', '{"wednesday":"7:00 PM - 2:00 AM","thursday":"7:00 PM - 2:00 AM","friday":"7:00 PM - 2:00 AM","saturday":"7:00 PM - 2:00 AM"}'::jsonb, true,
   '{"maps":{"googleMapsUrl":"https://www.google.com/maps/search/?api=1&query=The%20Sunset%20Tavern%205433%20Ballard%20Ave%20NW%2C%20Seattle%2C%20WA"}}'::jsonb),
  -- sea-ballard-smoke
  ('b0000000-0000-4000-8000-000000000015', 'Ballard Smoke Shop', 47.6685, -122.3848, '5439 Ballard Ave NW, Seattle, WA', 'Seattle', 'WA',
   'Ballard', 'Bar', 'bar', 48, NULL, NULL,
   'casual', 0, NULL, 1,
   'indoor', '{"monday":"11:00 AM - 2:00 AM","tuesday":"11:00 AM - 2:00 AM","wednesday":"11:00 AM - 2:00 AM","thursday":"11:00 AM - 2:00 AM","friday":"11:00 AM - 2:00 AM","saturday":"11:00 AM - 2:00 AM","sunday":"11:00 AM - 2:00 AM"}'::jsonb, true,
   '{"maps":{"googleMapsUrl":"https://www.google.com/maps/search/?api=1&query=Ballard%20Smoke%20Shop%205439%20Ballard%20Ave%20NW%2C%20Seattle%2C%20WA"}}'::jsonb),
  -- sea-kings
  ('b0000000-0000-4000-8000-000000000016', E'King''s Hardware', 47.6689, -122.3835, '5225 Ballard Ave NW, Seattle, WA', 'Seattle', 'WA',
   'Ballard', 'Bar', 'bar', 52, NULL, NULL,
   'casual', 0, NULL, 2,
   'indoor', '{"monday":"4:00 PM - 2:00 AM","tuesday":"4:00 PM - 2:00 AM","wednesday":"4:00 PM - 2:00 AM","thursday":"4:00 PM - 2:00 AM","friday":"4:00 PM - 2:00 AM","saturday":"12:00 PM - 2:00 AM","sunday":"12:00 PM - 2:00 AM"}'::jsonb, true,
   '{"maps":{"googleMapsUrl":"https://www.google.com/maps/search/?api=1&query=King%27s%20Hardware%205225%20Ballard%20Ave%20NW%2C%20Seattle%2C%20WA"}}'::jsonb),
  -- sea-stoup
  ('b0000000-0000-4000-8000-000000000017', 'Stoup Brewing', 47.6658, -122.3732, '1108 NW 52nd St, Seattle, WA', 'Seattle', 'WA',
   'Ballard', 'Brewery', 'brewery', 54, NULL, 'https://stoupbrewing.com',
   'casual', 0, NULL, 2,
   'both', '{"monday":"12:00 PM - 10:00 PM","tuesday":"12:00 PM - 10:00 PM","wednesday":"12:00 PM - 10:00 PM","thursday":"12:00 PM - 10:00 PM","friday":"12:00 PM - 11:00 PM","saturday":"12:00 PM - 11:00 PM","sunday":"12:00 PM - 9:00 PM"}'::jsonb, true,
   '{"maps":{"googleMapsUrl":"https://www.google.com/maps/search/?api=1&query=Stoup%20Brewing%201108%20NW%2052nd%20St%2C%20Seattle%2C%20WA"}}'::jsonb),
  -- sea-fremont-brewing
  ('b0000000-0000-4000-8000-000000000018', 'Fremont Brewing', 47.6492, -122.3498, '1050 N 34th St, Seattle, WA', 'Seattle', 'WA',
   'Fremont', 'Brewery', 'brewery', 58, '(206) 420-2407', 'https://fremontbrewing.com',
   'casual', 0, NULL, 2,
   'both', '{"monday":"11:00 AM - 9:00 PM","tuesday":"11:00 AM - 9:00 PM","wednesday":"11:00 AM - 9:00 PM","thursday":"11:00 AM - 9:00 PM","friday":"11:00 AM - 10:00 PM","saturday":"11:00 AM - 10:00 PM","sunday":"11:00 AM - 9:00 PM"}'::jsonb, true,
   '{"maps":{"googleMapsUrl":"https://www.google.com/maps/search/?api=1&query=Fremont%20Brewing%201050%20N%2034th%20St%2C%20Seattle%2C%20WA"}}'::jsonb),
  -- sea-brouwer
  ('b0000000-0000-4000-8000-000000000019', E'Brouwer''s Cafe', 47.6495, -122.3505, '400 N 36th St, Seattle, WA', 'Seattle', 'WA',
   'Fremont', 'Bar', 'bar', 56, NULL, NULL,
   'casual', 0, NULL, 2,
   'indoor', '{"monday":"11:00 AM - 2:00 AM","tuesday":"11:00 AM - 2:00 AM","wednesday":"11:00 AM - 2:00 AM","thursday":"11:00 AM - 2:00 AM","friday":"11:00 AM - 2:00 AM","saturday":"11:00 AM - 2:00 AM","sunday":"11:00 AM - 2:00 AM"}'::jsonb, true,
   '{"maps":{"googleMapsUrl":"https://www.google.com/maps/search/?api=1&query=Brouwer%27s%20Cafe%20400%20N%2036th%20St%2C%20Seattle%2C%20WA"}}'::jsonb),
  -- sea-high-dive
  ('b0000000-0000-4000-8000-000000000020', 'The High Dive', 47.6615, -122.3502, '513 N 36th St, Seattle, WA', 'Seattle', 'WA',
   'Fremont', 'Music Venue', 'music_venue', 50, NULL, NULL,
   'casual', 1000, NULL, 1,
   'indoor', '{"wednesday":"7:00 PM - 2:00 AM","thursday":"7:00 PM - 2:00 AM","friday":"7:00 PM - 2:00 AM","saturday":"7:00 PM - 2:00 AM"}'::jsonb, true,
   '{"maps":{"googleMapsUrl":"https://www.google.com/maps/search/?api=1&query=The%20High%20Dive%20513%20N%2036th%20St%2C%20Seattle%2C%20WA"}}'::jsonb),
  -- sea-showbox
  ('b0000000-0000-4000-8000-000000000021', 'The Showbox', 47.6088, -122.3371, '1426 1st Ave, Seattle, WA', 'Seattle', 'WA',
   'Downtown', 'Music Venue', 'music_venue', 81, '(206) 628-3151', 'https://showboxpresents.com',
   'casual', 3000, 'Ticketed events', 2,
   'indoor', '{"wednesday":"7:00 PM - 2:00 AM","thursday":"7:00 PM - 2:00 AM","friday":"7:00 PM - 2:00 AM","saturday":"7:00 PM - 2:00 AM","sunday":"7:00 PM - 2:00 AM"}'::jsonb, true,
   '{"maps":{"googleMapsUrl":"https://www.google.com/maps/search/?api=1&query=The%20Showbox%201426%201st%20Ave%2C%20Seattle%2C%20WA"}}'::jsonb),
  -- sea-foundation
  ('b0000000-0000-4000-8000-000000000022', 'Foundation Nightclub', 47.5981, -122.3293, '2218 Western Ave, Seattle, WA', 'Seattle', 'WA',
   'Downtown', 'Nightclub', 'nightclub', 88, '(206) 223-0480', 'https://foundationnightclub.com',
   'upscale', 2500, NULL, 3,
   'indoor', '{"thursday":"10:00 PM - 3:00 AM","friday":"10:00 PM - 4:00 AM","saturday":"10:00 PM - 4:00 AM"}'::jsonb, true,
   '{"maps":{"googleMapsUrl":"https://www.google.com/maps/search/?api=1&query=Foundation%20Nightclub%202218%20Western%20Ave%2C%20Seattle%2C%20WA"}}'::jsonb),
  -- sea-triple-door
  ('b0000000-0000-4000-8000-000000000023', 'The Triple Door', 47.6064, -122.3334, '216 Union St, Seattle, WA', 'Seattle', 'WA',
   'Downtown', 'Music Venue', 'music_venue', 58, NULL, NULL,
   'smart_casual', 2000, NULL, 3,
   'indoor', '{"tuesday":"5:00 PM - 11:00 PM","wednesday":"5:00 PM - 11:00 PM","thursday":"5:00 PM - 12:00 AM","friday":"5:00 PM - 1:00 AM","saturday":"5:00 PM - 1:00 AM"}'::jsonb, true,
   '{"maps":{"googleMapsUrl":"https://www.google.com/maps/search/?api=1&query=The%20Triple%20Door%20216%20Union%20St%2C%20Seattle%2C%20WA"}}'::jsonb),
  -- sea-owl-n-thistle
  ('b0000000-0000-4000-8000-000000000024', 'Owl N Thistle', 47.6035, -122.3338, '808 Post Ave, Seattle, WA', 'Seattle', 'WA',
   'Downtown', 'Bar', 'bar', 45, NULL, NULL,
   'casual', 0, NULL, 2,
   'indoor', '{"monday":"11:30 AM - 2:00 AM","tuesday":"11:30 AM - 2:00 AM","wednesday":"11:30 AM - 2:00 AM","thursday":"11:30 AM - 2:00 AM","friday":"11:30 AM - 2:00 AM","saturday":"11:30 AM - 2:00 AM","sunday":"11:30 AM - 2:00 AM"}'::jsonb, true,
   '{"maps":{"googleMapsUrl":"https://www.google.com/maps/search/?api=1&query=Owl%20N%20Thistle%20808%20Post%20Ave%2C%20Seattle%2C%20WA"}}'::jsonb),
  -- sea-pink-door
  ('b0000000-0000-4000-8000-000000000025', 'The Pink Door', 47.6089, -122.3405, '1919 Post Alley, Seattle, WA', 'Seattle', 'WA',
   'Downtown', 'Restaurant', 'restaurant', 62, '(206) 443-3241', 'https://thepinkdoor.net',
   'smart_casual', 0, NULL, 3,
   'indoor', '{"tuesday":"4:30 PM - 10:00 PM","wednesday":"4:30 PM - 10:00 PM","thursday":"4:30 PM - 10:00 PM","friday":"4:30 PM - 11:00 PM","saturday":"4:30 PM - 11:00 PM","sunday":"4:30 PM - 10:00 PM"}'::jsonb, true,
   '{"maps":{"googleMapsUrl":"https://www.google.com/maps/search/?api=1&query=The%20Pink%20Door%201919%20Post%20Alley%2C%20Seattle%2C%20WA"}}'::jsonb),
  -- sea-zig-zag
  ('b0000000-0000-4000-8000-000000000026', E'Zig Zag Caf\u00e9', 47.6082, -122.3412, '1501 Western Ave, Seattle, WA', 'Seattle', 'WA',
   'Downtown', 'Cocktail Bar', 'cocktail_bar', 68, NULL, NULL,
   'smart_casual', 0, NULL, 3,
   'indoor', '{"monday":"5:00 PM - 1:00 AM","tuesday":"5:00 PM - 1:00 AM","wednesday":"5:00 PM - 1:00 AM","thursday":"5:00 PM - 1:00 AM","friday":"5:00 PM - 2:00 AM","saturday":"5:00 PM - 2:00 AM","sunday":"5:00 PM - 1:00 AM"}'::jsonb, true,
   '{"maps":{"googleMapsUrl":"https://www.google.com/maps/search/?api=1&query=Zig%20Zag%20Caf%C3%A9%201501%20Western%20Ave%2C%20Seattle%2C%20WA"}}'::jsonb),
  -- sea-monkey-loft
  ('b0000000-0000-4000-8000-000000000027', 'Monkey Loft', 47.5788, -122.3345, '2915 1st Ave S, Seattle, WA', 'Seattle', 'WA',
   'SODO', 'Nightclub', 'nightclub', 76, NULL, NULL,
   'casual', 1500, NULL, 2,
   'indoor', '{"thursday":"9:00 PM - 2:00 AM","friday":"9:00 PM - 3:00 AM","saturday":"9:00 PM - 3:00 AM"}'::jsonb, true,
   '{"maps":{"googleMapsUrl":"https://www.google.com/maps/search/?api=1&query=Monkey%20Loft%202915%201st%20Ave%20S%2C%20Seattle%2C%20WA"}}'::jsonb),
  -- sea-chop-suey
  ('b0000000-0000-4000-8000-000000000028', 'Chop Suey', 47.6139, -122.3135, '1325 E Madison St, Seattle, WA', 'Seattle', 'WA',
   'Capitol Hill', 'Music Venue', 'music_venue', 64, NULL, NULL,
   'casual', 1500, NULL, 2,
   'indoor', '{"wednesday":"7:00 PM - 2:00 AM","thursday":"7:00 PM - 2:00 AM","friday":"7:00 PM - 2:00 AM","saturday":"7:00 PM - 2:00 AM"}'::jsonb, true,
   '{"maps":{"googleMapsUrl":"https://www.google.com/maps/search/?api=1&query=Chop%20Suey%201325%20E%20Madison%20St%2C%20Seattle%2C%20WA"}}'::jsonb),
  -- sea-lincoln
  ('b0000000-0000-4000-8000-000000000029', 'Lincoln', 47.6205, -122.3128, '801 E Thomas St, Seattle, WA', 'Seattle', 'WA',
   'Capitol Hill', 'Bar', 'bar', 57, NULL, NULL,
   'casual', 0, NULL, 2,
   'indoor', '{"monday":"4:00 PM - 2:00 AM","tuesday":"4:00 PM - 2:00 AM","wednesday":"4:00 PM - 2:00 AM","thursday":"4:00 PM - 2:00 AM","friday":"4:00 PM - 2:00 AM","saturday":"12:00 PM - 2:00 AM","sunday":"12:00 PM - 2:00 AM"}'::jsonb, true,
   '{"maps":{"googleMapsUrl":"https://www.google.com/maps/search/?api=1&query=Lincoln%20801%20E%20Thomas%20St%2C%20Seattle%2C%20WA"}}'::jsonb),
  -- sea-optimism
  ('b0000000-0000-4000-8000-000000000030', 'Optimism Brewing', 47.6148, -122.3175, '1158 Broadway, Seattle, WA', 'Seattle', 'WA',
   'Capitol Hill', 'Brewery', 'brewery', 53, NULL, 'https://optimismbrewing.com',
   'casual', 0, NULL, 2,
   'both', '{"monday":"12:00 PM - 10:00 PM","tuesday":"12:00 PM - 10:00 PM","wednesday":"12:00 PM - 10:00 PM","thursday":"12:00 PM - 11:00 PM","friday":"12:00 PM - 12:00 AM","saturday":"12:00 PM - 12:00 AM","sunday":"12:00 PM - 10:00 PM"}'::jsonb, true,
   '{"maps":{"googleMapsUrl":"https://www.google.com/maps/search/?api=1&query=Optimism%20Brewing%201158%20Broadway%2C%20Seattle%2C%20WA"}}'::jsonb),
  -- sea-bathtub-gin
  ('b0000000-0000-4000-8000-000000000031', 'Bathtub Gin & Co.', 47.6136, -122.3456, '2207 2nd Ave, Seattle, WA', 'Seattle', 'WA',
   'Belltown', 'Cocktail Bar', 'cocktail_bar', 71, NULL, NULL,
   'smart_casual', 0, NULL, 3,
   'indoor', '{"monday":"5:00 PM - 1:00 AM","tuesday":"5:00 PM - 1:00 AM","wednesday":"5:00 PM - 1:00 AM","thursday":"5:00 PM - 1:00 AM","friday":"5:00 PM - 2:00 AM","saturday":"5:00 PM - 2:00 AM","sunday":"5:00 PM - 1:00 AM"}'::jsonb, true,
   '{"maps":{"googleMapsUrl":"https://www.google.com/maps/search/?api=1&query=Bathtub%20Gin%20%26%20Co.%202207%202nd%20Ave%2C%20Seattle%2C%20WA"}}'::jsonb),
  -- sea-noble-fir
  ('b0000000-0000-4000-8000-000000000032', 'The Noble Fir', 47.6018, -122.3345, '531 1st Ave S, Seattle, WA', 'Seattle', 'WA',
   'Pioneer Square', 'Bar', 'bar', 49, NULL, NULL,
   'casual', 0, NULL, 2,
   'indoor', '{"monday":"4:00 PM - 12:00 AM","tuesday":"4:00 PM - 12:00 AM","wednesday":"4:00 PM - 12:00 AM","thursday":"4:00 PM - 1:00 AM","friday":"4:00 PM - 2:00 AM","saturday":"2:00 PM - 2:00 AM","sunday":"2:00 PM - 12:00 AM"}'::jsonb, true,
   '{"maps":{"googleMapsUrl":"https://www.google.com/maps/search/?api=1&query=The%20Noble%20Fir%20531%201st%20Ave%20S%2C%20Seattle%2C%20WA"}}'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  location_lat = EXCLUDED.location_lat,
  location_lng = EXCLUDED.location_lng,
  location_address = EXCLUDED.location_address,
  city = EXCLUDED.city,
  state = EXCLUDED.state,
  neighborhood = EXCLUDED.neighborhood,
  category = EXCLUDED.category,
  category_key = EXCLUDED.category_key,
  phone = EXCLUDED.phone,
  website = EXCLUDED.website,
  dress_code = EXCLUDED.dress_code,
  cover_charge_cents = EXCLUDED.cover_charge_cents,
  cover_charge_note = EXCLUDED.cover_charge_note,
  price_range = EXCLUDED.price_range,
  indoor_outdoor = EXCLUDED.indoor_outdoor,
  hours = EXCLUDED.hours,
  seeded = true,
  integrations = venues.integrations || EXCLUDED.integrations;
  -- Deliberately NOT touched on conflict: pulse_score, score_velocity,
  -- last_pulse_at, place_id, enriched_at, enrichment_source, menu_url,
  -- capacity_hint, accessibility_features — those are dynamic / enrichment
  -- fields owned by live scoring and the Places-enrich pipeline, not the
  -- curated catalog. `integrations` is merged (not replaced) so any
  -- additionally-enriched integration blocks (music, reservations) survive
  -- a re-run of this seed.
