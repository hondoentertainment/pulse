-- Venue-track P0/P1: Seattle geo-gate inventory, versioned signals, scouts, arrivals.

ALTER TABLE venues
  ADD COLUMN IF NOT EXISTS neighborhood TEXT,
  ADD COLUMN IF NOT EXISTS inventory_source TEXT NOT NULL DEFAULT 'curated-seed';

CREATE INDEX IF NOT EXISTS idx_venues_city_state ON venues (city, state);
CREATE INDEX IF NOT EXISTS idx_venues_neighborhood ON venues (neighborhood);

CREATE TABLE IF NOT EXISTS venue_signals (
    venue_id UUID PRIMARY KEY REFERENCES venues(id) ON DELETE CASCADE,
    model_configuration JSONB NOT NULL,
    energy_score FLOAT NOT NULL DEFAULT 0,
    confidence TEXT NOT NULL DEFAULT 'low',
    trend TEXT NOT NULL DEFAULT 'unknown',
    freshness_minutes INTEGER,
    source_mix JSONB NOT NULL DEFAULT '{}'::jsonb,
    friction JSONB NOT NULL DEFAULT '{}'::jsonb,
    computed_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

ALTER TABLE venue_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Venue signals are viewable by everyone." ON venue_signals FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS scout_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    city TEXT NOT NULL,
    neighborhoods TEXT[] NOT NULL DEFAULT '{}',
    statement TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'submitted',
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
    decided_at TIMESTAMPTZ
);

ALTER TABLE scout_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own scout applications." ON scout_applications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own scout applications." ON scout_applications FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS scout_profiles (
    user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    tier TEXT NOT NULL DEFAULT 'applicant',
    corroborated_count INTEGER NOT NULL DEFAULT 0,
    contradicted_count INTEGER NOT NULL DEFAULT 0,
    unreviewed_count INTEGER NOT NULL DEFAULT 0,
    reputation INTEGER NOT NULL DEFAULT 0,
    approved_at TIMESTAMPTZ
);

ALTER TABLE scout_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Scout profiles are viewable by owner." ON scout_profiles FOR SELECT USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS arrival_watches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
    window_ms INTEGER NOT NULL DEFAULT 2700000,
    status TEXT NOT NULL DEFAULT 'pending',
    correction TEXT,
    resolved_at TIMESTAMPTZ
);

ALTER TABLE arrival_watches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own arrival watches." ON arrival_watches FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own arrival watches." ON arrival_watches FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own arrival watches." ON arrival_watches FOR UPDATE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION refresh_venue_signal(target_venue_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    pulse_count INTEGER;
    report_count INTEGER;
    computed JSONB := jsonb_build_object(
        'version', 'venue-signal.v1',
        'pulseDecayMinutes', 90,
        'liveIntelDecayMinutes', 30,
        'propagationSlaMs', 30000
    );
BEGIN
    SELECT COUNT(*) INTO pulse_count
    FROM pulses
    WHERE venue_id = target_venue_id
      AND deleted_at IS NULL
      AND created_at >= NOW() - INTERVAL '90 minutes';

    SELECT COUNT(*) INTO report_count
    FROM venue_live_reports
    WHERE venue_id = target_venue_id
      AND created_at >= NOW() - INTERVAL '30 minutes';

    INSERT INTO venue_signals (
        venue_id,
        model_configuration,
        energy_score,
        confidence,
        trend,
        freshness_minutes,
        source_mix,
        friction,
        computed_at
    )
    VALUES (
        target_venue_id,
        computed,
        COALESCE((SELECT pulse_score FROM venues WHERE id = target_venue_id), 0),
        CASE
            WHEN pulse_count + report_count >= 5 THEN 'high'
            WHEN pulse_count + report_count >= 2 THEN 'medium'
            ELSE 'low'
        END,
        'unknown',
        NULL,
        jsonb_build_object('pulses', pulse_count, 'liveReports', report_count, 'curatedSeed', true),
        '{}'::jsonb,
        NOW()
    )
    ON CONFLICT (venue_id) DO UPDATE SET
        model_configuration = EXCLUDED.model_configuration,
        energy_score = EXCLUDED.energy_score,
        confidence = EXCLUDED.confidence,
        source_mix = EXCLUDED.source_mix,
        computed_at = NOW();
END;
$$;
