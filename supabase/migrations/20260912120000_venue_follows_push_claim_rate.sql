-- Reuse prod follows + push_tokens + notifications.
-- Additive web-push columns, domain-match claim verify, pulse rate limits.
--
-- Do NOT create venue_follows or web_push_subscriptions.
-- Do NOT touch venues.claim_verified / venue_claim_badges (already on prod).
-- Do NOT touch spatial_ref_sys.
--
-- Venue follow = follows.target_kind = 'venue' + target_venue_id
--   (soft-delete via deleted_at). Existing follows RLS is unchanged.
-- Web Push = push_tokens.platform = 'web', token = endpoint.
-- In-app fan-out = existing notifications (friend_pulse).
--
-- Verify with:
--   supabase/verify/follows.sql
--   supabase/verify/push_tokens.sql
--   supabase/verify/venue_claim_domain.sql
--   supabase/verify/pulse_rate_limit.sql

-- ============================================================
-- 1. follows — already on prod. No new table. No new policies.
--    Inspected RLS (leave as-is):
--      SELECT: deleted_at IS NULL OR is_admin()
--      INSERT: auth.uid() = follower_id
--      UPDATE/DELETE: auth.uid() = follower_id OR is_admin()
--    Anon: no writes (REVOKEd). Soft-delete via deleted_at.
-- ============================================================

-- ============================================================
-- 2. push_tokens — add web-push columns; keep owner-only RLS
--    Inspected RLS (leave as-is):
--      SELECT/INSERT/UPDATE/DELETE: auth.uid() = user_id
--    notifications (inspected, leave as-is):
--      SELECT/UPDATE/DELETE: auth.uid() = user_id OR is_admin()
--      INSERT: service_role only (friend_pulse fan-out)
-- ============================================================
DO $$
DECLARE
    cname TEXT;
BEGIN
    FOR cname IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'public.push_tokens'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%platform%'
    LOOP
        EXECUTE format('ALTER TABLE public.push_tokens DROP CONSTRAINT %I', cname);
    END LOOP;

    ALTER TABLE public.push_tokens
        ADD CONSTRAINT push_tokens_platform_check
        CHECK (platform IN ('ios', 'android', 'web'));
END
$$;

ALTER TABLE public.push_tokens ADD COLUMN IF NOT EXISTS p256dh TEXT;
ALTER TABLE public.push_tokens ADD COLUMN IF NOT EXISTS auth TEXT;
ALTER TABLE public.push_tokens ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE public.push_tokens ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;
ALTER TABLE public.push_tokens ADD COLUMN IF NOT EXISTS scope TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'push_tokens_scope_check'
    ) THEN
        ALTER TABLE public.push_tokens
            ADD CONSTRAINT push_tokens_scope_check
            CHECK (
                scope IS NULL
                OR scope IN ('followed', 'nearby', 'followed_or_nearby')
            );
    END IF;
END
$$;

-- ============================================================
-- 3. Self-serve domain-match claim (no invented admin)
-- ============================================================
ALTER TABLE public.venues
    ADD COLUMN IF NOT EXISTS owner_email_domain TEXT;

ALTER TABLE public.venue_claims
    ADD COLUMN IF NOT EXISTS work_email TEXT;

ALTER TABLE public.venue_claims
    ADD COLUMN IF NOT EXISTS work_email_confirmed_at TIMESTAMPTZ;

