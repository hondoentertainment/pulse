-- Idempotent Seattle launch venue catalog (P0-4).
--
-- Source of truth: src/lib/seattle-launch-venues.ts (33 curated nightlife venues).
-- pulse_score stays 0 on insert / on rows with no live pulses — never invent reports.
-- Soft-deleted matches are left deleted (no resurrection, no duplicate insert).
-- Safe to re-run against empty or partially seeded venues tables.

CREATE UNIQUE INDEX IF NOT EXISTS idx_venues_seattle_name_address_alive
  ON venues (lower(name), lower(location_address))
  WHERE city = 'Seattle' AND state = 'WA' AND deleted_at IS NULL;

WITH catalog (
  id,
  name,
  location_lat,
  location_lng,
  location_address,
  neighborhood,
  category,
  hours,
  phone,
  website
) AS (
  VALUES
    -- Capitol Hill
    ('a0000000-0000-4000-8000-000000000018'::uuid, 'Neumos', 47.6145, -122.3205, '925 E Pike St, Seattle, WA', 'Capitol Hill', 'Music Venue',
      '{"wednesday":"8:00 PM - 2:00 AM","thursday":"8:00 PM - 2:00 AM","friday":"8:00 PM - 2:00 AM","saturday":"8:00 PM - 2:00 AM"}'::jsonb,
      '(206) 709-9442', 'https://neumos.com'),
    ('c0000000-0000-4000-8000-000000000001'::uuid, 'Barboza', 47.6145, -122.3207, '925 E Pike St, Seattle, WA', 'Capitol Hill', 'Lounge',
      NULL::jsonb, NULL, NULL),
    ('a0000000-0000-4000-8000-000000000019'::uuid, 'Q Nightclub', 47.6138, -122.3198, '1426 Broadway, Seattle, WA', 'Capitol Hill', 'Nightclub',
      '{"thursday":"9:00 PM - 3:00 AM","friday":"9:00 PM - 4:00 AM","saturday":"9:00 PM - 4:00 AM"}'::jsonb,
      '(206) 200-7074', 'https://qnightclub.com'),
    ('c0000000-0000-4000-8000-000000000002'::uuid, 'The Unicorn', 47.6142, -122.3196, '1118 E Pike St, Seattle, WA', 'Capitol Hill', 'Bar',
      '{"monday":"4:00 PM - 2:00 AM","tuesday":"4:00 PM - 2:00 AM","wednesday":"4:00 PM - 2:00 AM","thursday":"4:00 PM - 2:00 AM","friday":"4:00 PM - 2:00 AM","saturday":"12:00 PM - 2:00 AM","sunday":"12:00 PM - 2:00 AM"}'::jsonb,
      '(206) 325-6492', 'https://unicornseattle.com'),
    ('c0000000-0000-4000-8000-000000000003'::uuid, 'Chop Suey', 47.6145, -122.3194, '1325 E Madison St, Seattle, WA', 'Capitol Hill', 'Music Venue',
      NULL::jsonb, NULL, NULL),
    ('c0000000-0000-4000-8000-000000000004'::uuid, 'The Comet Tavern', 47.6142, -122.3181, '922 E Pike St, Seattle, WA', 'Capitol Hill', 'Bar',
      NULL::jsonb, NULL, NULL),
    ('c0000000-0000-4000-8000-000000000005'::uuid, 'Linda''s Tavern', 47.6140, -122.3209, '707 E Pine St, Seattle, WA', 'Capitol Hill', 'Bar',
      NULL::jsonb, NULL, NULL),
    ('c0000000-0000-4000-8000-000000000006'::uuid, 'Neighbours', 47.6141, -122.3202, '1509 Broadway, Seattle, WA', 'Capitol Hill', 'Nightclub',
      NULL::jsonb, NULL, NULL),

    -- Belltown
    ('c0000000-0000-4000-8000-000000000007'::uuid, 'The Crocodile', 47.6134, -122.3443, '2505 1st Ave, Seattle, WA', 'Belltown', 'Music Venue',
      '{"tuesday":"6:00 PM - 2:00 AM","wednesday":"6:00 PM - 2:00 AM","thursday":"6:00 PM - 2:00 AM","friday":"6:00 PM - 2:00 AM","saturday":"6:00 PM - 2:00 AM"}'::jsonb,
      '(206) 441-5611', 'https://thecrocodile.com'),
    ('c0000000-0000-4000-8000-000000000008'::uuid, 'The 5 Point Cafe', 47.6182, -122.3476, '415 Cedar St, Seattle, WA', 'Belltown', 'Bar',
      NULL::jsonb, NULL, NULL),
    ('c0000000-0000-4000-8000-000000000009'::uuid, 'Rendezvous', 47.6148, -122.3456, '2322 2nd Ave, Seattle, WA', 'Belltown', 'Bar',
      NULL::jsonb, NULL, NULL),
    ('c0000000-0000-4000-8000-000000000010'::uuid, 'Shorty''s', 47.6149, -122.3452, '2222 2nd Ave, Seattle, WA', 'Belltown', 'Bar',
      NULL::jsonb, NULL, NULL),
    ('c0000000-0000-4000-8000-000000000011'::uuid, 'Rob Roy', 47.6156, -122.3471, '2332 2nd Ave, Seattle, WA', 'Belltown', 'Bar',
      NULL::jsonb, NULL, NULL),
    ('c0000000-0000-4000-8000-000000000012'::uuid, 'The Whisky Bar', 47.6131, -122.3458, '2122 2nd Ave, Seattle, WA', 'Belltown', 'Bar',
      NULL::jsonb, NULL, NULL),

    -- Fremont
    ('c0000000-0000-4000-8000-000000000013'::uuid, 'Nectar Lounge', 47.6516, -122.3542, '412 N 36th St, Seattle, WA', 'Fremont', 'Music Venue',
      NULL::jsonb, NULL, NULL),
    ('c0000000-0000-4000-8000-000000000014'::uuid, 'Fremont Brewing', 47.6491, -122.3446, '1050 N 34th St, Seattle, WA', 'Fremont', 'Brewery',
      '{"monday":"11:00 AM - 9:00 PM","tuesday":"11:00 AM - 9:00 PM","wednesday":"11:00 AM - 9:00 PM","thursday":"11:00 AM - 9:00 PM","friday":"11:00 AM - 10:00 PM","saturday":"11:00 AM - 10:00 PM","sunday":"11:00 AM - 9:00 PM"}'::jsonb,
      '(206) 420-2407', 'https://fremontbrewing.com'),
    ('c0000000-0000-4000-8000-000000000015'::uuid, 'The George & Dragon Pub', 47.6514, -122.3558, '206 N 36th St, Seattle, WA', 'Fremont', 'Bar',
      NULL::jsonb, NULL, NULL),
    ('c0000000-0000-4000-8000-000000000016'::uuid, 'Norm''s Eatery & Ale House', 47.6515, -122.3518, '460 N 36th St, Seattle, WA', 'Fremont', 'Bar',
      NULL::jsonb, NULL, NULL),
    ('c0000000-0000-4000-8000-000000000017'::uuid, 'Fremont Abbey Arts Center', 47.6612, -122.3499, '4272 Fremont Ave N, Seattle, WA', 'Fremont', 'Music Venue',
      NULL::jsonb, NULL, NULL),
    ('c0000000-0000-4000-8000-000000000018'::uuid, 'Westward', 47.6478, -122.3476, '2501 N Northlake Way, Seattle, WA', 'Fremont', 'Restaurant',
      NULL::jsonb, NULL, NULL),

    -- Ballard
    ('c0000000-0000-4000-8000-000000000019'::uuid, 'Tractor Tavern', 47.6658, -122.3828, '5213 Ballard Ave NW, Seattle, WA', 'Ballard', 'Music Venue',
      NULL::jsonb, NULL, NULL),
    ('c0000000-0000-4000-8000-000000000020'::uuid, 'The Sunset Tavern', 47.6684, -122.3853, '5433 Ballard Ave NW, Seattle, WA', 'Ballard', 'Bar',
      NULL::jsonb, NULL, NULL),
    ('c0000000-0000-4000-8000-000000000021'::uuid, 'Conor Byrne Pub', 47.6667, -122.3836, '5140 Ballard Ave NW, Seattle, WA', 'Ballard', 'Bar',
      NULL::jsonb, NULL, NULL),
    ('c0000000-0000-4000-8000-000000000022'::uuid, 'Hattie''s Hat', 47.6681, -122.3847, '5231 Ballard Ave NW, Seattle, WA', 'Ballard', 'Bar',
      NULL::jsonb, NULL, NULL),
    ('c0000000-0000-4000-8000-000000000023'::uuid, 'The Noble Fir', 47.6649, -122.3814, '5316 Ballard Ave NW, Seattle, WA', 'Ballard', 'Bar',
      NULL::jsonb, NULL, NULL),
    ('c0000000-0000-4000-8000-000000000024'::uuid, 'King''s Hardware', 47.6686, -122.3872, '5225 Ballard Ave NW, Seattle, WA', 'Ballard', 'Bar',
      NULL::jsonb, NULL, NULL),

    -- Downtown
    ('c0000000-0000-4000-8000-000000000025'::uuid, 'The Showbox', 47.6084, -122.3395, '1426 1st Ave, Seattle, WA', 'Downtown', 'Music Venue',
      '{"wednesday":"7:00 PM - 2:00 AM","thursday":"7:00 PM - 2:00 AM","friday":"7:00 PM - 2:00 AM","saturday":"7:00 PM - 2:00 AM","sunday":"7:00 PM - 2:00 AM"}'::jsonb,
      '(206) 628-3151', 'https://showboxpresents.com'),
    ('c0000000-0000-4000-8000-000000000026'::uuid, 'The Triple Door', 47.6082, -122.3368, '216 Union St, Seattle, WA', 'Downtown', 'Music Venue',
      NULL::jsonb, NULL, NULL),
    ('c0000000-0000-4000-8000-000000000027'::uuid, 'The Paramount Theatre', 47.6133, -122.3314, '911 Pine St, Seattle, WA', 'Downtown', 'Music Venue',
      NULL::jsonb, NULL, NULL),
    ('c0000000-0000-4000-8000-000000000028'::uuid, 'The Moore Theatre', 47.6118, -122.3415, '1932 2nd Ave, Seattle, WA', 'Downtown', 'Music Venue',
      NULL::jsonb, NULL, NULL),
    ('c0000000-0000-4000-8000-000000000029'::uuid, 'Dimitriou''s Jazz Alley', 47.6164, -122.3378, '2033 6th Ave, Seattle, WA', 'Downtown', 'Music Venue',
      NULL::jsonb, NULL, NULL),
    ('c0000000-0000-4000-8000-000000000030'::uuid, 'Foundation Nightclub', 47.6018, -122.3341, '2218 Western Ave, Seattle, WA', 'Downtown', 'Nightclub',
      NULL::jsonb, NULL, NULL),
    ('c0000000-0000-4000-8000-000000000031'::uuid, 'The Central Saloon', 47.6005, -122.3342, '207 1st Ave S, Seattle, WA', 'Downtown', 'Bar',
      NULL::jsonb, NULL, NULL)
),
updated AS (
  UPDATE venues v
  SET
    name = c.name,
    location_lat = c.location_lat,
    location_lng = c.location_lng,
    location_address = c.location_address,
    city = 'Seattle',
    state = 'WA',
    neighborhood = c.neighborhood,
    category = c.category,
    seeded = true,
    inventory_source = 'curated-seed',
    hours = c.hours,
    phone = c.phone,
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
        AND v.city = 'Seattle'
        AND v.state = 'WA'
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
  hours,
  phone,
  website
)
SELECT
  c.id,
  c.name,
  c.location_lat,
  c.location_lng,
  c.location_address,
  'Seattle',
  'WA',
  c.neighborhood,
  c.category,
  0,
  0,
  true,
  'curated-seed',
  c.hours,
  c.phone,
  c.website
