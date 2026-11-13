-- Verify public.venue_claim_badges is security_invoker and anon can still
-- read live claim badges without seeing venue_claims rows.
--
-- Run after supabase/migrations/20261113170000_venue_claim_badges_security_invoker.sql
-- on project xeldqwhztcnnvazmshzh (or local after db reset).
--
-- Catalog checks are read-only. The probe inserts three throwaway venues
-- inside one transaction, reads them as anon and as authenticated, and
-- rolls them back. Run this file as one script so the ROLLBACK runs.
-- Expect every flag below to be true.
--
-- Does not ALTER ROLE anon, authenticated, service_role, or authenticator.
-- SET LOCAL ROLE only changes this transaction.

SELECT
    c.relkind = 'v' AS is_view,
    EXISTS (
        SELECT 1
        FROM unnest(COALESCE(c.reloptions, ARRAY[]::text[])) AS opt
        WHERE opt IN ('security_invoker=true', 'security_invoker=on')
    ) AS security_invoker,
    (
        SELECT array_agg(a.attname::text ORDER BY a.attnum)
        FROM pg_attribute a
        WHERE a.attrelid = c.oid
          AND a.attnum > 0
          AND NOT a.attisdropped
    ) = ARRAY['venue_id']::text[] AS only_venue_id,
    has_table_privilege('anon', c.oid, 'SELECT') AS anon_select_view,
    has_table_privilege('authenticated', c.oid, 'SELECT') AS authenticated_select_view,
    has_column_privilege('anon', 'public.venues', 'id', 'SELECT') AS anon_select_venue_id,
    has_column_privilege('anon', 'public.venues', 'claim_verified', 'SELECT') AS anon_select_claim_verified,
    pg_get_viewdef(c.oid, true) ILIKE '%claim_verified%' AS reads_claim_verified,
    pg_get_viewdef(c.oid, true) NOT ILIKE '%venue_claims%' AS does_not_read_venue_claims,
    NOT EXISTS (
        SELECT 1
        FROM pg_policy pol
        WHERE pol.polrelid = 'public.venue_claims'::regclass
          AND pol.polcmd IN ('r', '*')
          AND pg_get_expr(pol.polqual, pol.polrelid) NOT IN (
              'is_admin()',
              '((auth.uid() = user_id) OR is_admin())'
          )
    ) AS claim_select_policies_unchanged
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'venue_claim_badges';

BEGIN;

INSERT INTO public.venues (
    id, name, location_lat, location_lng, location_address, claim_verified, deleted_at
)
VALUES
    (
        '00000000-0000-4000-8000-00000000bade',
        'security invoker badge probe',
        47.6062,
        -122.3321,
        'probe only',
        true,
        NULL
    ),
    (
        '00000000-0000-4000-8000-00000000bad0',
        'security invoker unclaimed probe',
        47.6062,
        -122.3321,
        'probe only',
        false,
        NULL
    ),
    (
        '00000000-0000-4000-8000-00000000bad1',
        'security invoker deleted probe',
        47.6062,
        -122.3321,
        'probe only',
        true,
        TIMEZONE('utc', NOW())
    );

SELECT set_config('role', 'anon', true);

SELECT
    EXISTS (
        SELECT 1
        FROM public.venue_claim_badges
        WHERE venue_id = '00000000-0000-4000-8000-00000000bade'
    ) AS anon_sees_live_badge,
    NOT EXISTS (
        SELECT 1
        FROM public.venue_claim_badges
        WHERE venue_id = '00000000-0000-4000-8000-00000000bad0'
    ) AS anon_hides_unclaimed,
    NOT EXISTS (
        SELECT 1
        FROM public.venue_claim_badges
        WHERE venue_id = '00000000-0000-4000-8000-00000000bad1'
    ) AS anon_hides_deleted_badge,
    (
        SELECT count(*)
        FROM public.venue_claim_badges b
        WHERE NOT EXISTS (
            SELECT 1
            FROM public.venues v
            WHERE v.id = b.venue_id
              AND v.claim_verified
              AND v.deleted_at IS NULL
        )
    ) = 0 AS anon_badges_match_live_flags,
    (SELECT count(*) FROM public.venue_claims) = 0 AS anon_sees_no_claim_rows;

SELECT set_config('role', 'none', true);

SELECT set_config('role', 'authenticated', true);

SELECT
    EXISTS (
        SELECT 1
        FROM public.venue_claim_badges
        WHERE venue_id = '00000000-0000-4000-8000-00000000bade'
    ) AS authenticated_sees_live_badge,
    NOT EXISTS (
        SELECT 1
        FROM public.venue_claim_badges
        WHERE venue_id = '00000000-0000-4000-8000-00000000bad1'
    ) AS authenticated_hides_deleted_badge,
    (SELECT count(*) FROM public.venue_claims) = 0 AS authenticated_sees_no_claim_rows;

ROLLBACK;
