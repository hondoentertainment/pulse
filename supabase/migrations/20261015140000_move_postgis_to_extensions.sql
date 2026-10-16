-- Move PostGIS out of public so Security Advisor 0013
-- (rls_disabled_in_public on public.spatial_ref_sys) clears.
--
-- Apply on xeldqwhztcnnvazmshzh only after this migration is merged.
-- Do not enable RLS on spatial_ref_sys. The table is extension-owned
-- (supabase_admin on hosted projects); postgres cannot ALTER it or
-- revoke the anon/authenticated write grants.
-- Verify with supabase/verify/postgis_extensions_schema.sql.
--
-- Approach
-- --------
-- PostGIS 3.3.7 ships relocatable = false, so
-- `ALTER EXTENSION postgis SET SCHEMA extensions` fails. Flipping
-- pg_extension.extrelocatable and running the "<version>next" update
-- is the zero-rewrite alternative, but it updates a catalog row and
-- requires superuser. Hosted migrations run as postgres, which is not
-- a superuser and cannot SET ROLE supabase_admin, so that script is
-- support-only (see the rollback note below).
--
-- This migration uses the self-service path that postgres can run:
-- drop the extension and create it again in `extensions`, without
-- CASCADE. The only app geometry is public.venues.geom, a STORED
-- generated column of lat/lng (initial schema). Its bytes are fully
-- determined by location_lat/location_lng. The migration:
--   1. Refuses to run if any other PostGIS-dependent extension, column,
--      view, or function exists, or if venues.geom is not generated.
--   2. Snapshots every venue lat/lng + EWKB and the spatial_ref_sys key.
--   3. Detaches only venues.geom and public.calculate_distance.
--   4. DROP EXTENSION postgis (no CASCADE) and
--      CREATE EXTENSION postgis WITH SCHEMA extensions at the same version.
--   5. Rebuilds the column, GiST index, and function.
--   6. Aborts the transaction if any venue byte, lat/lng, or SRID row differs.
--
-- Run this file in one transaction (supabase db push and the SQL editor
-- do). A failure rolls the drop back; other sessions keep seeing PostGIS
-- in public until commit. Commit takes ACCESS EXCLUSIVE on public.venues
-- for the column rewrite and index build.
--
-- PostGIS caches its install schema in each backend. Sessions that were
-- connected before commit keep looking up public.spatial_ref_sys until
-- they disconnect. After the migration commits, recycle pooled connections
-- (or restart the database) before serving map/distance traffic.
--
-- Rollback after a successful commit: restore the backup taken immediately
-- before apply. Do not "move it back" with ALTER EXTENSION. Re-running
-- this file once PostGIS is already in extensions is a no-op for the
-- table rewrite (it only re-asserts search_path, grants, and functions).
--
-- Edited in place after ce50bcd. That revision was merged but the hosted
-- apply rolled back on SQLSTATE 42501 ("anon" is a reserved role, only
-- superusers can modify it), so this file has not been applied anywhere.
--
-- anon, authenticated, service_role, and authenticator are reserved.
-- Migrations run as postgres and must not ALTER them. On the hosted
-- project those roles have no search_path GUC, so they inherit
-- ALTER DATABASE ... SET search_path. postgres already has a role
-- search_path that includes extensions; that role setting wins over
-- the database setting and is left unchanged when it already contains
-- extensions. A best-effort ALTER ROLE postgres IN DATABASE is wrapped
-- so a reserved-role failure raises a notice instead of rolling back.
-- PostgREST may also SET search_path per request from db-extra-search-path.
-- App PostGIS calls do not depend on that: they are schema-qualified.
-- Support can instead avoid the rewrite by running, as superuser:
--   BEGIN;
--   UPDATE pg_extension SET extrelocatable = true WHERE extname = 'postgis';
--   ALTER EXTENSION postgis SET SCHEMA extensions;
--   ALTER EXTENSION postgis UPDATE TO '<installed-version>next';
--   ALTER EXTENSION postgis UPDATE;
--   UPDATE pg_extension SET extrelocatable = false WHERE extname = 'postgis';
--   COMMIT;
-- Then re-run this migration so search_path and calculate_distance match.

SET LOCAL lock_timeout = '30s';
SET LOCAL statement_timeout = '10min';

