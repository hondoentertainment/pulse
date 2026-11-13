-- Security Advisor WARNs on xeldqwhztcnnvazmshzh:
--   0011 function_search_path_mutable
--   0028 anon_security_definer_function_executable
--   0029 authenticated_security_definer_function_executable
-- Info 0008 rls_enabled_no_policy is documented below. It stays, on purpose.
--
-- Does not change pg_graphql exposure (0026 / 0027) or Auth leaked-password
-- protection. Those are dashboard settings. Does not ALTER ROLE anon,
-- authenticated, service_role, or authenticator. Hosted postgres is not
-- superuser.
--
-- PostGIS lives in extensions. None of the functions flagged for a mutable
-- search_path call PostGIS, so each one gets SET search_path = ''.
-- pulses_preserve_hide_columns and refresh_venue_signal referenced unqualified
-- objects; those references are schema-qualified. The other eleven already
-- qualify every public and auth object, or they only use pg_catalog.
--
-- SECURITY DEFINER functions the app does not call lose EXECUTE from
-- PUBLIC, anon, and authenticated. service_role keeps EXECUTE. Existing
-- triggers keep firing: Postgres checks EXECUTE on a trigger function at
-- CREATE TRIGGER, not when the trigger runs. Nested calls from a security
-- definer function run as the owner (postgres), which still has EXECUTE.
--
-- Apply on xeldqwhztcnnvazmshzh only after this file is merged.
-- Verify with supabase/verify/security_advisor_function_grants.sql.

-- ============================================================
-- 1. Empty search_path on every flagged function
-- ============================================================

