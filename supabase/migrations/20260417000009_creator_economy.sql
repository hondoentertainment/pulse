-- Creator Economy: verified tiers, referral codes, revenue share, payouts
-- Quarter 3 roadmap. All state defaults off behind VITE_CREATOR_ECONOMY_ENABLED.

-- ----------------------------------------------------------------------------
-- creator_profiles
-- One row per user that has applied to (or been granted) creator status.
-- Payout account reuses the existing Stripe Connect infra via
-- venue_payout_accounts (shared table for both venues and creators).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS creator_profiles (
    user_id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
    handle TEXT UNIQUE NOT NULL,
    tier TEXT NOT NULL DEFAULT 'creator' CHECK (tier IN ('creator', 'verified', 'elite')),
    verified_at TIMESTAMP WITH TIME ZONE,
    bio TEXT,
    niche TEXT,
    follower_count_cache INTEGER DEFAULT 0,
    total_earnings_cents BIGINT DEFAULT 0,
    payout_account_id UUID, -- -> venue_payout_accounts.id (soft FK; reused Stripe Connect infra)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_creator_profiles_tier ON creator_profiles(tier);

-- ----------------------------------------------------------------------------
-- referral_codes
-- 6-8 char alphanumeric codes owned by a creator. Optionally scoped to a
-- venue (for venue-sponsored creators) and can carry a flat discount.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS referral_codes (
    code TEXT PRIMARY KEY,
    creator_user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
    venue_id UUID, -- nullable; when set, code only attributes for this venue
    discount_cents INTEGER, -- nullable; flat discount applied to the buyer
    valid_from TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    valid_to TIMESTAMP WITH TIME ZONE,
    max_uses INTEGER, -- nullable = unlimited
    uses_count INTEGER DEFAULT 0 NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT code_format CHECK (code ~ '^[A-Z0-9]{6,8}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_codes_code ON referral_codes(code);
CREATE INDEX IF NOT EXISTS idx_referral_codes_creator ON referral_codes(creator_user_id);
CREATE INDEX IF NOT EXISTS idx_referral_codes_venue ON referral_codes(venue_id);

-- ----------------------------------------------------------------------------
-- referral_attributions
-- Records one row per (user applied code) event. Starts as 'pending' (no
-- ticket yet). When a purchase happens within 30 days, it's linked and
-- the commission_cents is computed, status flips to 'held'. On payout run
-- it flips to 'paid'. Fraud cases flip to 'voided'.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS referral_attributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL REFERENCES referral_codes(code) ON DELETE RESTRICT,
    referred_user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
    attributed_ticket_id UUID, -- nullable until purchase happens
    attributed_reservation_id UUID, -- nullable until purchase happens
    commission_cents INTEGER DEFAULT 0 NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'held', 'paid', 'voided')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_referral_attributions_referred_user ON referral_attributions(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_referral_attributions_code ON referral_attributions(code);
CREATE INDEX IF NOT EXISTS idx_referral_attributions_status ON referral_attributions(status);
CREATE INDEX IF NOT EXISTS idx_referral_attributions_pending_window
    ON referral_attributions(referred_user_id, status, created_at);

-- ----------------------------------------------------------------------------
-- creator_payouts
-- Rolled-up settlement rows per creator per period.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS creator_payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    gross_cents INTEGER NOT NULL,
    platform_fee_cents INTEGER NOT NULL DEFAULT 0,
    tax_withheld_cents INTEGER NOT NULL DEFAULT 0,
    net_cents INTEGER NOT NULL,
    stripe_transfer_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'paid', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_creator_payouts_creator ON creator_payouts(creator_user_id);
CREATE INDEX IF NOT EXISTS idx_creator_payouts_status_period
    ON creator_payouts(status, period_end);

-- ----------------------------------------------------------------------------
-- creator_verification_requests
-- Queue for the admin to review applicants against submitted social links +
-- content samples before granting the 'verified' or 'elite' tier.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS creator_verification_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
    submitted_social_links JSONB NOT NULL DEFAULT '[]'::jsonb,
    submitted_content_samples JSONB NOT NULL DEFAULT '[]'::jsonb,
    review_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (review_status IN ('pending', 'approved', 'rejected')),
    reviewed_by_user_id UUID REFERENCES auth.users,
    review_note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_creator_verification_user ON creator_verification_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_creator_verification_status ON creator_verification_requests(review_status);

-- ----------------------------------------------------------------------------
-- Row Level Security
-- * Creators can read their own rows.
-- * Admins (JWT app_metadata.role = 'admin') can read/write everything.
-- * referral_attributions are NEVER writable from the client (service-role
--   only) to prevent self-attribution attacks.
-- ----------------------------------------------------------------------------
ALTER TABLE creator_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_attributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_verification_requests ENABLE ROW LEVEL SECURITY;

-- creator_profiles: self read + admin read-all.  Inserts only via admin/service.
CREATE POLICY "creator_profiles self read" ON creator_profiles
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "creator_profiles admin read" ON creator_profiles
    FOR SELECT USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
CREATE POLICY "creator_profiles self update" ON creator_profiles
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "creator_profiles admin write" ON creator_profiles
    FOR ALL USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- referral_codes: creators read their own + admin.  Create/deactivate via
-- edge function (service role) so we can rate limit + generate collision-safe.
CREATE POLICY "referral_codes self read" ON referral_codes
    FOR SELECT USING (auth.uid() = creator_user_id);
CREATE POLICY "referral_codes admin read" ON referral_codes
    FOR SELECT USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- referral_attributions: self read (as the referred user) + creator read
-- (via the code they own) + admin.  ZERO client writes.
CREATE POLICY "referral_attributions self read" ON referral_attributions
    FOR SELECT USING (auth.uid() = referred_user_id);
CREATE POLICY "referral_attributions creator read" ON referral_attributions
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM referral_codes rc
        WHERE rc.code = referral_attributions.code
          AND rc.creator_user_id = auth.uid()
    ));
CREATE POLICY "referral_attributions admin read" ON referral_attributions
    FOR SELECT USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
-- NOTE: no INSERT/UPDATE policy for non-service-role.  Service role bypasses RLS.

-- creator_payouts: self read + admin.  All writes via service role.
CREATE POLICY "creator_payouts self read" ON creator_payouts
    FOR SELECT USING (auth.uid() = creator_user_id);
CREATE POLICY "creator_payouts admin read" ON creator_payouts
    FOR SELECT USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- creator_verification_requests: self read/insert + admin.
CREATE POLICY "creator_verification self read" ON creator_verification_requests
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "creator_verification self insert" ON creator_verification_requests
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "creator_verification admin all" ON creator_verification_requests
    FOR ALL USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
