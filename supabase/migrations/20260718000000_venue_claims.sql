-- Durable venue ownership claims (replaces localStorage pilot).
-- Operators claim a venue; admins verify. Multi-device via Supabase.

CREATE TABLE IF NOT EXISTS venue_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id TEXT NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  claimant_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  business_email TEXT NOT NULL,
  verification_method TEXT NOT NULL DEFAULT 'email'
    CHECK (verification_method IN ('email', 'phone', 'document')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'verified', 'rejected')),
  rejected_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (venue_id, claimant_user_id)
);

CREATE INDEX IF NOT EXISTS idx_venue_claims_user ON venue_claims (claimant_user_id);
CREATE INDEX IF NOT EXISTS idx_venue_claims_venue ON venue_claims (venue_id);
CREATE INDEX IF NOT EXISTS idx_venue_claims_status ON venue_claims (status);

COMMENT ON TABLE venue_claims IS
  'Venue operator claim requests and verification state for the owner dashboard.';

ALTER TABLE venue_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own venue claims" ON venue_claims;
CREATE POLICY "Users read own venue claims"
  ON venue_claims FOR SELECT
  TO authenticated
  USING (auth.uid() = claimant_user_id);

DROP POLICY IF EXISTS "Users insert own venue claims" ON venue_claims;
CREATE POLICY "Users insert own venue claims"
  ON venue_claims FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = claimant_user_id);

DROP POLICY IF EXISTS "Users update own pending venue claims" ON venue_claims;
CREATE POLICY "Users update own pending venue claims"
  ON venue_claims FOR UPDATE
  TO authenticated
  USING (auth.uid() = claimant_user_id AND status = 'pending')
  WITH CHECK (auth.uid() = claimant_user_id);

-- Admins manage all claims (role in JWT app_metadata)
DROP POLICY IF EXISTS "Admins manage venue claims" ON venue_claims;
CREATE POLICY "Admins manage venue claims"
  ON venue_claims FOR ALL
  TO authenticated
  USING (
    coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin'
    OR coalesce((auth.jwt() ->> 'role'), '') = 'admin'
  )
  WITH CHECK (
    coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin'
    OR coalesce((auth.jwt() ->> 'role'), '') = 'admin'
  );
