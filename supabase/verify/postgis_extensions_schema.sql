-- Verify PostGIS lives in schema extensions and public.spatial_ref_sys is gone.
-- Run after supabase/migrations/20261015140000_move_postgis_to_extensions.sql.
--
-- Expect:
--   postgis_schema = extensions
--   postgis_version = 3.3.7 on project xeldqwhztcnnvazmshzh
--   public_spatial_ref_sys_absent = true
--   srid_4326 = true
--   seattle_portland_meters about 233962.357
--   calculate_distance_miles = seattle_portland_meters / 1609.344
--   venues_geom_type = extensions.geometry
--   calculate_distance and get_live_venue_intelligence search_path include extensions

SELECT
  (
    SELECT n.nspname
    FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'postgis'
  ) AS postgis_schema,
  (
    SELECT e.extversion
    FROM pg_extension e
    WHERE e.extname = 'postgis'
  ) AS postgis_version,
  (
    SELECT e.extrelocatable
    FROM pg_extension e
    WHERE e.extname = 'postgis'
  ) AS extrelocatable,
  to_regclass('public.spatial_ref_sys') IS NULL AS public_spatial_ref_sys_absent,
  to_regclass('extensions.spatial_ref_sys') IS NOT NULL AS extensions_spatial_ref_sys,
  EXISTS (
    SELECT 1 FROM extensions.spatial_ref_sys WHERE srid = 4326
  ) AS srid_4326;

SELECT round(extensions.ST_Distance(
  extensions.ST_SetSRID(extensions.ST_MakePoint(-122.32, 47.61), 4326)::extensions.geography,
  extensions.ST_SetSRID(extensions.ST_MakePoint(-122.68, 45.52), 4326)::extensions.geography
)::numeric, 8) AS seattle_portland_meters;

SELECT round(public.calculate_distance(47.61, -122.32, 45.52, -122.68)::numeric, 8) AS calculate_distance_miles;

SELECT
  n.nspname AS geom_type_schema,
  format_type(a.atttypid, a.atttypmod) AS venues_geom_type,
  a.attgenerated AS venues_geom_generated,
  EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'venues' AND indexname = 'idx_venues_geom'
  ) AS gist_index
FROM pg_attribute a
JOIN pg_class c ON c.oid = a.attrelid
JOIN pg_namespace cn ON cn.oid = c.relnamespace
JOIN pg_type t ON t.oid = a.atttypid
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE cn.nspname = 'public'
  AND c.relname = 'venues'
  AND a.attname = 'geom'
  AND NOT a.attisdropped;

SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args, p.proconfig
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('calculate_distance', 'get_live_venue_intelligence')
ORDER BY p.proname;

SELECT rolname, rolconfig
FROM pg_roles
WHERE rolname IN ('anon', 'authenticated', 'service_role', 'authenticator', 'postgres')
ORDER BY rolname;

SELECT COUNT(*) AS intelligence_rows
FROM public.get_live_venue_intelligence(1000);

SELECT COUNT(*) AS venues_with_geom
FROM public.venues
WHERE geom IS NOT NULL
  AND extensions.ST_SRID(geom) = 4326;