-- Extract a registrable-ish host from a website URL or email / domain string.
CREATE OR REPLACE FUNCTION public.normalize_owner_domain(raw TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    value TEXT;
BEGIN
    IF raw IS NULL THEN
        RETURN NULL;
    END IF;
    value := lower(btrim(raw));
    IF value = '' THEN
        RETURN NULL;
    END IF;
    value := regexp_replace(value, '^mailto:', '');
    IF position('@' IN value) > 0 THEN
        value := split_part(value, '@', 2);
    END IF;
    value := regexp_replace(value, '^https?://', '');
    value := regexp_replace(value, '^www\.', '');
    value := split_part(value, '/', 1);
    value := split_part(value, ':', 1);
    value := split_part(value, '?', 1);
    IF value = '' OR position('.' IN value) = 0 THEN
        RETURN NULL;
    END IF;
    RETURN value;
END;
$$;

CREATE OR REPLACE FUNCTION public.venue_owner_match_domains(p_venue public.venues)
RETURNS TEXT[]
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    domains TEXT[] := ARRAY[]::TEXT[];
    candidate TEXT;
BEGIN
    candidate := public.normalize_owner_domain(p_venue.owner_email_domain);
    IF candidate IS NOT NULL THEN
        domains := array_append(domains, candidate);
    END IF;
    candidate := public.normalize_owner_domain(p_venue.website);
    IF candidate IS NOT NULL AND NOT (candidate = ANY (domains)) THEN
        domains := array_append(domains, candidate);
    END IF;
    RETURN domains;
END;
$$;

-- Caller must already be signed in as the work email (magic-link / OTP).
-- Domain match → verified. No match → pending stays pending.
-- Never verifies from pending alone. Never invents admin.
CREATE OR REPLACE FUNCTION public.try_verify_venue_claim_by_email_domain(p_claim_id UUID)
RETURNS public.venue_claims
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    claim_row public.venue_claims;
    venue_row public.venues;
    auth_email TEXT;
    work_domain TEXT;
    match_domains TEXT[];
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Sign in required to verify a venue claim';
    END IF;

    SELECT * INTO claim_row
    FROM public.venue_claims
    WHERE id = p_claim_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Claim not found';
    END IF;

    IF claim_row.user_id <> auth.uid() THEN
        RAISE EXCEPTION 'You can only verify your own claim';
    END IF;

    IF claim_row.status = 'verified' THEN
        RETURN claim_row;
    END IF;

    IF claim_row.status <> 'pending' THEN
        RETURN claim_row;
    END IF;

    auth_email := lower(btrim(COALESCE(auth.jwt() ->> 'email', '')));
    IF auth_email = '' THEN
        RETURN claim_row;
    END IF;

    IF claim_row.work_email IS NULL OR lower(btrim(claim_row.work_email)) <> auth_email THEN
        RETURN claim_row;
    END IF;

    SELECT * INTO venue_row FROM public.venues WHERE id = claim_row.venue_id;
    IF NOT FOUND THEN
        RETURN claim_row;
    END IF;

    work_domain := public.normalize_owner_domain(auth_email);
    match_domains := public.venue_owner_match_domains(venue_row);

    IF work_domain IS NULL OR match_domains IS NULL OR NOT (work_domain = ANY (match_domains)) THEN
        RETURN claim_row;
    END IF;

    UPDATE public.venue_claims
    SET status = 'verified',
        reviewed_at = TIMEZONE('utc'::text, NOW()),
        work_email_confirmed_at = TIMEZONE('utc'::text, NOW()),
        notes = COALESCE(notes, 'Verified via work-email domain match')
    WHERE id = claim_row.id
    RETURNING * INTO claim_row;

    RETURN claim_row;
END;
$$;

REVOKE ALL ON FUNCTION public.try_verify_venue_claim_by_email_domain(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.try_verify_venue_claim_by_email_domain(UUID) TO authenticated;

-- ============================================================
-- 4. Pulse / live_review rate limits (clients cannot bypass)
--    5 per user per 10 minutes
--    1 per user+venue per 2 minutes
-- ============================================================
CREATE OR REPLACE FUNCTION public.pulse_rate_limit_violation(
    p_user_id UUID,
    p_venue_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    user_count INTEGER;
    venue_count INTEGER;
BEGIN
    SELECT count(*) INTO user_count
    FROM public.pulses
    WHERE user_id = p_user_id
      AND deleted_at IS NULL
      AND created_at > TIMEZONE('utc'::text, NOW()) - INTERVAL '10 minutes';

    IF user_count >= 5 THEN
        RETURN 'Too many pulses — max 5 every 10 minutes';
    END IF;

    SELECT count(*) INTO venue_count
    FROM public.pulses
    WHERE user_id = p_user_id
      AND venue_id = p_venue_id
      AND deleted_at IS NULL
      AND created_at > TIMEZONE('utc'::text, NOW()) - INTERVAL '2 minutes';

    IF venue_count >= 1 THEN
        RETURN 'Wait 2 minutes before another pulse at this venue';
    END IF;

    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_pulse_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    violation TEXT;
BEGIN
    violation := public.pulse_rate_limit_violation(NEW.user_id, NEW.venue_id);
    IF violation IS NOT NULL THEN
        RAISE EXCEPTION '%', violation
            USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pulses_enforce_rate_limit ON public.pulses;
CREATE TRIGGER pulses_enforce_rate_limit
    BEFORE INSERT ON public.pulses
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_pulse_rate_limit();

CREATE OR REPLACE FUNCTION public.assert_pulse_rate_limit(
    p_user_id UUID,
    p_venue_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    violation TEXT;
BEGIN
    IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
        RAISE EXCEPTION 'Sign in required to create a pulse'
            USING ERRCODE = '42501';
    END IF;
    violation := public.pulse_rate_limit_violation(p_user_id, p_venue_id);
    IF violation IS NOT NULL THEN
        RAISE EXCEPTION '%', violation
            USING ERRCODE = 'P0001';
    END IF;
    RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_pulse_rate_limit(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assert_pulse_rate_limit(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pulse_rate_limit_violation(UUID, UUID) TO authenticated;
