-- Fast venue analysis reads and server-side live intelligence aggregation.

CREATE INDEX IF NOT EXISTS idx_pulses_created_at_desc ON pulses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pulses_venue_created_at_desc ON pulses(venue_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_venues_pulse_score_desc ON venues(pulse_score DESC);

CREATE OR REPLACE FUNCTION energy_rating_score(rating energy_rating)
RETURNS INTEGER AS $$
BEGIN
    CASE rating
        WHEN 'dead' THEN RETURN 0;
        WHEN 'chill' THEN RETURN 25;
        WHEN 'buzzing' THEN RETURN 50;
        WHEN 'electric' THEN RETURN 100;
    END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION calculate_venue_pulse_score(target_venue_id UUID)
RETURNS INTEGER AS $$
DECLARE
    decay_minutes NUMERIC := 90;
    total_score NUMERIC := 0;
    valid_pulses INTEGER := 0;
    pulse_record RECORD;
    age_minutes NUMERIC;
    recency_factor NUMERIC;
    engagement_factor NUMERIC;
    credibility_weight NUMERIC;
    squad_multiplier NUMERIC;
BEGIN
    FOR pulse_record IN
        SELECT *
        FROM pulses
        WHERE venue_id = target_venue_id
          AND created_at >= TIMEZONE('utc'::text, NOW()) - (decay_minutes || ' minutes')::INTERVAL
    LOOP
        age_minutes := EXTRACT(EPOCH FROM (TIMEZONE('utc'::text, NOW()) - pulse_record.created_at)) / 60;
        recency_factor := GREATEST(0, 1 - age_minutes / decay_minutes);
        engagement_factor := 1 + (
            jsonb_array_length(COALESCE(pulse_record.reactions->'fire', '[]'::jsonb)) * 0.5 +
            jsonb_array_length(COALESCE(pulse_record.reactions->'lightning', '[]'::jsonb)) * 0.5 +
            jsonb_array_length(COALESCE(pulse_record.reactions->'eyes', '[]'::jsonb)) * 0.2 +
            pulse_record.views * 0.1
        ) / 100;
        credibility_weight := COALESCE(pulse_record.credibility_weight, 1.0);
        squad_multiplier := CASE WHEN pulse_record.crew_id IS NULL THEN 1.0 ELSE 1.5 END;

        total_score := total_score + energy_rating_score(pulse_record.energy_rating) * recency_factor * engagement_factor * credibility_weight * squad_multiplier * 0.25;
        valid_pulses := valid_pulses + 1;
    END LOOP;

    IF valid_pulses = 0 THEN
        RETURN 0;
    END IF;

    RETURN LEAST(100, ROUND(total_score + CASE WHEN valid_pulses > 5 THEN valid_pulses * 5 ELSE 0 END))::INTEGER;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION calculate_venue_score_velocity(target_venue_id UUID)
RETURNS INTEGER AS $$
DECLARE
    recent_score INTEGER;
    previous_score INTEGER;
BEGIN
    SELECT COALESCE(SUM(energy_rating_score(energy_rating)), 0)::INTEGER
    INTO recent_score
    FROM pulses
    WHERE venue_id = target_venue_id
      AND created_at > TIMEZONE('utc'::text, NOW()) - INTERVAL '15 minutes';

    SELECT COALESCE(SUM(energy_rating_score(energy_rating)), 0)::INTEGER
    INTO previous_score
    FROM pulses
    WHERE venue_id = target_venue_id
      AND created_at > TIMEZONE('utc'::text, NOW()) - INTERVAL '30 minutes'
      AND created_at <= TIMEZONE('utc'::text, NOW()) - INTERVAL '15 minutes';

    RETURN recent_score - previous_score;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION refresh_venue_intelligence(target_venue_id UUID)
RETURNS VOID AS $$
DECLARE
    next_score INTEGER;
    next_velocity INTEGER;
    latest_pulse_at TIMESTAMP WITH TIME ZONE;
    unique_check_ins INTEGER;
BEGIN
    next_score := calculate_venue_pulse_score(target_venue_id);
    next_velocity := calculate_venue_score_velocity(target_venue_id);

    SELECT MAX(created_at), COUNT(DISTINCT user_id)
    INTO latest_pulse_at, unique_check_ins
    FROM pulses
    WHERE venue_id = target_venue_id
      AND created_at >= TIMEZONE('utc'::text, NOW()) - INTERVAL '24 hours';

    UPDATE venues
    SET
        pulse_score = next_score,
        score_velocity = next_velocity,
        last_pulse_at = COALESCE(latest_pulse_at, last_pulse_at),
        verified_check_in_count = GREATEST(COALESCE(unique_check_ins, 0), COALESCE(verified_check_in_count, 0)),
        first_real_check_in_at = COALESCE(first_real_check_in_at, latest_pulse_at),
        pre_trending = CASE
            WHEN pre_trending = true AND COALESCE(unique_check_ins, 0) >= 3 THEN false
            ELSE pre_trending
        END
    WHERE id = target_venue_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION refresh_venue_intelligence_trigger()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM refresh_venue_intelligence(COALESCE(NEW.venue_id, OLD.venue_id));
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS pulses_refresh_venue_intelligence ON pulses;
CREATE TRIGGER pulses_refresh_venue_intelligence
AFTER INSERT OR UPDATE OR DELETE ON pulses
FOR EACH ROW EXECUTE FUNCTION refresh_venue_intelligence_trigger();

CREATE OR REPLACE FUNCTION get_live_venue_intelligence(max_pulses INTEGER DEFAULT 1000)
RETURNS TABLE (
    id UUID,
    name TEXT,
    location_lat FLOAT,
    location_lng FLOAT,
    location_address TEXT,
    city TEXT,
    state TEXT,
    category TEXT,
    pulse_score FLOAT,
    score_velocity FLOAT,
    last_pulse_at TIMESTAMP WITH TIME ZONE,
    pre_trending BOOLEAN,
    pre_trending_label TEXT,
    seeded BOOLEAN,
    verified_check_in_count INTEGER,
    first_real_check_in_at TIMESTAMP WITH TIME ZONE,
    hours JSONB,
    phone TEXT,
    website TEXT,
    integrations JSONB,
    live_summary JSONB,
    recent_pulse_count INTEGER,
    recent_unique_users INTEGER,
    latest_activity_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    WITH recent_pulses AS (
        SELECT *
        FROM pulses
        WHERE created_at >= TIMEZONE('utc'::text, NOW()) - INTERVAL '24 hours'
        ORDER BY created_at DESC
        LIMIT max_pulses
    ),
    pulse_rollup AS (
        SELECT
            venue_id,
            COUNT(*)::INTEGER AS recent_pulse_count,
            COUNT(DISTINCT user_id)::INTEGER AS recent_unique_users,
            MAX(created_at) AS latest_activity_at
        FROM recent_pulses
        GROUP BY venue_id
    )
    SELECT
        v.id,
        v.name,
        v.location_lat,
        v.location_lng,
        v.location_address,
        v.city,
        v.state,
        v.category,
        GREATEST(v.pulse_score, COALESCE(a.crowd_level, 0) * 0.3)::FLOAT AS pulse_score,
        v.score_velocity,
        v.last_pulse_at,
        v.pre_trending,
        v.pre_trending_label,
        v.seeded,
        v.verified_check_in_count,
        v.first_real_check_in_at,
        v.hours,
        v.phone,
        v.website,
        v.integrations,
        CASE WHEN a.venue_id IS NULL THEN NULL ELSE to_jsonb(a) END AS live_summary,
        COALESCE(pr.recent_pulse_count, 0),
        COALESCE(pr.recent_unique_users, 0),
        COALESCE(pr.latest_activity_at, v.last_pulse_at)
    FROM venues v
    LEFT JOIN venue_live_aggregates a ON a.venue_id = v.id
    LEFT JOIN pulse_rollup pr ON pr.venue_id = v.id
    ORDER BY GREATEST(v.pulse_score, COALESCE(a.crowd_level, 0) * 0.3) DESC, pr.latest_activity_at DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;