FROM catalog c
WHERE NOT EXISTS (
  SELECT 1
  FROM venues v
  WHERE v.id = c.id
     OR (
       lower(v.name) = lower(c.name)
       AND lower(v.location_address) = lower(c.location_address)
       AND v.city = 'Seattle'
       AND v.state = 'WA'
     )
);

-- Production map path uses this RPC. Return launch metadata and hide soft-deleted rows.
DROP FUNCTION IF EXISTS get_live_venue_intelligence(INTEGER);

CREATE FUNCTION get_live_venue_intelligence(max_pulses INTEGER DEFAULT 1000)
RETURNS TABLE (
    id UUID,
    name TEXT,
    location_lat FLOAT,
    location_lng FLOAT,
    location_address TEXT,
    city TEXT,
    state TEXT,
    category TEXT,
    pulse_score FLOAT,
    score_velocity FLOAT,
    last_pulse_at TIMESTAMP WITH TIME ZONE,
    pre_trending BOOLEAN,
    pre_trending_label TEXT,
    seeded BOOLEAN,
    verified_check_in_count INTEGER,
    first_real_check_in_at TIMESTAMP WITH TIME ZONE,
    hours JSONB,
    phone TEXT,
    website TEXT,
    integrations JSONB,
    live_summary JSONB,
    recent_pulse_count INTEGER,
    recent_unique_users INTEGER,
    latest_activity_at TIMESTAMP WITH TIME ZONE,
    neighborhood TEXT,
    inventory_source TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH recent_pulses AS (
        SELECT *
        FROM pulses
        WHERE created_at >= TIMEZONE('utc'::text, NOW()) - INTERVAL '24 hours'
          AND deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT max_pulses
    ),
    pulse_rollup AS (
        SELECT
            venue_id,
            COUNT(*)::INTEGER AS recent_pulse_count,
            COUNT(DISTINCT user_id)::INTEGER AS recent_unique_users,
            MAX(created_at) AS latest_activity_at
        FROM recent_pulses
        GROUP BY venue_id
    )
    SELECT
        v.id,
        v.name,
        v.location_lat,
        v.location_lng,
        v.location_address,
        v.city,
        v.state,
        v.category,
        GREATEST(v.pulse_score, COALESCE(a.crowd_level, 0) * 0.3)::FLOAT AS pulse_score,
        v.score_velocity,
        v.last_pulse_at,
        v.pre_trending,
        v.pre_trending_label,
        v.seeded,
        v.verified_check_in_count,
        v.first_real_check_in_at,
        v.hours,
        v.phone,
        v.website,
        v.integrations,
        CASE WHEN a.venue_id IS NULL THEN NULL ELSE to_jsonb(a) END AS live_summary,
        COALESCE(pr.recent_pulse_count, 0),
        COALESCE(pr.recent_unique_users, 0),
        COALESCE(pr.latest_activity_at, v.last_pulse_at),
        v.neighborhood,
        v.inventory_source
    FROM venues v
    LEFT JOIN venue_live_aggregates a ON a.venue_id = v.id
    LEFT JOIN pulse_rollup pr ON pr.venue_id = v.id
    WHERE v.deleted_at IS NULL
    ORDER BY GREATEST(v.pulse_score, COALESCE(a.crowd_level, 0) * 0.3) DESC, pr.latest_activity_at DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION get_live_venue_intelligence(INTEGER) TO anon, authenticated, service_role;
