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
--   calculate_distance body and venues.geom call extensions.ST_*
--   database_includes_extensions = true
--   anon, authenticated, service_role, and authenticator are not altered.
--     With no role search_path they inherit the database path. A role
--     search_path, when present, overrides the database path.
--   unqualified_postgis_functions = 0

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

-- Database search_path is what API roles inherit when they have no
-- role search_path. Hosted anon, authenticated, service_role, and
-- authenticator are in that state. extensions must be present here.
SELECT current_database() AS database,
  db_path.search_path AS database_search_path,
  COALESCE(db_path.search_path, '') ~ '(^|,)[[:space:]]*"?extensions"?[[:space:]]*(,|$)'
    AS database_includes_extensions
FROM (
  SELECT (
    SELECT regexp_replace(x, '^search_path=', '')
    FROM pg_db_role_setting s
    CROSS JOIN LATERAL unnest(s.setconfig) AS x
    WHERE s.setdatabase = (SELECT oid FROM pg_database WHERE datname = current_database())
      AND s.setrole = 0
      AND split_part(x, '=', 1) = 'search_path'
    LIMIT 1
  ) AS search_path
) db_path;

-- Direct-session path: role-in-database, else cluster-wide role setting,
-- else the database setting, else the server default. PostgREST does not
-- use this value; it SET search_path per request. Reserved API roles are
-- not required to have their own search_path.
WITH db AS (
  SELECT oid FROM pg_database WHERE datname = current_database()
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
),
roles AS (
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
    (
      SELECT regexp_replace(x, '^search_path=', '')
      FROM unnest(r.rolconfig) AS x
      WHERE split_part(x, '=', 1) = 'search_path'
      LIMIT 1
    ) AS cluster_search_path
  FROM pg_roles r
  WHERE r.rolname IN ('anon', 'authenticated', 'service_role', 'authenticator', 'postgres')
)
SELECT
  r.rolname,
  r.role_in_db_search_path,
  r.cluster_search_path,
  p.database_search_path,
  CASE
    WHEN r.role_in_db_search_path IS NOT NULL THEN 'role-in-database'
    WHEN r.cluster_search_path IS NOT NULL THEN 'cluster-role'
    WHEN p.database_search_path IS NOT NULL THEN 'database'
    ELSE 'default'
  END AS direct_session_source,
  COALESCE(r.role_in_db_search_path, r.cluster_search_path, p.database_search_path, '"$user", public')
    AS direct_session_search_path,
  COALESCE(r.role_in_db_search_path, r.cluster_search_path, p.database_search_path, '"$user", public')
    ~ '(^|,)[[:space:]]*"?extensions"?[[:space:]]*(,|$)' AS direct_session_includes_extensions
FROM roles r
CROSS JOIN database_path p
ORDER BY r.rolname;

-- App functions must not call PostGIS by an unqualified name. Strip
-- extensions.ST_* first so schema-qualified calls are not counted.
-- Word boundaries skip identifiers such as latest_activity_at.
SELECT count(*) AS unqualified_postgis_functions
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND regexp_replace(p.prosrc, 'extensions\.st_[a-z0-9_]+', '', 'gi') ~* '[[:<:]]st_[a-z0-9_]+'
  AND NOT EXISTS (
    SELECT 1
    FROM pg_depend d
    WHERE d.classid = 'pg_proc'::regclass
      AND d.objid = p.oid
      AND d.refclassid = 'pg_extension'::regclass
      AND d.deptype = 'e'
  );

-- pg_get_expr omits the schema when it can. The stored expression
-- references function OIDs; those must live in extensions.
SELECT
  string_agg(DISTINCT fn.nspname || '.' || p.proname, ', ' ORDER BY fn.nspname || '.' || p.proname)
    AS venues_geom_functions,
  bool_and(fn.nspname = 'extensions') AS venues_geom_schema_qualified
FROM pg_attrdef ad
JOIN pg_attribute a ON a.attrelid = ad.adrelid AND a.attnum = ad.adnum
JOIN pg_class c ON c.oid = a.attrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_depend d
  ON d.classid = 'pg_attrdef'::regclass
 AND d.objid = ad.oid
 AND d.refclassid = 'pg_proc'::regclass
JOIN pg_proc p ON p.oid = d.refobjid
JOIN pg_namespace fn ON fn.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND c.relname = 'venues'
  AND a.attname = 'geom'
  AND NOT a.attisdropped
  AND p.proname IN ('st_setsrid', 'st_makepoint');

SELECT COUNT(*) AS intelligence_rows
FROM public.get_live_venue_intelligence(1000);

SELECT COUNT(*) AS venues_with_geom
FROM public.venues
WHERE geom IS NOT NULL
  AND extensions.ST_SRID(geom) = 4326;
