-- Durable venue feedback and normalized pulse reactions.

CREATE TYPE venue_live_report_type AS ENUM (
    'wait_time',
    'cover_charge',
    'music',
    'crowd_level',
    'dress_code',
    'now_playing',
    'age_range'
);

CREATE TYPE pulse_reaction_type AS ENUM ('fire', 'eyes', 'skull', 'lightning');

CREATE TABLE venue_live_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    type venue_live_report_type NOT NULL,
    value JSONB NOT NULL,
    confidence_weight FLOAT DEFAULT 1.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX idx_venue_live_reports_venue_created_at ON venue_live_reports(venue_id, created_at DESC);
CREATE INDEX idx_venue_live_reports_type_created_at ON venue_live_reports(type, created_at DESC);

ALTER TABLE venue_live_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Venue live reports are viewable by everyone." ON venue_live_reports FOR SELECT USING (true);
CREATE POLICY "Users can insert their own venue live reports." ON venue_live_reports FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own venue live reports." ON venue_live_reports FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own venue live reports." ON venue_live_reports FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE venue_live_aggregates (
    venue_id UUID PRIMARY KEY REFERENCES venues(id) ON DELETE CASCADE,
    report_count INTEGER DEFAULT 0,
    wait_time INTEGER,
    cover_charge INTEGER,
    cover_charge_note TEXT,
    crowd_level INTEGER DEFAULT 0,
    dress_code TEXT,
    music_genre TEXT,
    now_playing JSONB,
    confidence JSONB DEFAULT '{}'::jsonb,
    last_report_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE venue_live_aggregates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Venue live aggregates are viewable by everyone." ON venue_live_aggregates FOR SELECT USING (true);

CREATE TABLE pulse_reactions (
    pulse_id UUID NOT NULL REFERENCES pulses(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    reaction_type pulse_reaction_type NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    PRIMARY KEY (pulse_id, user_id, reaction_type)
);

CREATE INDEX idx_pulse_reactions_pulse_id ON pulse_reactions(pulse_id);
CREATE INDEX idx_pulse_reactions_user_id ON pulse_reactions(user_id);

ALTER TABLE pulse_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Pulse reactions are viewable by everyone." ON pulse_reactions FOR SELECT USING (true);
CREATE POLICY "Users can insert their own pulse reactions." ON pulse_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own pulse reactions." ON pulse_reactions FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION sync_pulse_reactions(target_pulse_id UUID)
RETURNS JSONB AS $$
DECLARE
    next_reactions JSONB;
BEGIN
    SELECT jsonb_build_object(
        'fire', COALESCE(jsonb_agg(user_id::text) FILTER (WHERE reaction_type = 'fire'), '[]'::jsonb),
        'eyes', COALESCE(jsonb_agg(user_id::text) FILTER (WHERE reaction_type = 'eyes'), '[]'::jsonb),
        'skull', COALESCE(jsonb_agg(user_id::text) FILTER (WHERE reaction_type = 'skull'), '[]'::jsonb),
        'lightning', COALESCE(jsonb_agg(user_id::text) FILTER (WHERE reaction_type = 'lightning'), '[]'::jsonb)
    )
    INTO next_reactions
    FROM pulse_reactions
    WHERE pulse_id = target_pulse_id;

    UPDATE pulses
    SET reactions = COALESCE(next_reactions, '{"fire": [], "eyes": [], "skull": [], "lightning": []}'::jsonb)
    WHERE id = target_pulse_id;

    RETURN COALESCE(next_reactions, '{"fire": [], "eyes": [], "skull": [], "lightning": []}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION toggle_pulse_reaction(target_pulse_id UUID, target_reaction_type pulse_reaction_type)
RETURNS JSONB AS $$
DECLARE
    current_user_id UUID := auth.uid();
    already_exists BOOLEAN;
BEGIN
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM pulse_reactions
        WHERE pulse_id = target_pulse_id
          AND user_id = current_user_id
          AND reaction_type = target_reaction_type
    )
    INTO already_exists;

    IF already_exists THEN
        DELETE FROM pulse_reactions
        WHERE pulse_id = target_pulse_id
          AND user_id = current_user_id
          AND reaction_type = target_reaction_type;
    ELSE
        INSERT INTO pulse_reactions (pulse_id, user_id, reaction_type)
        VALUES (target_pulse_id, current_user_id, target_reaction_type);
    END IF;

    RETURN sync_pulse_reactions(target_pulse_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION confidence_from_count(report_count INTEGER)
RETURNS TEXT AS $$
BEGIN
    IF report_count >= 5 THEN
        RETURN 'high';
    ELSIF report_count >= 2 THEN
        RETURN 'medium';
    END IF;
    RETURN 'low';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION refresh_venue_live_aggregate(target_venue_id UUID)
RETURNS VOID AS $$
DECLARE
    report_window TIMESTAMP WITH TIME ZONE := TIMEZONE('utc'::text, NOW()) - INTERVAL '30 minutes';
BEGIN
    INSERT INTO venue_live_aggregates (
        venue_id,
        report_count,
        wait_time,
        cover_charge,
        cover_charge_note,
        crowd_level,
        dress_code,
        music_genre,
        now_playing,
        confidence,
        last_report_at,
        updated_at
    )
    SELECT
        target_venue_id,
        COUNT(*)::INTEGER,
        ROUND(AVG((value #>> '{}')::numeric) FILTER (WHERE type = 'wait_time'))::INTEGER,
        (SELECT (value->>'amount')::INTEGER FROM venue_live_reports WHERE venue_id = target_venue_id AND type = 'cover_charge' AND created_at >= report_window ORDER BY created_at DESC LIMIT 1),
        (SELECT value->>'note' FROM venue_live_reports WHERE venue_id = target_venue_id AND type = 'cover_charge' AND created_at >= report_window ORDER BY created_at DESC LIMIT 1),
        ROUND(AVG((value #>> '{}')::numeric) FILTER (WHERE type = 'crowd_level'))::INTEGER,
        (SELECT value #>> '{}' FROM venue_live_reports WHERE venue_id = target_venue_id AND type = 'dress_code' AND created_at >= report_window ORDER BY created_at DESC LIMIT 1),
        (SELECT value #>> '{}' FROM venue_live_reports WHERE venue_id = target_venue_id AND type = 'music' AND created_at >= report_window ORDER BY created_at DESC LIMIT 1),
        (SELECT value FROM venue_live_reports WHERE venue_id = target_venue_id AND type = 'now_playing' AND created_at >= report_window ORDER BY created_at DESC LIMIT 1),
        jsonb_build_object(
            'waitTime', confidence_from_count(COUNT(*) FILTER (WHERE type = 'wait_time')::INTEGER),
            'coverCharge', confidence_from_count(COUNT(*) FILTER (WHERE type = 'cover_charge')::INTEGER),
            'musicGenre', confidence_from_count(COUNT(*) FILTER (WHERE type = 'music')::INTEGER),
            'crowdLevel', confidence_from_count(COUNT(*) FILTER (WHERE type = 'crowd_level')::INTEGER),
            'dressCode', confidence_from_count(COUNT(*) FILTER (WHERE type = 'dress_code')::INTEGER),
            'nowPlaying', confidence_from_count(COUNT(*) FILTER (WHERE type = 'now_playing')::INTEGER),
            'ageRange', confidence_from_count(COUNT(*) FILTER (WHERE type = 'age_range')::INTEGER)
        ),
        MAX(created_at),
        TIMEZONE('utc'::text, NOW())
    FROM venue_live_reports
    WHERE venue_id = target_venue_id
      AND created_at >= report_window
    ON CONFLICT (venue_id) DO UPDATE SET
        report_count = EXCLUDED.report_count,
        wait_time = EXCLUDED.wait_time,
        cover_charge = EXCLUDED.cover_charge,
        cover_charge_note = EXCLUDED.cover_charge_note,
        crowd_level = EXCLUDED.crowd_level,
        dress_code = EXCLUDED.dress_code,
        music_genre = EXCLUDED.music_genre,
        now_playing = EXCLUDED.now_playing,
        confidence = EXCLUDED.confidence,
        last_report_at = EXCLUDED.last_report_at,
        updated_at = EXCLUDED.updated_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION refresh_venue_live_aggregate_trigger()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM refresh_venue_live_aggregate(COALESCE(NEW.venue_id, OLD.venue_id));
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER venue_live_reports_refresh_aggregate
AFTER INSERT OR UPDATE OR DELETE ON venue_live_reports
FOR EACH ROW EXECUTE FUNCTION refresh_venue_live_aggregate_trigger();

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE venue_live_reports;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE venue_live_aggregates;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE pulse_reactions;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
END $$;
