-- Venue claims (server source of truth) + report queue status
--
-- Replaces client-only `venue-claims` KV as the authority for inbox access.
-- Verified rows (or existing venue_staff) unlock /venue/:id/inbox.
--
-- Also adds a lightweight status column on pulse_reports so reporters can
-- list their own filings and admins can triage without a heavy console.
--
-- Apply on production project xeldqwhztcnnvazmshzh via SQL editor
-- (migration history versions there do not match repo filenames).
-- Verify with: supabase/verify/venue_claims.sql

CREATE TABLE IF NOT EXISTS public.venue_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'verified', 'rejected')),
    evidence TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
    reviewed_at TIMESTAMPTZ,
    UNIQUE (venue_id, user_id)
);

CREATE INDEX IF NOT EXISTS venue_claims_user_idx
    ON public.venue_claims (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS venue_claims_venue_status_idx
    ON public.venue_claims (venue_id, status);

ALTER TABLE public.venue_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "venue_claims_select_own_or_admin" ON public.venue_claims;
CREATE POLICY "venue_claims_select_own_or_admin"
    ON public.venue_claims FOR SELECT
    USING (auth.uid() = user_id OR is_admin());

DROP POLICY IF EXISTS "venue_claims_insert_self" ON public.venue_claims;
CREATE POLICY "venue_claims_insert_self"
    ON public.venue_claims FOR INSERT
    WITH CHECK (auth.uid() = user_id AND status = 'pending');

DROP POLICY IF EXISTS "venue_claims_update_own_pending" ON public.venue_claims;
CREATE POLICY "venue_claims_update_own_pending"
    ON public.venue_claims FOR UPDATE
    USING (auth.uid() = user_id AND status = 'pending')
    WITH CHECK (auth.uid() = user_id AND status = 'pending');

DROP POLICY IF EXISTS "venue_claims_admin_all" ON public.venue_claims;
CREATE POLICY "venue_claims_admin_all"
    ON public.venue_claims FOR ALL
    USING (is_admin())
    WITH CHECK (is_admin());

GRANT SELECT, INSERT, UPDATE ON public.venue_claims TO authenticated;

DROP TRIGGER IF EXISTS venue_claims_set_updated_at ON public.venue_claims;
CREATE TRIGGER venue_claims_set_updated_at
    BEFORE UPDATE ON public.venue_claims
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Reporter/admin queue fields on existing pulse_reports (MVP).
ALTER TABLE public.pulse_reports
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';

ALTER TABLE public.pulse_reports
    DROP CONSTRAINT IF EXISTS pulse_reports_status_check;

ALTER TABLE public.pulse_reports
    ADD CONSTRAINT pulse_reports_status_check
    CHECK (status IN ('pending', 'reviewed', 'actioned', 'dismissed'));

ALTER TABLE public.pulse_reports
    ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS pulse_reports_reporter_created_idx
    ON public.pulse_reports (reporter_id, created_at DESC);

CREATE INDEX IF NOT EXISTS pulse_reports_status_idx
    ON public.pulse_reports (status, created_at DESC);

GRANT UPDATE ON public.pulse_reports TO authenticated;
