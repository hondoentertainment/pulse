-- Run after:
--   supabase/migrations/20261005120000_portland_san_francisco_launch_venues.sql
--
-- Expect 32 alive curated-seed rows in Portland, OR and 32 in San Francisco, CA.
-- Apply on production project xeldqwhztcnnvazmshzh after merge. Do not apply
-- from the app. Do not mass-delete.

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
-- Portland curated = 32. San Francisco curated = 32.

SELECT id, name, neighborhood
FROM venues
WHERE deleted_at IS NULL
  AND id IN (
    'd0000000-0000-4000-8000-000000000001'::uuid,
    'e0000000-0000-4000-8000-000000000001'::uuid
  )
ORDER BY id;
-- d000…0001 Crystal Ballroom (share slug pdx-crystal-ballroom)
-- e000…0001 The Chapel (share slug sf-chapel)
