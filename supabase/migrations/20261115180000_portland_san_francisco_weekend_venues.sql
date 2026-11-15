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
--
-- supabase/seed.sql used to insert The Fillmore as
-- a0000000-0000-4000-8000-000000000017 at this same name and address.
-- A name+address match would keep that id and skip
-- e0000000-0000-4000-8000-000000000033, which is the id the catalog ships
-- for sf-the-fillmore. Move any live row at that name and address onto
-- the curated id, including rows that reference it, before the upsert.

CREATE UNIQUE INDEX IF NOT EXISTS idx_venues_san_francisco_name_address_alive
  ON venues (lower(name), lower(location_address))
  WHERE city = 'San Francisco' AND state = 'CA' AND deleted_at IS NULL;

DO $$
DECLARE
  new_id uuid := 'e0000000-0000-4000-8000-000000000033';
  old_id uuid;
  col_list text;
  select_list text;
  ref record;
BEGIN
  SELECT v.id
  INTO old_id
  FROM public.venues v
  WHERE v.deleted_at IS NULL
    AND v.id <> new_id
    AND lower(v.name) = 'the fillmore'
    AND lower(v.location_address) = lower('1805 Geary Blvd, San Francisco, CA')
    AND v.city = 'San Francisco'
    AND v.state = 'CA'
  LIMIT 1;

  IF old_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.venues WHERE id = new_id) THEN
    SELECT
      string_agg(quote_ident(a.attname), ', ' ORDER BY a.attnum),
      string_agg(
        CASE
          WHEN a.attname = 'id' THEN quote_literal(new_id) || '::uuid'
          WHEN a.attname = 'location_address' THEN quote_ident(a.attname) || ' || '' (curated id)'''
          ELSE quote_ident(a.attname)
        END,
        ', ' ORDER BY a.attnum
      )
    INTO col_list, select_list
    FROM pg_attribute a
    WHERE a.attrelid = 'public.venues'::regclass
      AND a.attnum > 0
      AND NOT a.attisdropped
      AND a.attgenerated = '';

    EXECUTE format(
      'INSERT INTO public.venues (%s) SELECT %s FROM public.venues WHERE id = $1',
      col_list,
      select_list
    ) USING old_id;
  END IF;

  FOR ref IN
    SELECT
      ns.nspname AS schema_name,
      cl.relname AS table_name,
      att.attname AS column_name
    FROM pg_constraint con
    JOIN pg_class cl ON cl.oid = con.conrelid
    JOIN pg_namespace ns ON ns.oid = cl.relnamespace
    JOIN LATERAL unnest(con.conkey) AS key(attnum) ON true
    JOIN pg_attribute att ON att.attrelid = cl.oid AND att.attnum = key.attnum
    WHERE con.contype = 'f'
      AND con.confrelid = 'public.venues'::regclass
  LOOP
    EXECUTE format(
      'UPDATE %I.%I SET %I = $1 WHERE %I = $2',
      ref.schema_name,
      ref.table_name,
      ref.column_name,
      ref.column_name
    ) USING new_id, old_id;
  END LOOP;

  FOR ref IN
    SELECT n.nspname AS schema_name, c.relname AS table_name
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_type t ON t.oid = a.atttypid
    WHERE a.attname = 'venue_id'
      AND t.typname = 'text'
      AND n.nspname = 'public'
      AND c.relkind = 'r'
      AND NOT a.attisdropped
  LOOP
    EXECUTE format(
      'UPDATE %I.%I SET venue_id = $1 WHERE venue_id = $2',
      ref.schema_name,
      ref.table_name
    ) USING new_id::text, old_id::text;
  END LOOP;

  DELETE FROM public.venues WHERE id = old_id;
END $$;

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
