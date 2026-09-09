-- Run in the production Supabase SQL editor after applying:
--   supabase/migrations/20260909120000_seattle_launch_venue_catalog.sql
--
-- Expect 33 alive Seattle,WA curated-seed venues across 5 launch neighborhoods.

SELECT
  COUNT(*) FILTER (WHERE deleted_at IS NULL) AS seattle_alive,
  COUNT(*) FILTER (WHERE deleted_at IS NULL AND inventory_source = 'curated-seed') AS curated,
  COUNT(*) FILTER (WHERE deleted_at IS NULL AND pulse_score = 0) AS zero_score
FROM venues
WHERE city = 'Seattle' AND state = 'WA';
-- seattle_alive and curated must be 33.

SELECT neighborhood, COUNT(*) AS venues
FROM venues
WHERE city = 'Seattle' AND state = 'WA' AND deleted_at IS NULL
GROUP BY neighborhood
ORDER BY neighborhood;
-- Expect: Ballard 6, Belltown 6, Capitol Hill 8, Downtown 7, Fremont 6.

SELECT COUNT(*) AS intelligence_rows
FROM get_live_venue_intelligence(1000)
WHERE city = 'Seattle' AND state = 'WA';
-- Expect 33.