CREATE OR REPLACE FUNCTION public.pulses_preserve_hide_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;
  IF public.is_admin() OR coalesce(auth.role(), '') = 'service_role' THEN
    RETURN NEW;
  END IF;
  NEW.hidden_at := OLD.hidden_at;
  NEW.hidden_note := OLD.hidden_note;
  NEW.hidden_by := OLD.hidden_by;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_venue_signal(target_venue_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    pulse_count INTEGER;
    report_count INTEGER;
    computed JSONB := jsonb_build_object(
        'version', 'venue-signal.v1',
        'pulseDecayMinutes', 90,
        'liveIntelDecayMinutes', 30,
        'propagationSlaMs', 30000
    );
BEGIN
    SELECT COUNT(*) INTO pulse_count
    FROM public.pulses
    WHERE venue_id = target_venue_id
      AND deleted_at IS NULL
      AND created_at >= NOW() - INTERVAL '90 minutes';

    SELECT COUNT(*) INTO report_count
    FROM public.venue_live_reports
    WHERE venue_id = target_venue_id
      AND created_at >= NOW() - INTERVAL '30 minutes';

    INSERT INTO public.venue_signals (
        venue_id,
        model_configuration,
        energy_score,
        confidence,
        trend,
        freshness_minutes,
        source_mix,
        friction,
        computed_at
    )
    VALUES (
        target_venue_id,
        computed,
        COALESCE((SELECT pulse_score FROM public.venues WHERE id = target_venue_id), 0),
        CASE
            WHEN pulse_count + report_count >= 5 THEN 'high'
            WHEN pulse_count + report_count >= 2 THEN 'medium'
            ELSE 'low'
        END,
        'unknown',
        NULL,
        jsonb_build_object('pulses', pulse_count, 'liveReports', report_count, 'curatedSeed', true),
        '{}'::jsonb,
        NOW()
    )
    ON CONFLICT (venue_id) DO UPDATE SET
        model_configuration = EXCLUDED.model_configuration,
        energy_score = EXCLUDED.energy_score,
        confidence = EXCLUDED.confidence,
        source_mix = EXCLUDED.source_mix,
        computed_at = NOW();
END;
$$;

ALTER FUNCTION public.confidence_from_count(integer) SET search_path = '';
ALTER FUNCTION public.energy_rating_score(public.energy_rating) SET search_path = '';
ALTER FUNCTION public.enforce_pulse_rate_limit() SET search_path = '';
ALTER FUNCTION public.is_admin() SET search_path = '';
ALTER FUNCTION public.is_safety_responder() SET search_path = '';
ALTER FUNCTION public.normalize_owner_domain(text) SET search_path = '';
ALTER FUNCTION public.pulse_rate_limit_violation(uuid, uuid) SET search_path = '';
ALTER FUNCTION public.set_updated_at() SET search_path = '';
ALTER FUNCTION public.touch_push_token_updated_at() SET search_path = '';
ALTER FUNCTION public.touch_signal_updated_at() SET search_path = '';
ALTER FUNCTION public.venue_owner_match_domains(public.venues) SET search_path = '';

-- ============================================================
-- 2. SECURITY DEFINER RPCs the app calls
--    Keep the role that calls them. Revoke the other API role.
--    Each kept function already checks auth.uid(), except the two
--    guest reads, which are counts over public rows.
-- ============================================================

-- Signed-in pulse create. Body rejects a null or mismatched auth.uid().
REVOKE ALL ON FUNCTION public.assert_pulse_rate_limit(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assert_pulse_rate_limit(uuid, uuid) TO authenticated, service_role;

-- Signed-in reply. Body rejects a null or mismatched auth.uid().
REVOKE ALL ON FUNCTION public.assert_pulse_reply_rate_limit(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assert_pulse_reply_rate_limit(uuid, uuid) TO authenticated, service_role;

-- Signed-in reaction toggle. Body raises when auth.uid() is null.
REVOKE ALL ON FUNCTION public.toggle_pulse_reaction(uuid, public.pulse_reaction_type) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.toggle_pulse_reaction(uuid, public.pulse_reaction_type) TO authenticated, service_role;

-- Signed-in claim verify. Body requires auth.uid() and claim_row.user_id = auth.uid().
REVOKE ALL ON FUNCTION public.try_verify_venue_claim_by_email_domain(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.try_verify_venue_claim_by_email_domain(uuid) TO authenticated, service_role;

-- Signed-in friend names. Body returns rows only when auth.uid() is not null.
REVOKE ALL ON FUNCTION public.venue_here_now_friends(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.venue_here_now_friends(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.assert_pulse_rate_limit(uuid, uuid) IS
  'Signed-in pulse create gate. Requires auth.uid() = p_user_id. EXECUTE: authenticated, service_role.';
COMMENT ON FUNCTION public.assert_pulse_reply_rate_limit(uuid, uuid) IS
  'Signed-in reply gate. Requires auth.uid() = p_user_id. EXECUTE: authenticated, service_role.';
COMMENT ON FUNCTION public.toggle_pulse_reaction(uuid, public.pulse_reaction_type) IS
  'Signed-in reaction toggle. Raises when auth.uid() is null. EXECUTE: authenticated, service_role.';
COMMENT ON FUNCTION public.try_verify_venue_claim_by_email_domain(uuid) IS
  'Signed-in domain verify for the caller''s own pending claim. EXECUTE: authenticated, service_role.';
COMMENT ON FUNCTION public.venue_here_now_friends(uuid) IS
  'Presence display names only when the viewer follows that person. Requires auth.uid(). EXECUTE: authenticated, service_role.';
COMMENT ON FUNCTION public.venue_here_now_count(uuid) IS
  'Count of 90-min presence rows at a venue. Guests may read the count only. EXECUTE: anon, authenticated, service_role.';
COMMENT ON FUNCTION public.get_live_venue_intelligence(integer) IS
  'Map feed for guests and signed-in users. Non-deleted venues plus pulse counts. No auth.uid() gate. EXECUTE: anon, authenticated, service_role.';

-- ============================================================
-- 3. SECURITY DEFINER functions the app does not call
-- ============================================================

REVOKE ALL ON FUNCTION public.calculate_venue_pulse_score(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.calculate_venue_score_velocity(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_pulse_reply_rate_limit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pulse_agree_count(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pulse_reply_rate_limit_violation(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refresh_venue_intelligence(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refresh_venue_intelligence_trigger() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refresh_venue_live_aggregate(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refresh_venue_live_aggregate_trigger() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_pulse_reactions(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_venue_claim_verified() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.calculate_venue_pulse_score(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.calculate_venue_score_velocity(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.enforce_pulse_reply_rate_limit() TO service_role;
GRANT EXECUTE ON FUNCTION public.pulse_agree_count(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.pulse_reply_rate_limit_violation(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_venue_intelligence(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_venue_intelligence_trigger() TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_venue_live_aggregate(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_venue_live_aggregate_trigger() TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_pulse_reactions(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_venue_claim_verified() TO service_role;

COMMENT ON FUNCTION public.calculate_venue_pulse_score(uuid) IS
  'Internal score helper for refresh_venue_intelligence. Not an app RPC. EXECUTE: owner, service_role.';
COMMENT ON FUNCTION public.calculate_venue_score_velocity(uuid) IS
  'Internal velocity helper for refresh_venue_intelligence. Not an app RPC. EXECUTE: owner, service_role.';
COMMENT ON FUNCTION public.enforce_pulse_reply_rate_limit() IS
  'Trigger on pulse_replies. Not an app RPC. EXECUTE: owner, service_role.';
COMMENT ON FUNCTION public.pulse_agree_count(uuid) IS
  'Unused by src/ and supabase/functions. Agree rows stay readable via pulse_agrees SELECT. EXECUTE: owner, service_role.';
COMMENT ON FUNCTION public.pulse_reply_rate_limit_violation(uuid, uuid) IS
  'Helper for the reply rate-limit trigger and assert RPC. Not an app RPC. EXECUTE: owner, service_role.';
COMMENT ON FUNCTION public.refresh_venue_intelligence(uuid) IS
  'Writes venue scores. Called by the pulse trigger. Not an app RPC. EXECUTE: owner, service_role.';
COMMENT ON FUNCTION public.refresh_venue_intelligence_trigger() IS
  'Trigger on pulses. Not an app RPC. EXECUTE: owner, service_role.';
COMMENT ON FUNCTION public.refresh_venue_live_aggregate(uuid) IS
  'Writes venue_live_aggregates. Called by the live-report trigger. Not an app RPC. EXECUTE: owner, service_role.';
COMMENT ON FUNCTION public.refresh_venue_live_aggregate_trigger() IS
  'Trigger on venue_live_reports. Not an app RPC. EXECUTE: owner, service_role.';
COMMENT ON FUNCTION public.sync_pulse_reactions(uuid) IS
  'Writes pulses.reactions. Called by toggle_pulse_reaction as the owner. Not an app RPC. EXECUTE: owner, service_role.';
COMMENT ON FUNCTION public.sync_venue_claim_verified() IS
  'Trigger on venue_claims. Not an app RPC. EXECUTE: owner, service_role.';

-- ============================================================
-- 4. RLS enabled, zero policies: deny-all for API roles
--    service_role and postgres bypass RLS. No client policy.
--    launch_quiet_notices is written by the night-coach cron
--    (createAdminClient). stripe_webhook_events is written by the
--    Stripe webhook (service role). venue_surge_notices is the same
--    pattern for surge Web Push. App code under src/ does not read
--    these tables.
-- ============================================================

COMMENT ON TABLE public.launch_quiet_notices IS
  'Last quiet-night Web Push per launched non-default city. Service role only. One local night. RLS is on with no policy: deny-all for anon and authenticated. service_role bypasses RLS.';

COMMENT ON TABLE public.stripe_webhook_events IS
  'Stripe webhook idempotency ledger. Service role only. RLS is on with no policy: deny-all for anon and authenticated. service_role bypasses RLS.';

COMMENT ON TABLE public.venue_surge_notices IS
  'Last Electric surge Web Push per venue. Service role only. ≤1 notify / 2h. RLS is on with no policy: deny-all for anon and authenticated. service_role bypasses RLS.';

NOTIFY pgrst, 'reload schema';
