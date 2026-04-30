-- Migration: Core table scaffolding for backend migration
--
-- This migration is additive and idempotent. It builds on top of:
--   - 20260322000000_initial_schema.sql (profiles, venues, pulses, notifications)
--   - 20260329000001_add_missing_tables_and_columns.sql (presence, events)
--
-- Adds:
--   * soft-delete columns on user-owned tables
--   * updated_at columns + trigger for mutation audit
--   * dedicated `reactions` table (denormalised from pulses.reactions JSONB)
--   * dedicated `check_ins` table (was implicit via `presence`)
--   * `follows` table (user -> user and user -> venue)
--   * indexes to support common query paths
--
-- Note: it is safe to re-run. Every DDL statement uses IF NOT EXISTS or
-- equivalent guards.

-- ============================================================
-- 0. Shared helpers
-- ============================================================

-- Generic "updated_at" trigger. Idempotent via CREATE OR REPLACE.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$;

-- Helper: returns true if the caller's JWT carries an "admin" app_role claim.
-- Used by RLS policies to grant admin bypass without a service_role key.
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
    SELECT COALESCE(
        (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
        OR (auth.jwt() ->> 'role') = 'admin',
        false
    );
$$;

-- ============================================================
-- 1. Soft-delete + updated_at on existing tables
-- ============================================================
ALTER TABLE profiles      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW());
ALTER TABLE profiles      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE venues        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW());
ALTER TABLE venues        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE pulses        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW());
ALTER TABLE pulses        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW());

-- Attach triggers (idempotent via DROP/CREATE)
DROP TRIGGER IF EXISTS profiles_set_updated_at      ON profiles;
CREATE TRIGGER profiles_set_updated_at      BEFORE UPDATE ON profiles      FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS venues_set_updated_at        ON venues;
CREATE TRIGGER venues_set_updated_at        BEFORE UPDATE ON venues        FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS pulses_set_updated_at        ON pulses;
CREATE TRIGGER pulses_set_updated_at        BEFORE UPDATE ON pulses        FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS notifications_set_updated_at ON notifications;
CREATE TRIGGER notifications_set_updated_at BEFORE UPDATE ON notifications FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Partial indexes so live queries skip soft-deleted rows cheaply
CREATE INDEX IF NOT EXISTS idx_profiles_alive ON profiles (id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_venues_alive   ON venues   (id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pulses_alive   ON pulses   (id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pulses_user_id        ON pulses (user_id);
CREATE INDEX IF NOT EXISTS idx_pulses_user_created   ON pulses (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pulses_venue_created  ON pulses (venue_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_venues_category       ON venues (category);
CREATE INDEX IF NOT EXISTS idx_venues_city           ON venues (city);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
    ON notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
    ON notifications (user_id) WHERE read = false;

-- ============================================================
-- 2. reactions (normalised; one row per user-reaction-per-pulse)
-- ============================================================
-- The legacy pulses.reactions JSONB stays for back-compat, but new writes
-- should hit this table so we get per-user constraints + audit trail.
CREATE TABLE IF NOT EXISTS reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pulse_id UUID NOT NULL REFERENCES pulses(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    reaction_type TEXT NOT NULL
        CHECK (reaction_type IN ('fire', 'eyes', 'skull', 'lightning')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
    deleted_at TIMESTAMPTZ,
    -- one reaction of a given type per (user, pulse)
    CONSTRAINT reactions_unique_per_user_type UNIQUE (pulse_id, user_id, reaction_type)
);

CREATE INDEX IF NOT EXISTS idx_reactions_pulse_id  ON reactions (pulse_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_reactions_user_id   ON reactions (user_id)  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS reactions_set_updated_at ON reactions;
CREATE TRIGGER reactions_set_updated_at BEFORE UPDATE ON reactions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. check_ins (geo-verified visits; parent to pulses)
-- ============================================================
-- Distinct from `presence` which tracks currently-at-venue state.
-- A check_in is an immutable record of a user's verified arrival.
CREATE TABLE IF NOT EXISTS check_ins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    -- Location captured at check-in time (for audit/fraud-detection)
    checked_in_lat FLOAT,
    checked_in_lng FLOAT,
    -- Server-calculated distance from venue at check-in (miles)
    distance_from_venue_mi FLOAT,
    -- Crew context (null = solo check-in)
    crew_id UUID,
    -- Source of the check-in: self-reported vs geo-verified
    source TEXT NOT NULL DEFAULT 'geo'
        CHECK (source IN ('geo', 'manual', 'crew', 'event')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_check_ins_user_venue ON check_ins (user_id, venue_id);
CREATE INDEX IF NOT EXISTS idx_check_ins_venue_created
    ON check_ins (venue_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_check_ins_user_created
    ON check_ins (user_id, created_at DESC) WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS check_ins_set_updated_at ON check_ins;
CREATE TRIGGER check_ins_set_updated_at BEFORE UPDATE ON check_ins FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4. follows (user -> user, user -> venue)
-- ============================================================
-- A single follows table with a discriminator so we can page
-- "everything this user follows" in one query. Exactly one of
-- target_user_id / target_venue_id must be set.
CREATE TABLE IF NOT EXISTS follows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    target_user_id  UUID REFERENCES profiles(id) ON DELETE CASCADE,
    target_venue_id UUID REFERENCES venues(id)  ON DELETE CASCADE,
    target_kind TEXT NOT NULL
        CHECK (target_kind IN ('user', 'venue')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT follows_exactly_one_target CHECK (
        (target_kind = 'user'  AND target_user_id  IS NOT NULL AND target_venue_id IS NULL)
        OR
        (target_kind = 'venue' AND target_venue_id IS NOT NULL AND target_user_id  IS NULL)
    ),
    CONSTRAINT follows_no_self_follow CHECK (follower_id <> target_user_id)
);

-- Unique alive edge per (follower, target)
CREATE UNIQUE INDEX IF NOT EXISTS idx_follows_unique_user
    ON follows (follower_id, target_user_id)
    WHERE target_kind = 'user' AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_follows_unique_venue
    ON follows (follower_id, target_venue_id)
    WHERE target_kind = 'venue' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows (follower_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_follows_target_user  ON follows (target_user_id)  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_follows_target_venue ON follows (target_venue_id) WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS follows_set_updated_at ON follows;
CREATE TRIGGER follows_set_updated_at BEFORE UPDATE ON follows FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 5. Realtime publication (idempotent add)
-- ============================================================
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE reactions;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE check_ins;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE follows;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
END
$$;
