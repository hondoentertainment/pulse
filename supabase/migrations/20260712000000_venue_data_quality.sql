-- Venue data quality: structured fields, Places enrichment, user data-gap reports.
-- Extends venues with capacity_hint (already in admin API), neighborhood,
-- canonical category, price range, menu URL, and Google Place ID.

ALTER TABLE venues
  ADD COLUMN IF NOT EXISTS capacity_hint INTEGER,
  ADD COLUMN IF NOT EXISTS neighborhood TEXT,
  ADD COLUMN IF NOT EXISTS category_key TEXT,
  ADD COLUMN IF NOT EXISTS price_range SMALLINT,
  ADD COLUMN IF NOT EXISTS menu_url TEXT,
  ADD COLUMN IF NOT EXISTS place_id TEXT,
  ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS enrichment_source TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'venues_price_range_check'
  ) THEN
    ALTER TABLE venues
      ADD CONSTRAINT venues_price_range_check
      CHECK (price_range IS NULL OR (price_range >= 1 AND price_range <= 4));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'venues_capacity_hint_check'
  ) THEN
    ALTER TABLE venues
      ADD CONSTRAINT venues_capacity_hint_check
      CHECK (capacity_hint IS NULL OR capacity_hint >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'venues_category_key_check'
  ) THEN
    ALTER TABLE venues
      ADD CONSTRAINT venues_category_key_check
      CHECK (
        category_key IS NULL OR category_key IN (
          'bar', 'cocktail_bar', 'lounge', 'nightclub', 'music_venue',
          'brewery', 'wine_bar', 'restaurant', 'cafe', 'gallery', 'other'
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_venues_neighborhood ON venues (neighborhood) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_venues_category_key ON venues (category_key) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_venues_place_id ON venues (place_id) WHERE place_id IS NOT NULL;

-- Backfill category_key from free-text category where possible
UPDATE venues SET category_key = CASE
  WHEN lower(coalesce(category, '')) ~ 'nightclub|dance club' THEN 'nightclub'
  WHEN lower(coalesce(category, '')) ~ 'music|theatre|theater' THEN 'music_venue'
  WHEN lower(coalesce(category, '')) ~ 'cocktail' THEN 'cocktail_bar'
  WHEN lower(coalesce(category, '')) ~ 'wine' THEN 'wine_bar'
  WHEN lower(coalesce(category, '')) ~ 'lounge' THEN 'lounge'
  WHEN lower(coalesce(category, '')) ~ 'brewery|brewpub' THEN 'brewery'
  WHEN lower(coalesce(category, '')) ~ 'restaurant' THEN 'restaurant'
  WHEN lower(coalesce(category, '')) ~ 'café|cafe|coffee|bakery|brunch' THEN 'cafe'
  WHEN lower(coalesce(category, '')) ~ 'gallery' THEN 'gallery'
  WHEN lower(coalesce(category, '')) ~ 'bar|pub|tavern' THEN 'bar'
  ELSE category_key
END
WHERE category_key IS NULL AND category IS NOT NULL;

-- User catalog quality reports (hours wrong, menu missing, etc.)
CREATE TABLE IF NOT EXISTS venue_data_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN (
    'wrong_hours', 'wrong_address', 'wrong_phone', 'venue_closed',
    'missing_info', 'menu_missing', 'menu_outdated', 'pricing_outdated', 'other'
  )),
  note TEXT,
  menu_url TEXT,
  price_range SMALLINT CHECK (price_range IS NULL OR (price_range >= 1 AND price_range <= 4)),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'actioned', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID
);

CREATE INDEX IF NOT EXISTS idx_venue_data_reports_venue ON venue_data_reports (venue_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_venue_data_reports_status ON venue_data_reports (status, created_at DESC);

ALTER TABLE venue_data_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Venue data reports are viewable by admins." ON venue_data_reports;
CREATE POLICY "Venue data reports are viewable by reporters and admins."
  ON venue_data_reports FOR SELECT
  USING (
    auth.uid() = user_id
    OR coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin'
  );

DROP POLICY IF EXISTS "Users can insert venue data reports." ON venue_data_reports;
CREATE POLICY "Users can insert venue data reports."
  ON venue_data_reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can update venue data reports." ON venue_data_reports;
CREATE POLICY "Admins can update venue data reports."
  ON venue_data_reports FOR UPDATE
  USING (coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin');

-- Refresh live venue intelligence RPC to include structured metadata
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
    category_key TEXT,
    neighborhood TEXT,
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
    menu_url TEXT,
    integrations JSONB,
    dress_code TEXT,
    cover_charge_cents INTEGER,
    cover_charge_note TEXT,
    accessibility_features TEXT[],
    indoor_outdoor TEXT,
    capacity_hint INTEGER,
    price_range SMALLINT,
    place_id TEXT,
    enriched_at TIMESTAMPTZ,
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
        v.category_key,
        v.neighborhood,
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
        v.menu_url,
        v.integrations,
        v.dress_code,
        v.cover_charge_cents,
        v.cover_charge_note,
        v.accessibility_features,
        v.indoor_outdoor,
        v.capacity_hint,
        v.price_range,
        v.place_id,
        v.enriched_at,
        CASE WHEN a.venue_id IS NULL THEN NULL ELSE to_jsonb(a) END AS live_summary,
        COALESCE(pr.recent_pulse_count, 0),
        COALESCE(pr.recent_unique_users, 0),
        COALESCE(pr.latest_activity_at, v.last_pulse_at)
    FROM venues v
    LEFT JOIN venue_live_aggregates a ON a.venue_id = v.id
    LEFT JOIN pulse_rollup pr ON pr.venue_id = v.id
    WHERE v.deleted_at IS NULL
    ORDER BY GREATEST(v.pulse_score, COALESCE(a.crowd_level, 0) * 0.3) DESC, pr.latest_activity_at DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;
