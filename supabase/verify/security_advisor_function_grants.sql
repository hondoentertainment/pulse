-- Verify supabase/migrations/20261113230427_security_advisor_function_grants.sql
-- on project xeldqwhztcnnvazmshzh (or local after db reset).
--
-- Catalog checks are read-only. The probe at the bottom sets the local
-- role inside one transaction, calls one revoked function and one guest
-- function, and rolls back. Run this file as one script so the ROLLBACK
-- runs. Expect every flag below to be true, and the probe to return
-- anon_guest_count_ok = true.
--
-- Does not ALTER ROLE anon, authenticated, service_role, or authenticator.
-- SET LOCAL ROLE only changes this transaction.

WITH expected AS (
    SELECT *
    FROM (
        VALUES
            ('confidence_from_count', 'report_count integer', 'empty', NULL::boolean, NULL::boolean),
            ('energy_rating_score', 'rating energy_rating', 'empty', NULL::boolean, NULL::boolean),
            ('enforce_pulse_rate_limit', '', 'empty', NULL::boolean, NULL::boolean),
            ('is_admin', '', 'empty', TRUE, TRUE),
            ('is_safety_responder', '', 'empty', TRUE, TRUE),
            ('normalize_owner_domain', 'raw text', 'empty', NULL::boolean, NULL::boolean),
            ('pulse_rate_limit_violation', 'p_user_id uuid, p_venue_id uuid', 'empty', NULL::boolean, NULL::boolean),
            ('pulses_preserve_hide_columns', '', 'empty', NULL::boolean, NULL::boolean),
            ('refresh_venue_signal', 'target_venue_id uuid', 'empty', NULL::boolean, NULL::boolean),
            ('set_updated_at', '', 'empty', NULL::boolean, NULL::boolean),
            ('touch_push_token_updated_at', '', 'empty', NULL::boolean, NULL::boolean),
            ('touch_signal_updated_at', '', 'empty', NULL::boolean, NULL::boolean),
            ('venue_owner_match_domains', 'p_venue venues', 'empty', NULL::boolean, NULL::boolean),
            ('assert_pulse_rate_limit', 'p_user_id uuid, p_venue_id uuid', 'client_auth', FALSE, TRUE),
            ('assert_pulse_reply_rate_limit', 'p_user_id uuid, p_venue_id uuid', 'client_auth', FALSE, TRUE),
            ('toggle_pulse_reaction', 'target_pulse_id uuid, target_reaction_type pulse_reaction_type', 'client_auth', FALSE, TRUE),
            ('try_verify_venue_claim_by_email_domain', 'p_claim_id uuid', 'client_auth', FALSE, TRUE),
            ('venue_here_now_friends', 'p_venue_id uuid', 'client_auth', FALSE, TRUE),
            ('get_live_venue_intelligence', 'max_pulses integer', 'client_guest', TRUE, TRUE),
            ('venue_here_now_count', 'p_venue_id uuid', 'client_guest', TRUE, TRUE),
            ('calculate_venue_pulse_score', 'target_venue_id uuid', 'revoked', FALSE, FALSE),
            ('calculate_venue_score_velocity', 'target_venue_id uuid', 'revoked', FALSE, FALSE),
            ('enforce_pulse_reply_rate_limit', '', 'revoked', FALSE, FALSE),
            ('pulse_agree_count', 'p_pulse_id uuid', 'revoked', FALSE, FALSE),
            ('pulse_reply_rate_limit_violation', 'p_user_id uuid, p_venue_id uuid', 'revoked', FALSE, FALSE),
            ('refresh_venue_intelligence', 'target_venue_id uuid', 'revoked', FALSE, FALSE),
            ('refresh_venue_intelligence_trigger', '', 'revoked', FALSE, FALSE),
            ('refresh_venue_live_aggregate', 'target_venue_id uuid', 'revoked', FALSE, FALSE),
            ('refresh_venue_live_aggregate_trigger', '', 'revoked', FALSE, FALSE),
            ('sync_pulse_reactions', 'target_pulse_id uuid', 'revoked', FALSE, FALSE),
            ('sync_venue_claim_verified', '', 'revoked', FALSE, FALSE)
    ) AS v(proname, args, kind, anon_exec, authenticated_exec)
),
fns AS (
    SELECT
        e.proname,
        e.kind,
        e.anon_exec,
        e.authenticated_exec,
        p.oid,
        p.proconfig,
        p.proacl,
        has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_has,
        has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_has,
        has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_has,
        EXISTS (
            SELECT 1
            FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS cfg
            WHERE split_part(cfg, '=', 1) = 'search_path'
              AND btrim(split_part(cfg, '=', 2), '"') = ''
        ) AS empty_search_path,
        COALESCE((
            SELECT bool_or(acl.privilege_type = 'EXECUTE' AND acl.grantee = 0)
            FROM aclexplode(p.proacl) AS acl
        ), p.proacl IS NULL) AS public_execute
    FROM expected e
    JOIN pg_proc p ON p.proname = e.proname
    JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
    WHERE pg_get_function_identity_arguments(p.oid) = e.args
)
SELECT
    (SELECT count(*) FROM expected) = (SELECT count(*) FROM fns) AS all_expected_functions_found,
    bool_and(kind <> 'empty' OR empty_search_path) AS flagged_functions_have_empty_search_path,
    bool_and(anon_exec IS NULL OR anon_has = anon_exec) AS anon_execute_matches,
    bool_and(authenticated_exec IS NULL OR authenticated_has = authenticated_exec) AS authenticated_execute_matches,
    bool_and(service_has) AS service_role_keeps_execute,
    bool_and(kind NOT IN ('client_auth', 'revoked') OR NOT public_execute) AS revoked_roles_have_no_public_execute,
    bool_and(
        proname <> 'pulses_preserve_hide_columns'
        OR pg_get_functiondef(oid) ILIKE '%public.is_admin()%'
    ) AS hide_trigger_qualifies_is_admin,
    bool_and(
        proname <> 'refresh_venue_signal'
        OR (
            pg_get_functiondef(oid) ILIKE '%public.pulses%'
            AND pg_get_functiondef(oid) ILIKE '%public.venue_live_reports%'
            AND pg_get_functiondef(oid) ILIKE '%public.venue_signals%'
            AND pg_get_functiondef(oid) ILIKE '%public.venues%'
        )
    ) AS refresh_venue_signal_qualifies_tables,
    bool_and(
        proname <> 'assert_pulse_rate_limit'
        OR pg_get_functiondef(oid) ILIKE '%auth.uid()%'
    ) AS assert_pulse_checks_auth_uid,
    bool_and(
        proname <> 'assert_pulse_reply_rate_limit'
        OR pg_get_functiondef(oid) ILIKE '%auth.uid()%'
    ) AS assert_reply_checks_auth_uid,
    bool_and(
        proname <> 'toggle_pulse_reaction'
        OR pg_get_functiondef(oid) ILIKE '%auth.uid()%'
    ) AS toggle_reaction_checks_auth_uid,
    bool_and(
        proname <> 'try_verify_venue_claim_by_email_domain'
        OR (
            pg_get_functiondef(oid) ILIKE '%auth.uid()%'
            AND pg_get_functiondef(oid) ILIKE '%user_id%'
        )
    ) AS try_verify_checks_owner,
    bool_and(
        proname <> 'venue_here_now_friends'
        OR pg_get_functiondef(oid) ILIKE '%auth.uid()%'
    ) AS here_now_friends_checks_auth_uid
