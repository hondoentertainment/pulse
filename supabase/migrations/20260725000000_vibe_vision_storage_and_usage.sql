-- Vibe Vision: allow image MIME types on pulse-videos + usage/telemetry tables.

-- ============================================================
-- 1. Expand pulse-videos bucket MIME allowlist for photos
-- ============================================================
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif'
],
file_size_limit = 52428800
WHERE id = 'pulse-videos';

-- ============================================================
-- 2. Per-user daily cost / request rollup (UTC day)
-- ============================================================
CREATE TABLE IF NOT EXISTS vibe_assess_daily (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  total_cost_cents NUMERIC(12, 4) NOT NULL DEFAULT 0,
  blocked_count INTEGER NOT NULL DEFAULT 0,
  low_confidence_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day)
);

CREATE INDEX IF NOT EXISTS vibe_assess_daily_day_idx ON vibe_assess_daily (day DESC);

ALTER TABLE vibe_assess_daily ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vibe_assess_daily_owner_read" ON vibe_assess_daily;
CREATE POLICY "vibe_assess_daily_owner_read"
  ON vibe_assess_daily FOR SELECT
  USING (auth.uid() = user_id);

-- Writes go through service role / user client with upsert from Edge; allow owner upsert.
DROP POLICY IF EXISTS "vibe_assess_daily_owner_upsert" ON vibe_assess_daily;
CREATE POLICY "vibe_assess_daily_owner_upsert"
  ON vibe_assess_daily FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 3. Event log for admin telemetry / scout QA
-- ============================================================
CREATE TABLE IF NOT EXISTS vibe_assess_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  venue_id TEXT,
  energy_rating TEXT,
  confidence NUMERIC(5, 4),
  safe BOOLEAN NOT NULL DEFAULT true,
  blocked_reason TEXT,
  cost_cents NUMERIC(12, 4) NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'create_pulse',
  storage_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vibe_assess_events_created_idx
  ON vibe_assess_events (created_at DESC);

CREATE INDEX IF NOT EXISTS vibe_assess_events_source_idx
  ON vibe_assess_events (source, created_at DESC);

ALTER TABLE vibe_assess_events ENABLE ROW LEVEL SECURITY;

-- Users can insert their own events; admins read via service role.
DROP POLICY IF EXISTS "vibe_assess_events_owner_insert" ON vibe_assess_events;
CREATE POLICY "vibe_assess_events_owner_insert"
  ON vibe_assess_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "vibe_assess_events_owner_read" ON vibe_assess_events;
CREATE POLICY "vibe_assess_events_owner_read"
  ON vibe_assess_events FOR SELECT
  USING (auth.uid() = user_id);
