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
--   each API role's effective search_path (role-in-database, else database)
--     includes extensions and is stored with ALTER ROLE ... IN DATABASE
--   cluster_wide_rolconfig is informational; this migration does not set it

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

-- Database search_path for this database only (setrole = 0).
SELECT current_database() AS database,
  (
    SELECT regexp_replace(x, '^search_path=', '')
    FROM pg_db_role_setting s
    CROSS JOIN LATERAL unnest(s.setconfig) AS x
    WHERE s.setdatabase = (SELECT oid FROM pg_database WHERE datname = current_database())
      AND s.setrole = 0
      AND split_part(x, '=', 1) = 'search_path'
    LIMIT 1
  ) AS database_search_path;

-- Effective path is the role-in-database setting, else the database setting,
-- else the server default. extensions must be present. cluster_wide_rolconfig
-- is the setdatabase = 0 row and is not updated by the migration.
WITH db AS (
  SELECT oid FROM pg_database WHERE datname = current_database()
),
roles AS (
  SELECT r.oid, r.rolname, r.rolconfig
  FROM pg_roles r
  WHERE r.rolname IN ('anon', 'authenticated', 'service_role', 'authenticator', 'postgres')
),
role_in_db AS (
  SELECT
    r.rolname,
    (
      SELECT regexp_replace(x, '^search_path=', '')
      FROM pg_db_role_setting s
      CROSS JOIN LATERAL unnest(s.setconfig) AS x
      WHERE s.setdatabase = (SELECT oid FROM db)
        AND s.setrole = r.oid
        AND split_part(x, '=', 1) = 'search_path'
      LIMIT 1
    ) AS role_in_db_search_path,
    r.rolconfig AS cluster_wide_rolconfig
  FROM roles r
),
database_path AS (
  SELECT (
    SELECT regexp_replace(x, '^search_path=', '')
    FROM pg_db_role_setting s
    CROSS JOIN LATERAL unnest(s.setconfig) AS x
    WHERE s.setdatabase = (SELECT oid FROM db)
      AND s.setrole = 0
      AND split_part(x, '=', 1) = 'search_path'
    LIMIT 1
  ) AS database_search_path
)
SELECT
  d.rolname,
  d.role_in_db_search_path,
  p.database_search_path,
  COALESCE(d.role_in_db_search_path, p.database_search_path, '"$user", public') AS effective_search_path,
  COALESCE(d.role_in_db_search_path, p.database_search_path, '"$user", public')
    ~ '(^|,)[[:space:]]*"?extensions"?[[:space:]]*(,|$)' AS effective_includes_extensions,
  d.cluster_wide_rolconfig
FROM role_in_db d
CROSS JOIN database_path p
ORDER BY d.rolname;

SELECT COUNT(*) AS intelligence_rows
FROM public.get_live_venue_intelligence(1000);

SELECT COUNT(*) AS venues_with_geom
FROM public.venues
WHERE geom IS NOT NULL
  AND extensions.ST_SRID(geom) = 4326;
