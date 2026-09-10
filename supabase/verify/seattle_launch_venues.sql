-- Run after:
--   supabase/migrations/20260909120000_seattle_launch_venue_catalog.sql
--   supabase/migrations/20260909180000_seattle_osm_venue_catalog.sql
--
-- Expect 33 curated-seed + 500 osm = 533 alive Seattle,WA venues.

SELECT
  COUNT(*) FILTER (WHERE deleted_at IS NULL) AS seattle_alive,
  COUNT(*) FILTER (WHERE deleted_at IS NULL AND inventory_source = 'curated-seed') AS curated,
  COUNT(*) FILTER (WHERE deleted_at IS NULL AND inventory_source = 'osm') AS osm,
  COUNT(*) FILTER (WHERE deleted_at IS NULL AND pulse_score = 0) AS zero_score
FROM venues
WHERE city = 'Seattle' AND state = 'WA';
-- curated must stay 33. osm is 500. seattle_alive is 533.

SELECT inventory_source, COUNT(*) AS venues
FROM venues
WHERE city = 'Seattle' AND state = 'WA' AND deleted_at IS NULL
GROUP BY inventory_source
ORDER BY inventory_source;

SELECT COUNT(*) AS intelligence_rows
FROM get_live_venue_intelligence(1000)
WHERE city = 'Seattle' AND state = 'WA';
-- Expect 533.
