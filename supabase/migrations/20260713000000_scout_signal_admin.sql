-- Scout program + admin signal suppression (PRD P0-11 / P1-1).

ALTER TABLE venues
  ADD COLUMN IF NOT EXISTS signal_suppressed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS signal_suppressed_reason TEXT,
  ADD COLUMN IF NOT EXISTS signal_suppressed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signal_suppressed_by UUID REFERENCES profiles(id);

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS scout_tier TEXT CHECK (scout_tier IS NULL OR scout_tier IN ('rookie', 'regular', 'lead')),
  ADD COLUMN IF NOT EXISTS scout_weekly_quota INTEGER,
  ADD COLUMN IF NOT EXISTS scout_approved_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS scout_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  tier TEXT NOT NULL DEFAULT 'rookie' CHECK (tier IN ('rookie', 'regular', 'lead')),
  motivation TEXT,
  neighborhoods TEXT[] DEFAULT '{}',
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_scout_applications_user_pending
  ON scout_applications (user_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_scout_applications_status
  ON scout_applications (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_venues_signal_suppressed
  ON venues (signal_suppressed)
  WHERE signal_suppressed = true AND deleted_at IS NULL;

DROP TRIGGER IF EXISTS scout_applications_set_updated_at ON scout_applications;
CREATE TRIGGER scout_applications_set_updated_at
  BEFORE UPDATE ON scout_applications
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE scout_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scout_applications_self_read" ON scout_applications;
CREATE POLICY "scout_applications_self_read"
  ON scout_applications FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "scout_applications_self_insert" ON scout_applications;
CREATE POLICY "scout_applications_self_insert"
  ON scout_applications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "scout_applications_admin_all" ON scout_applications;
CREATE POLICY "scout_applications_admin_all"
  ON scout_applications FOR ALL
  USING (coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin');

COMMENT ON COLUMN venues.signal_suppressed IS 'When true, venue is hidden from Tonight/map organic signal surfaces.';
COMMENT ON COLUMN profiles.scout_tier IS 'Approved scout tier; null means not a scout.';
COMMENT ON TABLE scout_applications IS 'User-submitted scout program applications awaiting admin review.';