CREATE SCHEMA IF NOT EXISTS extensions;

DO $move_postgis$
DECLARE
  ext_schema text;
  ext_version text;
  rebuilt boolean := false;
  geom_generated "char";
  unexpected text;
  old_srid_digest text;
  new_srid_digest text;
  old_venue_count bigint;
  mismatch_count bigint;
  meters double precision;
  db_oid oid;
  role_oid oid;
  cfg text[];
  db_cfg text[];
  cluster_cfg text[];
  sp text;
  db_sp text;
  cluster_sp text;
  fn regprocedure;
BEGIN
  SELECT n.nspname, e.extversion
    INTO ext_schema, ext_version
  FROM pg_extension e
  JOIN pg_namespace n ON n.oid = e.extnamespace
  WHERE e.extname = 'postgis';

  IF EXISTS (
    SELECT 1
    FROM pg_extension
    WHERE extname IN (
      'postgis_raster',
      'postgis_topology',
      'postgis_tiger_geocoder',
      'postgis_sfcgal',
      'address_standardizer'
    )
  ) THEN
    RAISE EXCEPTION
      'postgis has a dependent extension installed (raster, topology, tiger, sfcgal, or address_standardizer). Refusing to drop it. Ask Supabase support to run the extrelocatable move.';
  END IF;

  IF ext_schema IS NULL THEN
    EXECUTE 'CREATE EXTENSION postgis WITH SCHEMA extensions';
    SELECT e.extversion INTO ext_version
    FROM pg_extension e
    WHERE e.extname = 'postgis';
    RAISE NOTICE 'postgis was absent; created % in schema extensions', ext_version;
  ELSIF ext_schema = 'extensions' THEN
    RAISE NOTICE 'postgis % is already in schema extensions', ext_version;
  ELSIF ext_schema <> 'public' THEN
    RAISE EXCEPTION 'postgis is in schema %, expected public or extensions', ext_schema;
  ELSE
    IF ext_version IS DISTINCT FROM '3.3.7' THEN
      RAISE NOTICE 'postgis version is % (expected 3.3.7 on this project). Recreating that same version in extensions.', ext_version;
    END IF;

    SELECT a.attgenerated
      INTO geom_generated
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'venues'
      AND a.attname = 'geom'
      AND NOT a.attisdropped;

    IF geom_generated IS NOT NULL AND geom_generated <> 's' THEN
      RAISE EXCEPTION
        'public.venues.geom is not a stored generated column (attgenerated=%). Refusing to drop it because that would discard geometry bytes. Ask Supabase support to run the extrelocatable move.',
        geom_generated;
    END IF;

    SELECT string_agg(format('%I.%I.%I (%s)', n.nspname, c.relname, a.attname, format_type(a.atttypid, a.atttypmod)), ', ' ORDER BY n.nspname, c.relname, a.attname)
      INTO unexpected
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_type t ON t.oid = a.atttypid
    WHERE a.attnum > 0
      AND NOT a.attisdropped
      AND c.relkind IN ('r', 'p', 'v', 'm')
      AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
      AND EXISTS (
        SELECT 1
        FROM pg_depend td
        WHERE td.classid = 'pg_type'::regclass
          AND td.objid = t.oid
          AND td.refclassid = 'pg_extension'::regclass
          AND td.refobjid = (SELECT oid FROM pg_extension WHERE extname = 'postgis')
          AND td.deptype = 'e'
      )
      AND NOT (n.nspname = 'public' AND c.relname = 'venues' AND a.attname = 'geom')
      AND NOT EXISTS (
        SELECT 1
        FROM pg_depend d
        WHERE d.classid = 'pg_class'::regclass
          AND d.objid = c.oid
          AND d.refclassid = 'pg_extension'::regclass
          AND d.deptype = 'e'
      );

    IF unexpected IS NOT NULL THEN
      RAISE EXCEPTION
        'unexpected geometry/geography columns depend on postgis: %. Refusing to drop the extension.',
        unexpected;
    END IF;

    SELECT string_agg(format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)), ', ' ORDER BY n.nspname, p.proname)
      INTO unexpected
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
      AND (
        p.prosrc ~* '[[:<:]]st_[a-z0-9_]+'
        OR pg_get_function_identity_arguments(p.oid) ~* 'geometry|geography'
        OR pg_get_function_result(p.oid) ~* 'geometry|geography'
        OR p.prosrc ~* '::[[:space:]]*(geometry|geography)\M'
      )
      AND NOT (
        n.nspname = 'public'
        AND p.proname = 'calculate_distance'
        AND p.pronargs = 4
        AND p.proargtypes::text = '701 701 701 701'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM pg_depend d
        WHERE d.classid = 'pg_proc'::regclass
          AND d.objid = p.oid
          AND d.refclassid = 'pg_extension'::regclass
          AND d.deptype = 'e'
      );

    IF unexpected IS NOT NULL THEN
      RAISE EXCEPTION
        'unexpected functions use PostGIS and were not rewritten by this migration: %. Refusing to drop the extension.',
        unexpected;
    END IF;

    SELECT string_agg(format('%I.%I', n.nspname, c.relname), ', ' ORDER BY n.nspname, c.relname)
      INTO unexpected
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind IN ('v', 'm')
      AND n.nspname = 'public'
      AND pg_get_viewdef(c.oid) ~* '[[:<:]]st_[a-z0-9_]+|geometry|geography'
      AND NOT EXISTS (
        SELECT 1
        FROM pg_depend d
        WHERE d.classid = 'pg_class'::regclass
          AND d.objid = c.oid
          AND d.refclassid = 'pg_extension'::regclass
          AND d.deptype = 'e'
      );

    IF unexpected IS NOT NULL THEN
      RAISE EXCEPTION
        'unexpected views use PostGIS: %. Refusing to drop the extension.',
        unexpected;
    END IF;

    CREATE TEMP TABLE venue_geom_snapshot (
      id uuid PRIMARY KEY,
      location_lat double precision NOT NULL,
      location_lng double precision NOT NULL,
      ewkb bytea
    ) ON COMMIT DROP;

    IF to_regclass('public.venues') IS NOT NULL AND geom_generated = 's' THEN
      INSERT INTO venue_geom_snapshot (id, location_lat, location_lng, ewkb)
      SELECT id, location_lat, location_lng, public.ST_AsEWKB(geom)
      FROM public.venues;
    END IF;

    SELECT count(*) INTO old_venue_count FROM venue_geom_snapshot;

    SELECT md5(COALESCE(string_agg(
      srid::text || '|' || COALESCE(auth_name, '') || '|' || COALESCE(auth_srid::text, '')
        || '|' || COALESCE(srtext, '') || '|' || COALESCE(proj4text, ''),
      E'\n' ORDER BY srid
    ), ''))
      INTO old_srid_digest
    FROM public.spatial_ref_sys;

    IF geom_generated = 's' THEN
      DROP INDEX IF EXISTS public.idx_venues_geom;
      ALTER TABLE public.venues DROP COLUMN geom;
    END IF;

    DROP FUNCTION IF EXISTS public.calculate_distance(double precision, double precision, double precision, double precision);

    DROP EXTENSION postgis;

    EXECUTE format('CREATE EXTENSION postgis WITH SCHEMA extensions VERSION %L', ext_version);

    SELECT md5(COALESCE(string_agg(
      srid::text || '|' || COALESCE(auth_name, '') || '|' || COALESCE(auth_srid::text, '')
        || '|' || COALESCE(srtext, '') || '|' || COALESCE(proj4text, ''),
      E'\n' ORDER BY srid
    ), ''))
      INTO new_srid_digest
    FROM extensions.spatial_ref_sys;

    IF new_srid_digest IS DISTINCT FROM old_srid_digest THEN
      RAISE EXCEPTION
        'spatial_ref_sys content changed during PostGIS recreate (digest % -> %). Custom SRIDs would be lost. Transaction rolled back. Ask Supabase support to run the extrelocatable move.',
        old_srid_digest, new_srid_digest;
    END IF;

    rebuilt := true;

    IF to_regclass('public.venues') IS NOT NULL AND geom_generated = 's' THEN
      ALTER TABLE public.venues
        ADD COLUMN geom extensions.geometry(Point, 4326)
        GENERATED ALWAYS AS (
          extensions.ST_SetSRID(extensions.ST_MakePoint(location_lng, location_lat), 4326)
        ) STORED;

      CREATE INDEX idx_venues_geom ON public.venues USING GIST (geom);

      SELECT count(*) INTO mismatch_count
      FROM venue_geom_snapshot s
      JOIN public.venues v ON v.id = s.id
      WHERE v.location_lat IS DISTINCT FROM s.location_lat
         OR v.location_lng IS DISTINCT FROM s.location_lng
         OR extensions.ST_AsEWKB(v.geom) IS DISTINCT FROM s.ewkb;

      IF mismatch_count <> 0 OR (SELECT count(*) FROM public.venues) <> old_venue_count THEN
        RAISE EXCEPTION
          'venue geometry rebuild mismatched % row(s) (snapshot %, venues %). Transaction rolled back.',
          mismatch_count, old_venue_count, (SELECT count(*) FROM public.venues);
      END IF;
    END IF;
  END IF;

  IF to_regclass('public.venues') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_attribute a
       JOIN pg_class c ON c.oid = a.attrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND c.relname = 'venues'
         AND a.attname = 'geom'
         AND NOT a.attisdropped
     )
  THEN
    ALTER TABLE public.venues
      ADD COLUMN geom extensions.geometry(Point, 4326)
      GENERATED ALWAYS AS (
        extensions.ST_SetSRID(extensions.ST_MakePoint(location_lng, location_lat), 4326)
      ) STORED;
  END IF;

  IF to_regclass('public.venues') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_indexes
       WHERE schemaname = 'public'
         AND tablename = 'venues'
         AND indexname = 'idx_venues_geom'
     )
  THEN
    CREATE INDEX idx_venues_geom ON public.venues USING GIST (geom);
  END IF;

  CREATE OR REPLACE FUNCTION public.calculate_distance(lat1 float, lon1 float, lat2 float, lon2 float)
  RETURNS float
  LANGUAGE plpgsql
  SET search_path = public, extensions
  AS $$
  DECLARE
      point1 extensions.geography;
      point2 extensions.geography;
  BEGIN
      -- Keep the geography cast on the value passed to the distance call.
      -- A geometry variable would cast it back and return degrees.
      point1 := extensions.ST_SetSRID(extensions.ST_MakePoint(lon1, lat1), 4326)::extensions.geography;
      point2 := extensions.ST_SetSRID(extensions.ST_MakePoint(lon2, lat2), 4326)::extensions.geography;
      RETURN extensions.ST_Distance(point1, point2) / 1609.344;
  END;
  $$;

  COMMENT ON FUNCTION public.calculate_distance(float, float, float, float) IS
    'Great-circle distance in miles via PostGIS geography in schema extensions.';

  FOR fn IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'get_live_venue_intelligence'
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, extensions', fn);
  END LOOP;

  -- PostGIS caches install schema in backend memory on first use. This
  -- session already called public.ST_* while snapshotting, so a geography
  -- cast here still looks up public.spatial_ref_sys and raises
  -- "Cannot find SRID (4326)". New connections see extensions. The verify
  -- script must run on a fresh connection. After commit, recycle pooled
  -- backends (PostgREST, Supavisor) or they keep the stale cache.
  IF NOT rebuilt THEN
    meters := extensions.ST_Distance(
      extensions.ST_SetSRID(extensions.ST_MakePoint(-122.32, 47.61), 4326)::extensions.geography,
      extensions.ST_SetSRID(extensions.ST_MakePoint(-122.68, 45.52), 4326)::extensions.geography
    );
    IF meters < 233900 OR meters > 234020 THEN
      RAISE EXCEPTION 'Seattle (-122.32, 47.61) to Portland (-122.68, 45.52) geography distance is % m, expected about 233962', meters;
    END IF;
  ELSE
    RAISE NOTICE 'PostGIS was recreated in extensions. Reconnect before geography/ST_Distance checks. Verify with supabase/verify/postgis_extensions_schema.sql on a new connection.';
  END IF;

  -- API roles resolve extension objects through the database search_path.
  -- Do not ALTER ROLE anon, authenticated, service_role, or authenticator:
  -- hosted supautils rejects that with 42501 and rolls this transaction
  -- back. Append `extensions` only when that token is missing. Other
  -- schemas (vault, graphql, ...) stay on the database path.
  SELECT oid INTO db_oid FROM pg_database WHERE datname = current_database();

  SELECT s.setconfig INTO cfg
  FROM pg_db_role_setting s
  WHERE s.setdatabase = db_oid AND s.setrole = 0;

  sp := NULL;
  IF cfg IS NOT NULL THEN
    SELECT regexp_replace(x, '^search_path=', '') INTO sp
    FROM unnest(cfg) AS x
    WHERE split_part(x, '=', 1) = 'search_path'
    LIMIT 1;
  END IF;

  IF sp IS NULL THEN
    db_sp := '"$user", public, extensions';
    EXECUTE format('ALTER DATABASE %I SET search_path TO %s', current_database(), db_sp);
  ELSIF sp !~ '(^|,)[[:space:]]*"?extensions"?[[:space:]]*(,|$)' THEN
    db_sp := sp || ', extensions';
    EXECUTE format('ALTER DATABASE %I SET search_path TO %s', current_database(), db_sp);
  ELSE
    db_sp := sp;
  END IF;

  -- postgres is not a reserved API role. Change it only when its
  -- effective path (in-database, else cluster-wide role setting, else
  -- the database path) does not already name extensions. The cluster-wide
  -- row is never written. Any failure, including 42501, is a notice.
  BEGIN
    SELECT oid, rolconfig INTO role_oid, cluster_cfg
    FROM pg_roles
    WHERE rolname = 'postgres';

    IF role_oid IS NULL THEN
      RAISE NOTICE 'role postgres is missing; left search_path unchanged';
    ELSE
      SELECT s.setconfig INTO db_cfg
      FROM pg_db_role_setting s
      WHERE s.setdatabase = db_oid AND s.setrole = role_oid;

      sp := NULL;
      IF db_cfg IS NOT NULL THEN
        SELECT regexp_replace(x, '^search_path=', '') INTO sp
        FROM unnest(db_cfg) AS x
        WHERE split_part(x, '=', 1) = 'search_path'
        LIMIT 1;
      END IF;

      cluster_sp := NULL;
      IF sp IS NULL AND cluster_cfg IS NOT NULL THEN
        SELECT regexp_replace(x, '^search_path=', '') INTO cluster_sp
        FROM unnest(cluster_cfg) AS x
        WHERE split_part(x, '=', 1) = 'search_path'
        LIMIT 1;
      END IF;

      IF sp IS NOT NULL
         AND sp !~ '(^|,)[[:space:]]*"?extensions"?[[:space:]]*(,|$)' THEN
        EXECUTE format(
          'ALTER ROLE postgres IN DATABASE %I SET search_path TO %s',
          current_database(), sp || ', extensions'
        );
      ELSIF sp IS NULL
            AND cluster_sp IS NOT NULL
            AND cluster_sp !~ '(^|,)[[:space:]]*"?extensions"?[[:space:]]*(,|$)' THEN
        EXECUTE format(
          'ALTER ROLE postgres IN DATABASE %I SET search_path TO %s',
          current_database(), cluster_sp || ', extensions'
        );
      ELSIF sp IS NULL AND cluster_sp IS NULL THEN
        RAISE NOTICE 'role postgres inherits the database search_path (%)', db_sp;
      ELSE
        RAISE NOTICE 'role postgres search_path already includes extensions; left unchanged';
      END IF;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'skipped ALTER ROLE postgres IN DATABASE % SET search_path (% %)',
        current_database(), SQLSTATE, SQLERRM;
  END;
END
$move_postgis$;

GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role, authenticator;
REVOKE CREATE ON SCHEMA extensions FROM PUBLIC;
REVOKE CREATE ON SCHEMA extensions FROM anon, authenticated;

DO $grants$
BEGIN
  -- Extension script grants SELECT to PUBLIC. Drop API-role writes if we
  -- own the table. Hosted event triggers may leave ownership with
  -- supabase_admin; that must not fail the move now that the table is
  -- outside the exposed public schema.
  REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON extensions.spatial_ref_sys FROM PUBLIC;
  REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON extensions.spatial_ref_sys FROM anon, authenticated;
  GRANT SELECT ON extensions.spatial_ref_sys TO anon, authenticated, service_role;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'spatial_ref_sys writes were not revoked (not owner). The table is in schema extensions, which is not an exposed Data API schema.';
END
$grants$;

NOTIFY pgrst, 'reload schema';
