-- Migration: Safety Kit (safe-walk, share-my-night, panic, trusted rides)
-- Depends on: profiles (from 20260322000000_initial_schema.sql),
--             venues (from 20260322000000_initial_schema.sql)
--
-- RLS posture
-- -----------
-- All rows in this migration are owner-only. `auth.uid()` must match `user_id`
-- on every insert/select/update/delete. Admin triage access is granted via a
-- `app_metadata.role = 'safety_responder'` claim checked by the helper
-- function `is_safety_responder()` below. That role is *additive* - it never
-- overrides owner access, only supplements it.

-- ============================================================
-- Helper: safety responder check
-- ============================================================
CREATE OR REPLACE FUNCTION is_safety_responder()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', true)::jsonb
      -> 'app_metadata' ->> 'role') = 'safety_responder',
    false
  );
$$;

-- ============================================================
-- 1. emergency_contacts
-- ============================================================
CREATE TABLE emergency_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone_e164 TEXT NOT NULL,
    relationship TEXT,
    verified_at TIMESTAMP WITH TIME ZONE,
    preferred_contact_method TEXT NOT NULL DEFAULT 'sms'
        CHECK (preferred_contact_method IN ('sms', 'push')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT emergency_contacts_phone_e164_format CHECK (phone_e164 ~ '^\+[1-9][0-9]{6,14}$')
);

CREATE INDEX idx_emergency_contacts_user_id ON emergency_contacts(user_id);
CREATE UNIQUE INDEX idx_emergency_contacts_user_phone
    ON emergency_contacts(user_id, phone_e164);

ALTER TABLE emergency_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner selects their emergency contacts"
    ON emergency_contacts FOR SELECT
    USING (auth.uid() = user_id OR is_safety_responder());

CREATE POLICY "Owner inserts their emergency contacts"
    ON emergency_contacts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner updates their emergency contacts"
    ON emergency_contacts FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner deletes their emergency contacts"
    ON emergency_contacts FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================================
-- 2. safety_sessions
-- ============================================================
CREATE TYPE safety_session_kind AS ENUM ('safe_walk', 'share_night', 'panic');
CREATE TYPE safety_session_state AS ENUM ('armed', 'active', 'completed', 'alerted', 'cancelled');

CREATE TABLE safety_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    kind safety_session_kind NOT NULL,
    state safety_session_state NOT NULL DEFAULT 'armed',
    starts_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    expected_end_at TIMESTAMP WITH TIME ZONE,
    actual_end_at TIMESTAMP WITH TIME ZONE,
    last_ping_at TIMESTAMP WITH TIME ZONE,
    last_location_lat FLOAT,
    last_location_lng FLOAT,
    destination_venue_id UUID REFERENCES venues(id) ON DELETE SET NULL,
    destination_lat FLOAT,
    destination_lng FLOAT,
    destination_label TEXT,
    contacts_notified JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- `contacts_snapshot` holds the frozen list of contact ids + phones at session start
    -- so later edits to emergency_contacts do not retroactively change who gets alerted.
    contacts_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX idx_safety_sessions_user_state ON safety_sessions(user_id, state);
CREATE INDEX idx_safety_sessions_expected_end_at
    ON safety_sessions(expected_end_at)
    WHERE state = 'active';

ALTER TABLE safety_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner selects their sessions"
    ON safety_sessions FOR SELECT
    USING (auth.uid() = user_id OR is_safety_responder());

CREATE POLICY "Owner inserts their sessions"
    ON safety_sessions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner updates their sessions"
    ON safety_sessions FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 3. safety_pings
-- ============================================================
CREATE TABLE safety_pings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES safety_sessions(id) ON DELETE CASCADE,
    location_lat FLOAT NOT NULL,
    location_lng FLOAT NOT NULL,
    battery_pct INTEGER,
    network_quality TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX idx_safety_pings_session_created
    ON safety_pings(session_id, created_at DESC);

ALTER TABLE safety_pings ENABLE ROW LEVEL SECURITY;

-- Pings RLS piggybacks on session ownership.
CREATE POLICY "Owner selects pings for their sessions"
    ON safety_pings FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM safety_sessions s
            WHERE s.id = safety_pings.session_id
              AND (s.user_id = auth.uid() OR is_safety_responder())
        )
    );

CREATE POLICY "Owner inserts pings for their sessions"
    ON safety_pings FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM safety_sessions s
            WHERE s.id = safety_pings.session_id
              AND s.user_id = auth.uid()
        )
    );

-- ============================================================
-- 4. trusted_rides
-- ============================================================
CREATE TYPE trusted_ride_provider AS ENUM ('uber', 'lyft');

CREATE TABLE trusted_rides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    session_id UUID REFERENCES safety_sessions(id) ON DELETE SET NULL,
    provider trusted_ride_provider NOT NULL,
    ride_id TEXT,
    pickup_lat FLOAT,
    pickup_lng FLOAT,
    dropoff_lat FLOAT,
    dropoff_lng FLOAT,
    status TEXT NOT NULL DEFAULT 'requested',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX idx_trusted_rides_user_status ON trusted_rides(user_id, status);

ALTER TABLE trusted_rides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner selects their trusted rides"
    ON trusted_rides FOR SELECT
    USING (auth.uid() = user_id OR is_safety_responder());

CREATE POLICY "Owner inserts their trusted rides"
    ON trusted_rides FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner updates their trusted rides"
    ON trusted_rides FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 5. contact_verification_codes (short-lived OTPs)
-- ============================================================
CREATE TABLE contact_verification_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID NOT NULL REFERENCES emergency_contacts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    code_hash TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    consumed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX idx_contact_verification_codes_contact
    ON contact_verification_codes(contact_id, expires_at DESC);

ALTER TABLE contact_verification_codes ENABLE ROW LEVEL SECURITY;

-- Only the owner may read their own OTP rows (they'll only see hashes, but
-- we lock it down defensively).
CREATE POLICY "Owner selects their verification codes"
    ON contact_verification_codes FOR SELECT
    USING (auth.uid() = user_id);

-- Inserts and updates go through the service role from the Edge Function -
-- no policy for those, so they require the service-role bypass.

-- ============================================================
-- 6. safety_audit (alerted/panic audit log)
-- ============================================================
CREATE TABLE safety_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES safety_sessions(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    event TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX idx_safety_audit_user_created
    ON safety_audit(user_id, created_at DESC);

ALTER TABLE safety_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner selects their audit rows"
    ON safety_audit FOR SELECT
    USING (auth.uid() = user_id OR is_safety_responder());

-- Inserts go through the service role from Edge Functions only.

-- ============================================================
-- Retention: ping rows older than 30 days are purged by a scheduled job.
-- The job lives in api/safety/cron/check-expired.ts (it also runs a purge
-- pass on each invocation). A dedicated pg_cron job can replace it later.
-- ============================================================