FROM fns;

SELECT
    c.relname,
    c.relrowsecurity AS rls_on,
    (
        SELECT count(*)
        FROM pg_policy pol
        WHERE pol.polrelid = c.oid
    ) = 0 AS no_policy,
    obj_description(c.oid, 'pg_class') ILIKE '%deny-all%' AS comment_says_deny_all
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
      'launch_quiet_notices',
      'stripe_webhook_events',
      'venue_surge_notices'
  )
ORDER BY c.relname;

SELECT
    EXISTS (
        SELECT 1
        FROM pg_trigger t
        JOIN pg_proc p ON p.oid = t.tgfoid
        WHERE t.tgname = 'pulses_refresh_venue_intelligence'
          AND p.proname = 'refresh_venue_intelligence_trigger'
          AND NOT t.tgisinternal
    ) AS score_trigger_still_bound,
    EXISTS (
        SELECT 1
        FROM pg_trigger t
        JOIN pg_proc p ON p.oid = t.tgfoid
        WHERE t.tgname = 'venue_live_reports_refresh_aggregate'
          AND p.proname = 'refresh_venue_live_aggregate_trigger'
          AND NOT t.tgisinternal
    ) AS aggregate_trigger_still_bound,
    EXISTS (
        SELECT 1
        FROM pg_trigger t
        JOIN pg_proc p ON p.oid = t.tgfoid
        WHERE t.tgname = 'venue_claims_sync_verified'
          AND p.proname = 'sync_venue_claim_verified'
          AND NOT t.tgisinternal
    ) AS claim_trigger_still_bound,
    EXISTS (
        SELECT 1
        FROM pg_trigger t
        JOIN pg_proc p ON p.oid = t.tgfoid
        WHERE t.tgname = 'pulse_replies_enforce_rate_limit'
          AND p.proname = 'enforce_pulse_reply_rate_limit'
          AND NOT t.tgisinternal
    ) AS reply_limit_trigger_still_bound,
    EXISTS (
        SELECT 1
        FROM pg_trigger t
        JOIN pg_proc p ON p.oid = t.tgfoid
        WHERE t.tgname = 'pulses_preserve_hide_columns'
          AND p.proname = 'pulses_preserve_hide_columns'
          AND NOT t.tgisinternal
    ) AS hide_trigger_still_bound;

BEGIN;

SELECT set_config('role', 'authenticated', true);

DO $$
BEGIN
    PERFORM public.calculate_venue_pulse_score('00000000-0000-4000-8000-00000000c047');
    RAISE EXCEPTION 'authenticated executed calculate_venue_pulse_score';
EXCEPTION
    WHEN insufficient_privilege THEN
        NULL;
END
$$;

SELECT set_config('role', 'none', true);

SELECT set_config('role', 'anon', true);

SELECT public.venue_here_now_count('00000000-0000-4000-8000-00000000c047') >= 0
    AS anon_guest_count_ok;

ROLLBACK;
