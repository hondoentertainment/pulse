-- Migration: Pulse Pro pilot waitlist
--
-- The Settings "Join the pilot list" CTA previously fired an analytics event
-- and a toast, capturing nothing — so willingness-to-pay could not be measured
-- and nobody could actually be contacted when the pilot opened. This table is
-- the durable capture behind that button.

CREATE TABLE IF NOT EXISTS signal_pilot_signups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- NULL when a signed-out/guest visitor signs up.
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    email TEXT NOT NULL CHECK (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
    -- Which CTA produced the signup, so multiple funnels can share the table.
    source TEXT NOT NULL DEFAULT 'pro_pilot',
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- One signup per address per funnel; re-submitting is an idempotent upsert.
    UNIQUE (email, source)
);

CREATE INDEX IF NOT EXISTS idx_signal_pilot_signups_created_at
    ON signal_pilot_signups(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_signal_pilot_signups_user_id
    ON signal_pilot_signups(user_id);

ALTER TABLE signal_pilot_signups ENABLE ROW LEVEL SECURITY;

-- A signed-in user may register interest for themselves; admins see everything.
CREATE POLICY "Users can add their own pilot signup."
    ON signal_pilot_signups FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own pilot signup."
    ON signal_pilot_signups FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id OR is_admin());

CREATE POLICY "Users can update their own pilot signup."
    ON signal_pilot_signups FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Waitlist rows are retained for follow-up; only admins may remove them.
CREATE POLICY "Admins can delete pilot signups."
    ON signal_pilot_signups FOR DELETE
    TO authenticated
    USING (is_admin());

REVOKE ALL ON signal_pilot_signups FROM anon;
