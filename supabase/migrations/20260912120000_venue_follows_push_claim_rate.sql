-- Venue follows, web-push subscriptions, domain-match claim verify,
-- and server-enforced pulse rate limits.
--
-- Additive / idempotent. Safe if 20260912000000_venue_claim_verified_badge.sql
-- is already applied on xeldqwhztcnnvazmshzh.
--
-- Verify with:
--   supabase/verify/venue_follows.sql
--   supabase/verify/web_push_subscriptions.sql
--   supabase/verify/venue_claim_domain.sql
--   supabase/verify/pulse_rate_limit.sql

-- ============================================================
-- 1. venue_follows (user_id + venue_id, owner-only RLS)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.venue_follows (
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
    PRIMARY KEY (user_id, venue_id)
);

CREATE INDEX IF NOT EXISTS venue_follows_user_idx
    ON public.venue_follows (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS venue_follows_venue_idx
    ON public.venue_follows (venue_id);

ALTER TABLE public.venue_follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "venue_follows_select_own" ON public.venue_follows;
CREATE POLICY "venue_follows_select_own"
    ON public.venue_follows FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "venue_follows_insert_own" ON public.venue_follows;
CREATE POLICY "venue_follows_insert_own"
    ON public.venue_follows FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "venue_follows_delete_own" ON public.venue_follows;
CREATE POLICY "venue_follows_delete_own"
    ON public.venue_follows FOR DELETE
    USING (auth.uid() = user_id);

GRANT SELECT, INSERT, DELETE ON public.venue_follows TO authenticated;
REVOKE ALL ON public.venue_follows FROM anon;

-- ============================================================
-- 2. web_push_subscriptions (endpoint + keys, optional geo scope)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.web_push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    scope TEXT NOT NULL DEFAULT 'followed_or_nearby'
        CHECK (scope IN ('followed', 'nearby', 'followed_or_nearby')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
    UNIQUE (user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS web_push_subscriptions_user_idx
    ON public.web_push_subscriptions (user_id);

ALTER TABLE public.web_push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "web_push_subscriptions_select_own" ON public.web_push_subscriptions;
CREATE POLICY "web_push_subscriptions_select_own"
    ON public.web_push_subscriptions FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "web_push_subscriptions_insert_own" ON public.web_push_subscriptions;
CREATE POLICY "web_push_subscriptions_insert_own"
    ON public.web_push_subscriptions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "web_push_subscriptions_update_own" ON public.web_push_subscriptions;
CREATE POLICY "web_push_subscriptions_update_own"
    ON public.web_push_subscriptions FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "web_push_subscriptions_delete_own" ON public.web_push_subscriptions;
CREATE POLICY "web_push_subscriptions_delete_own"
    ON public.web_push_subscriptions FOR DELETE
    USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.web_push_subscriptions TO authenticated;
REVOKE ALL ON public.web_push_subscriptions FROM anon;

DROP TRIGGER IF EXISTS web_push_subscriptions_set_updated_at ON public.web_push_subscriptions;
CREATE TRIGGER web_push_subscriptions_set_updated_at
    BEFORE UPDATE ON public.web_push_subscriptions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

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
