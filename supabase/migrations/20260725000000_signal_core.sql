-- Migration: Pulse Signal core tables
--
-- Pulse Signal (VITE_APP_MODE=signal, the production default) persists daily
-- check-ins through `src/lib/signal-data.ts`, which reads and writes
-- `signal_entries` and `signal_profiles`. Neither table existed, so every sync
-- failed: fetches threw (surfacing the "Couldn't sync history" banner) and
-- saves were swallowed with a console warning. Signal was effectively
-- localStorage-only — clearing browser data destroyed a user's entire streak
-- and history, with no cross-device support.
--
-- FK target is auth.users rather than profiles: `profiles` requires a unique
-- username and is created by the venue onboarding flow, which Signal users
-- never run. Signal only ever has a Supabase auth user.

-- ---------------------------------------------------------------------------
-- signal_entries — one row per daily check-in
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS signal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    -- Client-authored so an offline check-in keeps the moment it was taken.
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    focus TEXT NOT NULL CHECK (focus IN ('energy', 'mood', 'focus', 'sleep')),
    -- Composite 0–100 signal score (see src/lib/signal-score.ts).
    score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
    -- Raw 1–10 slider inputs.
    energy INTEGER NOT NULL CHECK (energy BETWEEN 1 AND 10),
    mood INTEGER NOT NULL CHECK (mood BETWEEN 1 AND 10),
    stress INTEGER NOT NULL CHECK (stress BETWEEN 1 AND 10),
    sleep_quality INTEGER NOT NULL CHECK (sleep_quality BETWEEN 1 AND 10),
    tags TEXT[] NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- History reads filter by user and order by created_at DESC.
CREATE INDEX IF NOT EXISTS idx_signal_entries_user_created_at
    ON signal_entries(user_id, created_at DESC);

ALTER TABLE signal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own signal entries."
    ON signal_entries FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own signal entries."
    ON signal_entries FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own signal entries."
    ON signal_entries FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own signal entries."
    ON signal_entries FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- signal_profiles — one row per user (onboarding focus/goal + reminder prefs)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS signal_profiles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    tracking_focus TEXT NOT NULL CHECK (tracking_focus IN ('energy', 'mood', 'focus', 'sleep')),
    goal TEXT NOT NULL CHECK (goal IN ('more_energy', 'less_stress', 'better_sleep', 'deeper_focus')),
    -- Local wall-clock 'HH:MM' for the daily reminder; NULL until chosen.
    reminder_time TEXT CHECK (reminder_time IS NULL OR reminder_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
    reminder_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE signal_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own signal profile."
    ON signal_profiles FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own signal profile."
    ON signal_profiles FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own signal profile."
    ON signal_profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own signal profile."
    ON signal_profiles FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION touch_signal_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER signal_entries_touch_updated_at
    BEFORE UPDATE ON signal_entries
    FOR EACH ROW
    EXECUTE FUNCTION touch_signal_updated_at();

CREATE TRIGGER signal_profiles_touch_updated_at
    BEFORE UPDATE ON signal_profiles
    FOR EACH ROW
    EXECUTE FUNCTION touch_signal_updated_at();

-- Anonymous clients must never touch personal check-in data.
REVOKE ALL ON signal_entries FROM anon;
REVOKE ALL ON signal_profiles FROM anon;
