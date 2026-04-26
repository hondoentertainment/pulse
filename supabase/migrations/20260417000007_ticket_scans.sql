-- 20260417000007_ticket_scans.sql
--
-- Adds door-scan columns to `tickets`, creates `venue_staff` membership table,
-- and wires RLS so only venue staff can read tickets at their venues and mark
-- them scanned.
--
-- Notes
-- -----
-- * The `tickets` table is expected to have been created by a prior migration
--   (`tickets` is referenced by app code). If it doesn't exist yet, wrap the
--   ALTER blocks in `IF EXISTS` so this migration is idempotent.
-- * Role gating is "claim OR table": we also allow JWT `app_metadata.role =
--   'venue_staff'` as a superuser-of-scan shortcut, checked in the API layer.
-- * If your tickets table uses a different status enum, the `scanned` value
--   may need to be added separately.

-- ---------------------------------------------------------------------------
-- 1. tickets.scanned_* columns
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'tickets'
  ) THEN
    ALTER TABLE public.tickets
      ADD COLUMN IF NOT EXISTS scanned_at        TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS scanned_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS scanned_venue_id  UUID REFERENCES public.venues(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS payment_intent_id TEXT;
    CREATE INDEX IF NOT EXISTS idx_tickets_venue_status
      ON public.tickets(venue_id, status);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. venue_staff table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.venue_staff (
  venue_id  UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role      TEXT NOT NULL CHECK (role IN ('admin', 'door', 'manager')),
  added_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  added_at  TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  PRIMARY KEY (venue_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_venue_staff_user ON public.venue_staff(user_id);

ALTER TABLE public.venue_staff ENABLE ROW LEVEL SECURITY;

-- Staff members can read their own rows plus all rows for venues they staff.
DROP POLICY IF EXISTS "venue_staff_read_own_or_venue" ON public.venue_staff;
CREATE POLICY "venue_staff_read_own_or_venue" ON public.venue_staff
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.venue_staff s
      WHERE s.venue_id = venue_staff.venue_id
        AND s.user_id = auth.uid()
    )
  );

-- Only admins at the venue can insert/update/delete.
DROP POLICY IF EXISTS "venue_staff_admin_write" ON public.venue_staff;
CREATE POLICY "venue_staff_admin_write" ON public.venue_staff
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.venue_staff s
      WHERE s.venue_id = venue_staff.venue_id
        AND s.user_id = auth.uid()
        AND s.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.venue_staff s
      WHERE s.venue_id = venue_staff.venue_id
        AND s.user_id = auth.uid()
        AND s.role = 'admin'
    )
  );

-- ---------------------------------------------------------------------------
-- 3. tickets RLS: staff can read tickets at their venues.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'tickets'
  ) THEN
    EXECUTE 'ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS "tickets_read_owner_or_staff" ON public.tickets';
    EXECUTE $POLICY$
      CREATE POLICY "tickets_read_owner_or_staff" ON public.tickets
        FOR SELECT
        USING (
          user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.venue_staff s
            WHERE s.venue_id = tickets.venue_id
              AND s.user_id = auth.uid()
          )
        )
    $POLICY$;

    -- Scan writes are gated by staff membership OR the `venue_staff` JWT claim.
    EXECUTE 'DROP POLICY IF EXISTS "tickets_scan_update_staff" ON public.tickets';
    EXECUTE $POLICY$
      CREATE POLICY "tickets_scan_update_staff" ON public.tickets
        FOR UPDATE
        USING (
          EXISTS (
            SELECT 1 FROM public.venue_staff s
            WHERE s.venue_id = tickets.venue_id
              AND s.user_id = auth.uid()
          )
          OR COALESCE(auth.jwt()->'app_metadata'->>'role', '') = 'venue_staff'
        )
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.venue_staff s
            WHERE s.venue_id = tickets.venue_id
              AND s.user_id = auth.uid()
          )
          OR COALESCE(auth.jwt()->'app_metadata'->>'role', '') = 'venue_staff'
        )
    $POLICY$;
  END IF;
END $$;
