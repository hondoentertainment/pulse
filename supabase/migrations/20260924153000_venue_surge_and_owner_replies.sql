-- Venue-surge push prefs + owner reply visibility.
-- Additive. Does not restore Signal. Does not touch spatial_ref_sys.
-- Apply on xeldqwhztcnnvazmshzh after merge. Until venue_surge_notices
-- exists, surge Web Push no-ops with reason rate_limit_unavailable.
-- Missing VAPID keys stay an honest no-op in the API (no secrets here).

-- ============================================================
-- 1. Mute per followed venue
-- ============================================================
ALTER TABLE public.follows
  ADD COLUMN IF NOT EXISTS surge_muted BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.follows.surge_muted IS
  'When true, this follower does not receive venue-surge Web Push for the followed venue.';

-- ============================================================
-- 2. Quiet hours on existing web push rows (Seattle local hours 0-23)
-- ============================================================
ALTER TABLE public.push_tokens
  ADD COLUMN IF NOT EXISTS quiet_hours_start SMALLINT;

ALTER TABLE public.push_tokens
  ADD COLUMN IF NOT EXISTS quiet_hours_end SMALLINT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'push_tokens_quiet_hours_start_check'
  ) THEN
    ALTER TABLE public.push_tokens
      ADD CONSTRAINT push_tokens_quiet_hours_start_check
      CHECK (quiet_hours_start IS NULL OR (quiet_hours_start >= 0 AND quiet_hours_start <= 23));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'push_tokens_quiet_hours_end_check'
  ) THEN
    ALTER TABLE public.push_tokens
      ADD CONSTRAINT push_tokens_quiet_hours_end_check
      CHECK (quiet_hours_end IS NULL OR (quiet_hours_end >= 0 AND quiet_hours_end <= 23));
  END IF;
END
$$;

COMMENT ON COLUMN public.push_tokens.quiet_hours_start IS
  'Seattle local hour (0-23) when surge push goes quiet. Null with quiet_hours_end means no quiet hours.';
COMMENT ON COLUMN public.push_tokens.quiet_hours_end IS
  'Seattle local hour (0-23) when surge push resumes. Window may wrap midnight.';

-- ============================================================
-- 3. One row per venue — surge notify rate limit (≤1 / 2h)
--    Service role writes. No client policies.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.venue_surge_notices (
  venue_id UUID PRIMARY KEY REFERENCES public.venues(id) ON DELETE CASCADE,
  notified_at TIMESTAMPTZ NOT NULL,
  pulse_id UUID
);

ALTER TABLE public.venue_surge_notices ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.venue_surge_notices IS
  'Last Electric surge Web Push per venue. Service role only. ≤1 notify / 2h.';

-- ============================================================
-- 4. Owner one-tap replies, visible on venue Live now
-- ============================================================
CREATE TABLE IF NOT EXISTS public.venue_owner_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pulse_id UUID NOT NULL REFERENCES public.pulses(id) ON DELETE CASCADE,
  venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_venue_owner_replies_venue
  ON public.venue_owner_replies (venue_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_venue_owner_replies_pulse
  ON public.venue_owner_replies (pulse_id, created_at)
  WHERE deleted_at IS NULL;

ALTER TABLE public.venue_owner_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "venue_owner_replies_select_alive" ON public.venue_owner_replies;
CREATE POLICY "venue_owner_replies_select_alive"
  ON public.venue_owner_replies FOR SELECT
  USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "venue_owner_replies_insert_operator" ON public.venue_owner_replies;
CREATE POLICY "venue_owner_replies_insert_operator"
  ON public.venue_owner_replies FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      EXISTS (
        SELECT 1 FROM public.venue_claims c
        WHERE c.venue_id = venue_owner_replies.venue_id
          AND c.user_id = auth.uid()
          AND c.status = 'verified'
      )
      OR EXISTS (
        SELECT 1 FROM public.venue_staff s
        WHERE s.venue_id = venue_owner_replies.venue_id
          AND s.user_id = auth.uid()
      )
    )
  );

GRANT SELECT ON public.venue_owner_replies TO anon, authenticated;
GRANT INSERT ON public.venue_owner_replies TO authenticated;

COMMENT ON TABLE public.venue_owner_replies IS
  'Verified owner or staff reply shown on venue Live now. Pending claims cannot insert.';
