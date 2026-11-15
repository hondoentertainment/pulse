-- Idempotent Portland Division and San Francisco Western Addition seeds.
--
-- Source of truth: the Division rooms appended in
-- src/lib/portland-launch-venues.ts and the Western Addition rooms appended
-- in src/lib/san-francisco-launch-venues.ts. UUIDs continue the coast
-- prefixes (d000… / e000…). Share slugs stay aliases and are not stored.
-- pulse_score stays 0 until a real pulse exists. No photos. No hours.
-- Soft-deleted matches stay deleted (no resurrection, no duplicate insert).
--
-- Do NOT apply on production project xeldqwhztcnnvazmshzh until Kyle OKs.
-- When he does, apply this file before the catalog PR merges, then run
-- supabase/verify/portland_san_francisco_launch_venues.sql.
-- Do not mass-delete. Do not run this from CI.

-- Portland, OR: Division. Three rooms (catalog indexes 33-35).

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
    ('d0000000-0000-4000-8000-000000000033'::uuid, 'pdx-double-barrel', 'Double Barrel Tavern', 45.5046, -122.6454, '2002 SE Division St, Portland, OR', 'Division', 'Bar', NULL::text),
    ('d0000000-0000-4000-8000-000000000034'::uuid, 'pdx-reel-m-inn', 'Reel M Inn', 45.5047, -122.6406, '2430 SE Division St, Portland, OR', 'Division', 'Bar', 'https://www.reelminnpdx.com'),
    ('d0000000-0000-4000-8000-000000000035'::uuid, 'pdx-the-automatic', 'The Automatic', 45.5047, -122.6254, '3652 SE Division St, Portland, OR', 'Division', 'Bar', 'https://www.theautomaticbarpdx.com')
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

-- San Francisco, CA: Western Addition. Three rooms (catalog indexes 33-35).

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
    ('e0000000-0000-4000-8000-000000000033'::uuid, 'sf-the-fillmore', 'The Fillmore', 37.7841, -122.4332, '1805 Geary Blvd, San Francisco, CA', 'Western Addition', 'Music Venue', 'https://www.thefillmore.com'),
    ('e0000000-0000-4000-8000-000000000034'::uuid, 'sf-the-independent', 'The Independent', 37.7755, -122.4376, '628 Divisadero St, San Francisco, CA', 'Western Addition', 'Music Venue', 'https://www.theindependentsf.com'),
    ('e0000000-0000-4000-8000-000000000035'::uuid, 'sf-boom-boom-room', 'Boom Boom Room', 37.7846, -122.4331, '1601 Fillmore St, San Francisco, CA', 'Western Addition', 'Music Venue', 'https://boomboomroom.com')
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
