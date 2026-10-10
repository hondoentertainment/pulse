-- Heading there, launch-city quiet push, and admin hide notes.
-- Additive. Does not update or delete existing rows.
-- Apply on xeldqwhztcnnvazmshzh after merge.
-- Verify with supabase/verify/heading_hop_quiet_hide.sql.

-- ============================================================
-- 1. Who is heading to a room (hop link banner)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.venue_headings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  venue_id TEXT NOT NULL CHECK (char_length(venue_id) BETWEEN 1 AND 128),
  display_name TEXT NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 40),
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  cancelled_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_venue_headings_active_venue
  ON public.venue_headings (venue_id, created_at DESC)
  WHERE cancelled_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_venue_headings_one_active
  ON public.venue_headings (user_id, venue_id)
  WHERE cancelled_at IS NULL;

ALTER TABLE public.venue_headings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "venue_headings_select_active" ON public.venue_headings;
CREATE POLICY "venue_headings_select_active"
  ON public.venue_headings FOR SELECT
  USING (cancelled_at IS NULL OR auth.uid() = user_id OR is_admin());

DROP POLICY IF EXISTS "venue_headings_insert_self" ON public.venue_headings;
CREATE POLICY "venue_headings_insert_self"
  ON public.venue_headings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "venue_headings_update_self" ON public.venue_headings;
CREATE POLICY "venue_headings_update_self"
  ON public.venue_headings FOR UPDATE
  USING (auth.uid() = user_id OR is_admin())
  WITH CHECK (auth.uid() = user_id OR is_admin());

GRANT SELECT ON public.venue_headings TO anon, authenticated;
GRANT INSERT, UPDATE ON public.venue_headings TO authenticated;

COMMENT ON TABLE public.venue_headings IS
  'Signed-in user marked heading to a room. Hop links (?hop=1) read the latest active row. Guests can read; writes are self-only.';

-- ============================================================
-- 2. One quiet-night push per launched city per local night
-- ============================================================
CREATE TABLE IF NOT EXISTS public.launch_quiet_notices (
  city_key TEXT PRIMARY KEY CHECK (city_key IN ('portland', 'san-francisco')),
  notified_at TIMESTAMPTZ NOT NULL,
  venue_id TEXT
);

ALTER TABLE public.launch_quiet_notices ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.launch_quiet_notices IS
  'Last quiet-night Web Push per launched non-default city. Service role only. One local night.';

CREATE TABLE IF NOT EXISTS public.launch_quiet_mutes (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  city_key TEXT NOT NULL CHECK (city_key IN ('portland', 'san-francisco')),
  muted_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  PRIMARY KEY (user_id, city_key)
);

ALTER TABLE public.launch_quiet_mutes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "launch_quiet_mutes_select_self" ON public.launch_quiet_mutes;
CREATE POLICY "launch_quiet_mutes_select_self"
  ON public.launch_quiet_mutes FOR SELECT
  USING (auth.uid() = user_id OR is_admin());

DROP POLICY IF EXISTS "launch_quiet_mutes_insert_self" ON public.launch_quiet_mutes;
CREATE POLICY "launch_quiet_mutes_insert_self"
  ON public.launch_quiet_mutes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "launch_quiet_mutes_delete_self" ON public.launch_quiet_mutes;
CREATE POLICY "launch_quiet_mutes_delete_self"
  ON public.launch_quiet_mutes FOR DELETE
  USING (auth.uid() = user_id OR is_admin());

GRANT SELECT, INSERT, DELETE ON public.launch_quiet_mutes TO authenticated;

COMMENT ON TABLE public.launch_quiet_mutes IS
  'Follower muted quiet-night prompts for a launched city. Checked with push quiet hours.';

-- ============================================================
-- 3. Admin hide + owner-visible resolution note
-- ============================================================
ALTER TABLE public.pulses
  ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ;

ALTER TABLE public.pulses
  ADD COLUMN IF NOT EXISTS hidden_note TEXT;

ALTER TABLE public.pulses
  ADD COLUMN IF NOT EXISTS hidden_by UUID REFERENCES public.profiles(id);

COMMENT ON COLUMN public.pulses.hidden_note IS
  'Resolution note shown to the post owner when an admin hides the pulse.';

CREATE OR REPLACE FUNCTION public.pulses_preserve_hide_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;
  IF is_admin() OR coalesce(auth.role(), '') = 'service_role' THEN
    RETURN NEW;
  END IF;
  NEW.hidden_at := OLD.hidden_at;
  NEW.hidden_note := OLD.hidden_note;
  NEW.hidden_by := OLD.hidden_by;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pulses_preserve_hide_columns ON public.pulses;
CREATE TRIGGER pulses_preserve_hide_columns
  BEFORE UPDATE ON public.pulses
  FOR EACH ROW
  EXECUTE FUNCTION public.pulses_preserve_hide_columns();

-- Replace the public select policy. Extra permissive policies are OR'd,
-- so leaving pulses_select_public as-is would still show hidden rows.
DROP POLICY IF EXISTS "Pulses are viewable by everyone." ON public.pulses;
DROP POLICY IF EXISTS "pulses_select_visible" ON public.pulses;
DROP POLICY IF EXISTS "pulses_select_public" ON public.pulses;
CREATE POLICY "pulses_select_public"
  ON public.pulses FOR SELECT
  USING (
    is_admin()
    OR (
      deleted_at IS NULL
      AND (hidden_at IS NULL OR auth.uid() = user_id)
    )
  );

-- Owner updates already exist (pulses_update_self). The trigger above
-- is what stops a non-admin from clearing hidden_at.
