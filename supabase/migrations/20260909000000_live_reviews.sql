-- Live Reviews v1
--
-- Extends the existing `pulses` table rather than adding a parallel reviews
-- system. A LiveReview is a pulse with:
--   kind = 'review'
--   caption required at the application/API layer (1–280 chars)
--   location_verified = true when GPS placed the author inside check-in radius
--
-- Existing rows stay kind = 'pulse' (energy check-ins). Venue create writes
-- kind = 'review'. Unrelated Signal tables are not touched.
--
-- Apply with: supabase db push   (or your usual migration pipeline)

ALTER TABLE pulses
    ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'pulse';

ALTER TABLE pulses
    DROP CONSTRAINT IF EXISTS pulses_kind_check;

ALTER TABLE pulses
    ADD CONSTRAINT pulses_kind_check CHECK (kind IN ('pulse', 'review'));

ALTER TABLE pulses
    ADD COLUMN IF NOT EXISTS location_verified BOOLEAN NOT NULL DEFAULT false;

-- Generated filter helper: caption present after trim.
ALTER TABLE pulses
    ADD COLUMN IF NOT EXISTS has_body BOOLEAN
    GENERATED ALWAYS AS (caption IS NOT NULL AND length(btrim(caption)) > 0) STORED;

CREATE INDEX IF NOT EXISTS pulses_live_reviews_venue_created_idx
    ON pulses (venue_id, created_at DESC)
    WHERE deleted_at IS NULL AND kind = 'review';

CREATE INDEX IF NOT EXISTS pulses_user_venue_created_idx
    ON pulses (user_id, venue_id, created_at DESC)
    WHERE deleted_at IS NULL;

-- Persist hide/report for pulses (MVP). Video reports remain in video_reports.
CREATE TABLE IF NOT EXISTS pulse_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    pulse_id UUID NOT NULL REFERENCES pulses(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    details TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
    UNIQUE (reporter_id, pulse_id)
);

CREATE INDEX IF NOT EXISTS pulse_reports_pulse_idx
    ON pulse_reports (pulse_id, created_at DESC);

ALTER TABLE pulse_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pulse_reports_insert_self" ON pulse_reports;
CREATE POLICY "pulse_reports_insert_self"
    ON pulse_reports FOR INSERT
    WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "pulse_reports_select_self" ON pulse_reports;
CREATE POLICY "pulse_reports_select_self"
    ON pulse_reports FOR SELECT
    USING (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "pulse_reports_admin_all" ON pulse_reports;
CREATE POLICY "pulse_reports_admin_all"
    ON pulse_reports FOR ALL
    USING (is_admin())
    WITH CHECK (is_admin());

GRANT SELECT, INSERT ON pulse_reports TO authenticated;
