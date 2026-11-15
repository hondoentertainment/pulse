-- Run after:
--   supabase/migrations/20261005120000_portland_san_francisco_launch_venues.sql
--   supabase/migrations/20261115180000_portland_san_francisco_weekend_venues.sql
--
-- Expect 35 alive curated-seed rows in Portland, OR and 35 in San Francisco, CA
-- (32 from the coast launch, plus 3 Division and 3 Western Addition).
-- Apply the weekend file on production project xeldqwhztcnnvazmshzh only after
-- Kyle OKs, and before the catalog PR merges. Do not apply from the app.
-- Do not mass-delete.

SELECT
  city,
  state,
  COUNT(*) FILTER (WHERE deleted_at IS NULL) AS alive,
  COUNT(*) FILTER (WHERE deleted_at IS NULL AND inventory_source = 'curated-seed') AS curated,
  COUNT(*) FILTER (WHERE deleted_at IS NULL AND pulse_score = 0) AS zero_score
FROM venues
WHERE (city = 'Portland' AND state = 'OR')
   OR (city = 'San Francisco' AND state = 'CA')
GROUP BY city, state
ORDER BY city;
-- Portland curated = 35. San Francisco curated = 35.

SELECT city, neighborhood, COUNT(*) AS curated
FROM venues
WHERE deleted_at IS NULL
  AND inventory_source = 'curated-seed'
  AND (
    (city = 'Portland' AND state = 'OR' AND neighborhood = 'Division')
    OR (city = 'San Francisco' AND state = 'CA' AND neighborhood = 'Western Addition')
  )
GROUP BY city, neighborhood
ORDER BY city;
-- Division = 3. Western Addition = 3.

SELECT id, name, neighborhood
FROM venues
WHERE deleted_at IS NULL
  AND id IN (
    'd0000000-0000-4000-8000-000000000001'::uuid,
    'd0000000-0000-4000-8000-000000000033'::uuid,
    'd0000000-0000-4000-8000-000000000034'::uuid,
    'd0000000-0000-4000-8000-000000000035'::uuid,
    'e0000000-0000-4000-8000-000000000001'::uuid,
    'e0000000-0000-4000-8000-000000000033'::uuid,
    'e0000000-0000-4000-8000-000000000034'::uuid,
    'e0000000-0000-4000-8000-000000000035'::uuid
  )
ORDER BY id;
-- d000…0001 Crystal Ballroom (share slug pdx-crystal-ballroom)
-- d000…0033 Double Barrel Tavern (pdx-double-barrel) — no public website
-- d000…0034 Reel M Inn (pdx-reel-m-inn)
-- d000…0035 The Automatic (pdx-the-automatic)
-- e000…0001 The Chapel (share slug sf-chapel)
-- e000…0033 The Fillmore (sf-the-fillmore)
-- e000…0034 The Independent (sf-the-independent)
-- e000…0035 Boom Boom Room (sf-boom-boom-room)
