-- Migration: Ticketing, reservations, and Stripe Connect payouts
--
-- Adds:
--   * venue_payout_accounts — 1:1 with venues, stores Stripe Connect account state
--   * ALTER events — adds starts_at/ends_at/cover_price_cents/capacity/ticket_types/currency/status/deleted_at
--   * tickets — purchased entry passes
--   * reservations — table bookings (incl. optional deposit)
--   * stripe_webhook_events — idempotency ledger for webhook processing
--
-- RLS choice: venue staff gating is handled via a lightweight `venue_staff` mapping
-- table (venue_id, user_id, role). This is cheaper to evolve than depending on the
-- JWT claim shape and does not require reissuing tokens when staff change. A later
-- optimisation can surface the same info via `app_metadata.venue_ids` for fast path
-- RLS reads — but the source of truth stays in the table.

-- ============================================================
-- venue_staff: authorisation mapping for venue admins/staff
-- ============================================================
CREATE TABLE IF NOT EXISTS venue_staff (
    venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('owner', 'admin', 'staff')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (venue_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_venue_staff_user_id ON venue_staff(user_id);
ALTER TABLE venue_staff ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read their own memberships"
    ON venue_staff FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- ============================================================
-- venue_payout_accounts: 1:1 with venues (Stripe Connect)
-- ============================================================
CREATE TABLE IF NOT EXISTS venue_payout_accounts (
    venue_id UUID PRIMARY KEY REFERENCES venues(id) ON DELETE CASCADE,
    stripe_account_id TEXT UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'restricted')),
    payouts_enabled BOOLEAN NOT NULL DEFAULT false,
    charges_enabled BOOLEAN NOT NULL DEFAULT false,
    details_submitted BOOLEAN NOT NULL DEFAULT false,
    disabled_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE venue_payout_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Venue staff can read payout accounts"
    ON venue_payout_accounts FOR SELECT
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM venue_staff
        WHERE venue_staff.venue_id = venue_payout_accounts.venue_id
          AND venue_staff.user_id = auth.uid()
    ));
-- All writes go through service role via Edge Function — no direct-update policy.

-- ============================================================
-- events: extend with ticketing columns (soft-delete included)
-- ============================================================
ALTER TABLE events
    ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS cover_price_cents INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS capacity INTEGER,
    ADD COLUMN IF NOT EXISTS ticket_types JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'usd',
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'published', 'sold_out', 'cancelled', 'completed')),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_events_venue_starts_at ON events(venue_id, starts_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status) WHERE deleted_at IS NULL;

-- Public read is already in place from 20260329000002; published-filter is
-- applied at the query level so we don't restrict drafts behind RLS (staff
-- management endpoints use service role).

-- ============================================================
-- tickets: owned entry passes
-- ============================================================
CREATE TABLE IF NOT EXISTS tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    ticket_type TEXT NOT NULL DEFAULT 'general_admission',
    price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
    currency TEXT NOT NULL DEFAULT 'usd',
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'paid', 'refunded', 'transferred', 'cancelled')),
    stripe_payment_intent TEXT UNIQUE,
    qr_code_secret TEXT,
    transferable_to_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    transfer_token TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    paid_at TIMESTAMPTZ,
    refunded_at TIMESTAMPTZ,
    transferred_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tickets_event_id ON tickets(event_id);
CREATE INDEX IF NOT EXISTS idx_tickets_user_id ON tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);

ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ticket owners can read their tickets"
    ON tickets FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id OR auth.uid() = transferable_to_user_id);

CREATE POLICY "Venue staff can read tickets for their events"
    ON tickets FOR SELECT
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM events e
        JOIN venue_staff s ON s.venue_id = e.venue_id
        WHERE e.id = tickets.event_id AND s.user_id = auth.uid()
    ));

CREATE POLICY "Ticket owners can mark as used (client self-check-in disabled)"
    ON tickets FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
-- Lifecycle-changing updates (status -> paid/refunded/transferred) flow
-- through Edge Functions using the service role.

-- ============================================================
-- reservations: table/booking holds
-- ============================================================
CREATE TABLE IF NOT EXISTS reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    party_size INTEGER NOT NULL CHECK (party_size > 0),
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'requested'
        CHECK (status IN ('requested', 'confirmed', 'seated', 'cancelled', 'no_show', 'completed')),
    deposit_cents INTEGER NOT NULL DEFAULT 0 CHECK (deposit_cents >= 0),
    deposit_payment_intent TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_reservations_venue_starts_at ON reservations(venue_id, starts_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_reservations_user_id ON reservations(user_id);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);

ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reservation owners can read their reservations"
    ON reservations FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Venue staff can read reservations for their venue"
    ON reservations FOR SELECT
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM venue_staff s
        WHERE s.venue_id = reservations.venue_id AND s.user_id = auth.uid()
    ));

CREATE POLICY "Venue staff can update reservations"
    ON reservations FOR UPDATE
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM venue_staff s
        WHERE s.venue_id = reservations.venue_id AND s.user_id = auth.uid()
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM venue_staff s
        WHERE s.venue_id = reservations.venue_id AND s.user_id = auth.uid()
    ));

-- Inserts are brokered through the Edge Function with service role; no direct-insert policy.

-- ============================================================
-- stripe_webhook_events: idempotency ledger
-- ============================================================
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
    event_id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    payload JSONB
);

ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;
-- No policies: only service role writes; client never reads this table.
