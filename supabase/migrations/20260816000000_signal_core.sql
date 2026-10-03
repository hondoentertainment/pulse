-- Pulse Signal core tables (production default: VITE_APP_MODE=signal)
--
-- signal-data.ts reads/writes these tables. Without them, history fetch
-- throws and saves are swallowed — Signal stays localStorage-only.
-- FK target is auth.users: Signal users never create a venue `profiles` row.

CREATE TABLE IF NOT EXISTS signal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    focus TEXT NOT NULL CHECK (focus IN ('energy', 'mood', 'focus', 'sleep')),
    score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
    energy INTEGER NOT NULL CHECK (energy BETWEEN 1 AND 10),
    mood INTEGER NOT NULL CHECK (mood BETWEEN 1 AND 10),
    stress INTEGER NOT NULL CHECK (stress BETWEEN 1 AND 10),
    sleep_quality INTEGER NOT NULL CHECK (sleep_quality BETWEEN 1 AND 10),
    tags TEXT[] NOT NULL DEFAULT '{}',
    check_in_window TEXT NOT NULL CHECK (check_in_window IN ('morning', 'evening')),
    day_key TEXT NOT NULL CHECK (day_key ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, day_key, check_in_window)
);

CREATE INDEX IF NOT EXISTS idx_signal_entries_user_created_at
    ON signal_entries(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_signal_entries_user_day
    ON signal_entries(user_id, day_key DESC);

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

CREATE TABLE IF NOT EXISTS signal_profiles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    tracking_focus TEXT NOT NULL CHECK (tracking_focus IN ('energy', 'mood', 'focus', 'sleep')),
    goal TEXT NOT NULL CHECK (goal IN ('more_energy', 'less_stress', 'better_sleep', 'deeper_focus')),
    reminder_time TEXT CHECK (reminder_time IS NULL OR reminder_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
    reminder_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    reminder_timezone TEXT,
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

REVOKE ALL ON signal_entries FROM anon;
REVOKE ALL ON signal_profiles FROM anon;
