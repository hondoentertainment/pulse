-- Migration: Structured venue metadata + wait-time telemetry
-- Adds filterable, queryable fields to venues (dress code, cover charge,
-- accessibility features, indoor/outdoor) and a new venue_wait_times table
-- powering the ML wait-time estimator.
--
-- RLS strategy:
--   - Metadata is world-readable (already covered by the existing
--     "Venues are viewable by everyone." policy on venues).
--   - Writes to metadata require either (a) the service role, or
--     (b) an authenticated user with app_metadata.role = 'admin'.
--     We intentionally leave the existing
--     "Authenticated users can update venues." policy in place so the
--     community venue flow (user-contributed detail edits) still works; if a
--     tighter policy is desired, gate via the admin check below.
--
--   - venue_wait_times has public read, writes limited to the service role
--     (our Vercel cron Edge Function writes with the service role key).

-- ============================================================
-- 1. Enum types
-- ============================================================

DO $$ BEGIN
    CREATE TYPE venue_dress_code AS ENUM (
        'casual',
        'smart_casual',
        'upscale',
        'formal',
        'costume_required',
        'no_code'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE venue_indoor_outdoor AS ENUM ('indoor', 'outdoor', 'both');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE wait_time_confidence AS ENUM ('low', 'med', 'high');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 2. venues: new columns (all nullable / default-safe)
-- ============================================================

ALTER TABLE venues
    ADD COLUMN IF NOT EXISTS dress_code venue_dress_code,
    ADD COLUMN IF NOT EXISTS cover_charge_cents INTEGER,
    ADD COLUMN IF NOT EXISTS cover_charge_note TEXT,
    ADD COLUMN IF NOT EXISTS accessibility_features TEXT[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS indoor_outdoor venue_indoor_outdoor;

-- Check constraint on accessibility_features values (allowed tokens only)
DO $$ BEGIN
    ALTER TABLE venues
        ADD CONSTRAINT venues_accessibility_features_valid
        CHECK (
            accessibility_features IS NULL
            OR accessibility_features <@ ARRAY[
                'wheelchair_accessible',
                'step_free_entry',
                'accessible_restroom',
                'gender_neutral_restroom',
                'sensory_friendly',
                'quiet_hours',
                'service_animal_friendly',
                'signer_on_request',
                'braille_menu'
            ]::TEXT[]
        );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- GIN index so we can efficiently filter venues by accessibility tokens
CREATE INDEX IF NOT EXISTS idx_venues_accessibility_features
    ON venues USING GIN (accessibility_features);

-- ============================================================
-- 3. venue_wait_times: ML-backed wait-time snapshots
-- ============================================================

CREATE TABLE IF NOT EXISTS venue_wait_times (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    estimated_minutes INTEGER NOT NULL CHECK (estimated_minutes >= 0 AND estimated_minutes <= 240),
    confidence wait_time_confidence NOT NULL DEFAULT 'low',
    sample_size INTEGER NOT NULL DEFAULT 0 CHECK (sample_size >= 0),
    computed_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_venue_wait_times_venue_computed
    ON venue_wait_times (venue_id, computed_at DESC);

ALTER TABLE venue_wait_times ENABLE ROW LEVEL SECURITY;

-- Public read
DO $$ BEGIN
    CREATE POLICY "Wait times are viewable by everyone."
        ON venue_wait_times FOR SELECT
        USING (true);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Admin-only writes via app_metadata.role check.
-- The cron / Edge Function uses the SERVICE_ROLE key which bypasses RLS,
-- so this policy primarily guards the public anon / authenticated paths.
DO $$ BEGIN
    CREATE POLICY "Admins can insert wait times."
        ON venue_wait_times FOR INSERT
        TO authenticated
        WITH CHECK (
            coalesce(
                (current_setting('request.jwt.claims', true)::jsonb
                    -> 'app_metadata' ->> 'role'),
                ''
            ) = 'admin'
        );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Admins can update wait times."
        ON venue_wait_times FOR UPDATE
        TO authenticated
        USING (
            coalesce(
                (current_setting('request.jwt.claims', true)::jsonb
                    -> 'app_metadata' ->> 'role'),
                ''
            ) = 'admin'
        );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 4. Admin-gated write policies for venue metadata (additive)
-- ============================================================

-- We expose an *optional* tightening path: any write through this policy
-- must carry the admin role in app_metadata.  The broader
-- "Authenticated users can update venues." policy from the RLS migration
-- remains in force for user-contributed metadata; remove it once an
-- admin-curation workflow lands.
DO $$ BEGIN
    CREATE POLICY "Admins can update venue structured metadata."
        ON venues FOR UPDATE
        TO authenticated
        USING (
            coalesce(
                (current_setting('request.jwt.claims', true)::jsonb
                    -> 'app_metadata' ->> 'role'),
                ''
            ) = 'admin'
        )
        WITH CHECK (
            coalesce(
                (current_setting('request.jwt.claims', true)::jsonb
                    -> 'app_metadata' ->> 'role'),
                ''
            ) = 'admin'
        );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
