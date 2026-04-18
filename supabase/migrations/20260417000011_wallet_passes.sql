-- 20260417000011_wallet_passes.sql
--
-- Wallet passes (Apple + Google) and Stripe dispute bookkeeping.
--
-- Adds:
--   * wallet_pass_artifacts     — generated .pkpass / saveUrl registry, 1:1 with ticket
--   * apple_pass_devices        — Apple's device push-registration webhook records
--   * ticket_disputes           — mirrors Stripe charge.dispute.* events
--
-- Also expands `tickets.status` to accept 'disputed' / 'expired' and adds
-- supporting timestamp columns referenced by the webhook + expire-pending
-- reconciler.

BEGIN;

-- ---------------------------------------------------------------------------
-- tickets: expand status enum + add reconciler timestamps
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tickets') THEN
    ALTER TABLE public.tickets
      ADD COLUMN IF NOT EXISTS expired_at          TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS disputed_at         TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

    -- Drop + recreate the CHECK constraint so 'disputed' and 'expired' are valid.
    -- We use DO block so repeated runs are idempotent.
    IF EXISTS (
      SELECT 1 FROM information_schema.constraint_column_usage
      WHERE table_name = 'tickets' AND constraint_name LIKE 'tickets_status%'
    ) THEN
      BEGIN
        ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_status_check;
      EXCEPTION WHEN OTHERS THEN
        -- ignore; might be named differently
        NULL;
      END;
    END IF;

    -- Re-apply a permissive constraint that covers the full lifecycle.
    ALTER TABLE public.tickets
      ADD CONSTRAINT tickets_status_check CHECK (
        status IN (
          'pending', 'paid', 'refunded', 'transferred',
          'cancelled', 'scanned', 'disputed', 'expired'
        )
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- wallet_pass_artifacts: one row per issued pass (Apple or Google)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.wallet_pass_artifacts (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id                 UUID NOT NULL UNIQUE REFERENCES public.tickets(id) ON DELETE CASCADE,
  platform                  TEXT NOT NULL CHECK (platform IN ('apple', 'google')),
  pass_url                  TEXT,
  serial_number             TEXT NOT NULL,
  updated_sequence_number   INTEGER NOT NULL DEFAULT 0,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_wallet_pass_artifacts_ticket ON public.wallet_pass_artifacts(ticket_id);
CREATE INDEX IF NOT EXISTS idx_wallet_pass_artifacts_serial ON public.wallet_pass_artifacts(serial_number);

ALTER TABLE public.wallet_pass_artifacts ENABLE ROW LEVEL SECURITY;

-- Owner-read: only the ticket owner can see their pass artefact row.
DROP POLICY IF EXISTS "wallet_pass_artifacts_owner_read" ON public.wallet_pass_artifacts;
CREATE POLICY "wallet_pass_artifacts_owner_read"
  ON public.wallet_pass_artifacts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = wallet_pass_artifacts.ticket_id
        AND t.user_id = auth.uid()
    )
  );

-- All writes go through service role from Edge Functions — no direct write policy.

-- ---------------------------------------------------------------------------
-- apple_pass_devices: device registrations for Apple Wallet push updates
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.apple_pass_devices (
  device_library_identifier TEXT NOT NULL,
  push_token                TEXT NOT NULL,
  serial_number             TEXT NOT NULL,
  pass_type_identifier      TEXT NOT NULL,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  PRIMARY KEY (device_library_identifier, pass_type_identifier, serial_number)
);

CREATE INDEX IF NOT EXISTS idx_apple_pass_devices_serial
  ON public.apple_pass_devices(pass_type_identifier, serial_number);

ALTER TABLE public.apple_pass_devices ENABLE ROW LEVEL SECURITY;
-- No policies: service-role only. Table is written by Apple's webhook, never
-- by the client. Clients only talk to Apple, not to us, for registration.

-- ---------------------------------------------------------------------------
-- ticket_disputes: mirror of Stripe charge.dispute.* events
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ticket_disputes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  charge_id        TEXT NOT NULL UNIQUE,
  ticket_id        UUID REFERENCES public.tickets(id) ON DELETE SET NULL,
  reason           TEXT,
  amount_cents     INTEGER NOT NULL DEFAULT 0,
  evidence_due_by  TIMESTAMPTZ,
  status           TEXT NOT NULL DEFAULT 'needs_response',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_ticket_disputes_ticket ON public.ticket_disputes(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_disputes_status ON public.ticket_disputes(status);

ALTER TABLE public.ticket_disputes ENABLE ROW LEVEL SECURITY;

-- Admin-read via JWT app_metadata.role = 'admin'. Writes are service-role only.
DROP POLICY IF EXISTS "ticket_disputes_admin_read" ON public.ticket_disputes;
CREATE POLICY "ticket_disputes_admin_read"
  ON public.ticket_disputes
  FOR SELECT
  TO authenticated
  USING (
    COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
  );

COMMIT;
