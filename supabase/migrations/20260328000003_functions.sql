-- ============================================================
-- Migration: PostgreSQL Functions
-- Created: 2026-03-28
-- ============================================================

-- ----------------------------------------------------------------
-- 1. recalculate_venue_score(venue_uuid UUID)
--
--    Computes a weighted, time-decayed pulse score for a venue:
--
--      base_score = energy_value * credibility_weight
--      decay      = e^(-age_hours / 1.5)   (half-life ≈ 1 h)
--      contribution = base_score * decay
--      venue.pulse_score = SUM(contribution) across active pulses
--
--    Energy enum → numeric mapping:
--      dead      → 1
--      chill     → 2
--      buzzing   → 3
--      electric  → 4
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION recalculate_venue_score(venue_uuid UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_score        FLOAT := 0;
    v_prev_score   FLOAT;
    v_velocity     FLOAT;
    v_pulse_count  INTEGER;
BEGIN
    -- Capture previous score for velocity calculation.
    SELECT pulse_score INTO v_prev_score
    FROM venues WHERE id = venue_uuid;

    -- Weighted, time-decayed score over active pulses.
    SELECT
        COALESCE(
            SUM(
                CASE p.energy_rating
                    WHEN 'dead'     THEN 1.0
                    WHEN 'chill'    THEN 2.0
                    WHEN 'buzzing'  THEN 3.0
                    WHEN 'electric' THEN 4.0
                    ELSE 1.0
                END
                * p.credibility_weight
                * EXP(
                    -1.0 * EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 3600.0
                    / 1.5
                  )
            ),
            0
        ),
        COUNT(*)
    INTO v_score, v_pulse_count
    FROM pulses p
    WHERE p.venue_id  = venue_uuid
      AND p.expires_at > NOW();

    -- Score velocity = delta over the previous value (bounded to [-10, 10]).
    v_velocity := GREATEST(-10, LEAST(10, v_score - COALESCE(v_prev_score, 0)));

    UPDATE venues
    SET
        pulse_score    = v_score,
        score_velocity = v_velocity,
        last_pulse_at  = CASE WHEN v_pulse_count > 0 THEN NOW() ELSE last_pulse_at END
    WHERE id = venue_uuid;
END;
$$;

-- ----------------------------------------------------------------
-- 2. cleanup_expired_content()
--
--    Deletes:
--      • Pulses older than 90 minutes (expires_at < NOW())
--      • Stories older than 24 hours (expires_at < NOW())
--
--    Intended to be called by pg_cron every 5–15 minutes:
--      SELECT cron.schedule('cleanup-expired', '*/10 * * * *',
--             'SELECT cleanup_expired_content()');
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION cleanup_expired_content()
RETURNS TABLE(pulses_deleted INTEGER, stories_deleted INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_pulses_deleted  INTEGER;
    v_stories_deleted INTEGER;
BEGIN
    -- Delete expired pulses.
    WITH deleted AS (
        DELETE FROM pulses
        WHERE expires_at < NOW()
        RETURNING venue_id
    )
    SELECT COUNT(*) INTO v_pulses_deleted FROM deleted;

    -- Delete expired stories.
    WITH deleted AS (
        DELETE FROM stories
        WHERE expires_at < NOW()
        RETURNING id
    )
    SELECT COUNT(*) INTO v_stories_deleted FROM deleted;

    RETURN QUERY SELECT v_pulses_deleted, v_stories_deleted;
END;
$$;

-- ----------------------------------------------------------------
-- 3. get_nearby_venues(lat, lng, radius_miles, lim)
--
--    Returns venues within radius_miles of the supplied coordinates,
--    ordered by distance ascending, with pulse_score as secondary sort.
--    Requires PostGIS (enabled in initial migration).
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_nearby_venues(
    lat          FLOAT,
    lng          FLOAT,
    radius_miles FLOAT   DEFAULT 5,
    lim          INTEGER DEFAULT 50
)
RETURNS TABLE(
    id               UUID,
    name             TEXT,
    location_lat     FLOAT,
    location_lng     FLOAT,
    location_address TEXT,
    city             TEXT,
    state            TEXT,
    category         TEXT,
    pulse_score      FLOAT,
    score_velocity   FLOAT,
    last_pulse_at    TIMESTAMPTZ,
    pre_trending     BOOLEAN,
    distance_miles   FLOAT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    WITH origin AS (
        SELECT ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography AS pt
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
        v.pulse_score,
        v.score_velocity,
        v.last_pulse_at,
        v.pre_trending,
        (ST_Distance(v.geom::geography, o.pt) / 1609.344)::FLOAT AS distance_miles
    FROM venues v, origin o
    WHERE ST_DWithin(v.geom::geography, o.pt, radius_miles * 1609.344)
    ORDER BY
        ST_Distance(v.geom::geography, o.pt) ASC,
        v.pulse_score DESC
    LIMIT lim;
$$;

-- ----------------------------------------------------------------
-- 4. get_trending_venues(city_filter, lim)
--
--    Returns the top venues by score_velocity (momentum) over the
--    last hour, optionally filtered to a specific city.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_trending_venues(
    city_filter TEXT    DEFAULT NULL,
    lim         INTEGER DEFAULT 20
)
RETURNS TABLE(
    id             UUID,
    name           TEXT,
    city           TEXT,
    state          TEXT,
    category       TEXT,
    pulse_score    FLOAT,
    score_velocity FLOAT,
    last_pulse_at  TIMESTAMPTZ,
    pre_trending   BOOLEAN,
    recent_pulses  BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        v.id,
        v.name,
        v.city,
        v.state,
        v.category,
        v.pulse_score,
        v.score_velocity,
        v.last_pulse_at,
        v.pre_trending,
        COUNT(p.id) AS recent_pulses
    FROM venues v
    LEFT JOIN pulses p
        ON p.venue_id   = v.id
        AND p.created_at >= NOW() - INTERVAL '1 hour'
        AND p.expires_at  > NOW()
    WHERE
        v.last_pulse_at >= NOW() - INTERVAL '1 hour'
        AND (city_filter IS NULL OR v.city ILIKE city_filter)
    GROUP BY v.id
    ORDER BY v.score_velocity DESC, COUNT(p.id) DESC
    LIMIT lim;
$$;

-- ----------------------------------------------------------------
-- 5. increment_venue_score_on_pulse()
--
--    Trigger function: called after a pulse is inserted.
--    Delegates to recalculate_venue_score for the affected venue.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION increment_venue_score_on_pulse()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    PERFORM recalculate_venue_score(NEW.venue_id);
    RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------
-- 6. update_pulse_reaction_counts()
--
--    Trigger function: syncs the JSONB reactions blob on pulses
--    whenever a row is inserted into or deleted from reactions.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_pulse_reaction_counts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_pulse_id UUID;
    v_counts   JSONB;
BEGIN
    -- Determine which pulse was affected.
    v_pulse_id := COALESCE(NEW.pulse_id, OLD.pulse_id);

    -- Rebuild the counts object from the reactions table.
    SELECT jsonb_object_agg(reaction_type, cnt)
    INTO v_counts
    FROM (
        SELECT reaction_type, COUNT(*) AS cnt
        FROM reactions
        WHERE pulse_id = v_pulse_id
        GROUP BY reaction_type
    ) sub;

    -- Merge with the default keys so the client always gets all fields.
    UPDATE pulses
    SET reactions = (
        '{"fire": 0, "eyes": 0, "skull": 0, "lightning": 0, "heart": 0}'::jsonb
        || COALESCE(v_counts, '{}'::jsonb)
    )
    WHERE id = v_pulse_id;

    RETURN COALESCE(NEW, OLD);
END;
$$;

-- ----------------------------------------------------------------
-- 7. increment_venue_check_in_count()
--
--    Trigger function: increments venues.verified_check_in_count
--    when a verified check-in is inserted.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION increment_venue_check_in_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.verified = true THEN
        UPDATE venues
        SET
            verified_check_in_count = verified_check_in_count + 1,
            first_real_check_in_at  = COALESCE(first_real_check_in_at, NOW())
        WHERE id = NEW.venue_id;
    END IF;
    RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------
-- 8. set_updated_at()
--
--    Generic trigger function that keeps `updated_at` current.
--    Attach to any table that has an updated_at TIMESTAMPTZ column.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;
