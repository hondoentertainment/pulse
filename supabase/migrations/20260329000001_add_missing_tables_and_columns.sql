-- Migration: Add missing tables (presence, events) and columns
-- Builds on top of 20260322000000_initial_schema.sql

-- ============================================================
-- 1. Add missing columns to profiles
-- ============================================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio TEXT;

-- ============================================================
-- 2. Add missing column to venues
-- ============================================================
ALTER TABLE venues ADD COLUMN IF NOT EXISTS last_activity TIMESTAMPTZ;

-- ============================================================
-- 3. Set default for pulses.expires_at
-- ============================================================
ALTER TABLE pulses ALTER COLUMN expires_at SET DEFAULT now() + interval '90 minutes';

-- ============================================================
-- 4. PRESENCE table
-- ============================================================
CREATE TABLE IF NOT EXISTS presence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    lat FLOAT,
    lng FLOAT,
    checked_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    left_at TIMESTAMPTZ,
    visibility TEXT NOT NULL DEFAULT 'everyone'
        CHECK (visibility IN ('everyone', 'friends', 'off')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_presence_user_id ON presence(user_id);
CREATE INDEX idx_presence_venue_id ON presence(venue_id);
CREATE INDEX idx_presence_checked_in_at ON presence(checked_in_at DESC);

ALTER TABLE presence ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 5. EVENTS table
-- ============================================================
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    category TEXT,
    image_url TEXT,
    ticket_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_events_venue_id ON events(venue_id);
CREATE INDEX idx_events_date ON events(date);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
