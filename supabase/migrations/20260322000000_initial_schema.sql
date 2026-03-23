-- Enable PostGIS for geospatial indexing
CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. PROFILES (extends auth.users)
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    profile_photo_url TEXT,
    friends UUID[] DEFAULT '{}',
    favorite_venues UUID[] DEFAULT '{}',
    followed_venues UUID[] DEFAULT '{}',
    favorite_categories TEXT[] DEFAULT '{}',
    credibility_score FLOAT DEFAULT 1.0,
    presence_settings JSONB DEFAULT '{"enabled": true, "visibility": "everyone", "hideAtSensitiveVenues": false}'::jsonb,
    venue_check_in_history JSONB DEFAULT '{}'::jsonb,
    post_streak INTEGER DEFAULT 0,
    last_post_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public profiles are viewable by everyone." ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile." ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile." ON profiles FOR UPDATE USING (auth.uid() = id);

-- 2. VENUES
CREATE TABLE venues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    location_lat FLOAT NOT NULL,
    location_lng FLOAT NOT NULL,
    location_address TEXT NOT NULL,
    geom GEOMETRY(Point, 4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(location_lng, location_lat), 4326)) STORED,
    city TEXT,
    state TEXT,
    category TEXT,
    pulse_score FLOAT DEFAULT 0,
    score_velocity FLOAT DEFAULT 0,
    last_pulse_at TIMESTAMP WITH TIME ZONE,
    pre_trending BOOLEAN DEFAULT false,
    pre_trending_label TEXT,
    seeded BOOLEAN DEFAULT false,
    verified_check_in_count INTEGER DEFAULT 0,
    first_real_check_in_at TIMESTAMP WITH TIME ZONE,
    hours JSONB,
    phone TEXT,
    website TEXT,
    integrations JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX idx_venues_geom ON venues USING GIST (geom);
CREATE INDEX idx_venues_pulse_score ON venues(pulse_score DESC);

ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Venues are viewable by everyone." ON venues FOR SELECT USING (true);
-- Insert/Update policies restricted to service role or admins for venues in production

-- 3. PULSES
CREATE TYPE energy_rating AS ENUM ('dead', 'chill', 'buzzing', 'electric');

CREATE TABLE pulses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    venue_id UUID REFERENCES venues(id) ON DELETE CASCADE,
    crew_id UUID,
    photos TEXT[] DEFAULT '{}',
    video_url TEXT,
    energy_rating energy_rating NOT NULL,
    caption TEXT,
    hashtags TEXT[] DEFAULT '{}',
    views INTEGER DEFAULT 0,
    is_pioneer BOOLEAN DEFAULT false,
    credibility_weight FLOAT DEFAULT 1.0,
    reactions JSONB DEFAULT '{"fire": [], "eyes": [], "skull": [], "lightning": []}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_pulses_venue_id ON pulses(venue_id);
CREATE INDEX idx_pulses_created_at ON pulses(created_at);
CREATE INDEX idx_pulses_expires_at ON pulses(expires_at);

ALTER TABLE pulses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Pulses are viewable by everyone." ON pulses FOR SELECT USING (true);
CREATE POLICY "Users can insert their own pulses." ON pulses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own pulses." ON pulses FOR UPDATE USING (auth.uid() = user_id);

-- 4. NOTIFICATIONS
CREATE TYPE notification_type AS ENUM ('friend_pulse', 'pulse_reaction', 'friend_nearby', 'trending_venue', 'impact', 'wave');

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    type notification_type NOT NULL,
    pulse_id UUID REFERENCES pulses(id) ON DELETE CASCADE,
    venue_id UUID REFERENCES venues(id) ON DELETE CASCADE,
    reaction_type TEXT,
    energy_threshold TEXT,
    recommended_venue_id UUID REFERENCES venues(id) ON DELETE CASCADE,
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own notifications." ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own notifications." ON notifications FOR UPDATE USING (auth.uid() = user_id);

-- 5. FUNCTION: calculate_distance
-- Utility for PostGIS distance calculation in miles
CREATE OR REPLACE FUNCTION calculate_distance(lat1 float, lon1 float, lat2 float, lon2 float)
RETURNS float AS $$
DECLARE
    point1 GEOMETRY = ST_SetSRID(ST_MakePoint(lon1, lat1), 4326)::geography;
    point2 GEOMETRY = ST_SetSRID(ST_MakePoint(lon2, lat2), 4326)::geography;
BEGIN
    -- ST_Distance returns meters, convert to miles
    RETURN ST_Distance(point1, point2) / 1609.344;
END;
$$ LANGUAGE plpgsql;
