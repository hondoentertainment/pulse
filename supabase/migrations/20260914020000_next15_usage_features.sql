-- Next-15 usage features (additive only).
-- Replies, Same, blocks, crew tonight, door pin.
-- Optional venues.image_url — never invent or scrape photos.
-- Reuses follows, presence, notifications, pulse_reports, pulses, events, venue_claims.
-- Do NOT apply from this agent. Include in the PR for xeldqwhztcnnvazmshzh.

-- ============================================================
-- 1. Optional catalog photo on venues (show only if a URL already exists)
-- ============================================================
ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS image_url TEXT;

COMMENT ON COLUMN public.venues.image_url IS
  'Catalog photo URL already on the venue row. Never scraped or invented.';

-- ============================================================
-- 2. Pulse thread — one-tap replies stay on the venue
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pulse_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pulse_id UUID NOT NULL REFERENCES public.pulses(id) ON DELETE CASCADE,
    venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    body TEXT NOT NULL DEFAULT 'Here too',
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pulse_replies_pulse
  ON public.pulse_replies (pulse_id, created_at)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pulse_replies_venue
  ON public.pulse_replies (venue_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pulse_replies_user
  ON public.pulse_replies (user_id, created_at DESC)
  WHERE deleted_at IS NULL;

ALTER TABLE public.pulse_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pulse_replies_select_alive" ON public.pulse_replies;
CREATE POLICY "pulse_replies_select_alive"
  ON public.pulse_replies FOR SELECT
  USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "pulse_replies_insert_own" ON public.pulse_replies;
CREATE POLICY "pulse_replies_insert_own"
  ON public.pulse_replies FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "pulse_replies_update_own" ON public.pulse_replies;
CREATE POLICY "pulse_replies_update_own"
  ON public.pulse_replies FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT ON public.pulse_replies TO anon, authenticated;
GRANT INSERT, UPDATE ON public.pulse_replies TO authenticated;

-- Rate-limit replies the same way as pulses (5 / 10 min user, 1 / 2 min venue).
CREATE OR REPLACE FUNCTION public.pulse_reply_rate_limit_violation(
    p_user_id UUID,
    p_venue_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_count INTEGER;
    venue_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO user_count
    FROM public.pulse_replies
    WHERE user_id = p_user_id
      AND deleted_at IS NULL
      AND created_at > (NOW() - INTERVAL '10 minutes');
    IF user_count >= 5 THEN
        RETURN 'Too many pulses — max 5 every 10 minutes';
    END IF;

    SELECT COUNT(*) INTO venue_count
    FROM public.pulse_replies
    WHERE user_id = p_user_id
      AND venue_id = p_venue_id
      AND deleted_at IS NULL
      AND created_at > (NOW() - INTERVAL '2 minutes');
    IF venue_count >= 1 THEN
        RETURN 'Wait 2 minutes before another pulse at this venue';
    END IF;

    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.assert_pulse_reply_rate_limit(
    p_user_id UUID,
    p_venue_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    violation TEXT;
BEGIN
    IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
        RAISE EXCEPTION 'Sign in required to reply'
            USING ERRCODE = '42501';
    END IF;
    violation := public.pulse_reply_rate_limit_violation(p_user_id, p_venue_id);
    IF violation IS NOT NULL THEN
        RAISE EXCEPTION '%', violation
            USING ERRCODE = 'P0001';
    END IF;
    RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_pulse_reply_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    violation TEXT;
BEGIN
    violation := public.pulse_reply_rate_limit_violation(NEW.user_id, NEW.venue_id);
    IF violation IS NOT NULL THEN
        RAISE EXCEPTION '%', violation
            USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pulse_replies_enforce_rate_limit ON public.pulse_replies;
CREATE TRIGGER pulse_replies_enforce_rate_limit
    BEFORE INSERT ON public.pulse_replies
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_pulse_reply_rate_limit();

REVOKE ALL ON FUNCTION public.pulse_reply_rate_limit_violation(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assert_pulse_reply_rate_limit(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assert_pulse_reply_rate_limit(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pulse_reply_rate_limit_violation(UUID, UUID) TO authenticated;

COMMENT ON TABLE public.pulse_replies IS
  'One-tap replies under a pulse. Stay on the venue. Rate-limited like pulses.';

-- ============================================================
-- 3. Same — one agree row per user per pulse. Count only.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pulse_agrees (
    pulse_id UUID NOT NULL REFERENCES public.pulses(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
    PRIMARY KEY (pulse_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_pulse_agrees_pulse
  ON public.pulse_agrees (pulse_id);

ALTER TABLE public.pulse_agrees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pulse_agrees_select" ON public.pulse_agrees;
CREATE POLICY "pulse_agrees_select"
  ON public.pulse_agrees FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "pulse_agrees_insert_own" ON public.pulse_agrees;
CREATE POLICY "pulse_agrees_insert_own"
  ON public.pulse_agrees FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "pulse_agrees_delete_own" ON public.pulse_agrees;
CREATE POLICY "pulse_agrees_delete_own"
  ON public.pulse_agrees FOR DELETE
  USING (auth.uid() = user_id);

GRANT SELECT ON public.pulse_agrees TO anon, authenticated;
GRANT INSERT, DELETE ON public.pulse_agrees TO authenticated;

CREATE OR REPLACE FUNCTION public.pulse_agree_count(p_pulse_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer
  FROM public.pulse_agrees
  WHERE pulse_id = p_pulse_id;
$$;

REVOKE ALL ON FUNCTION public.pulse_agree_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pulse_agree_count(uuid) TO anon, authenticated;

COMMENT ON TABLE public.pulse_agrees IS
  'One-tap Same on a pulse. One row per user per pulse. Guests may read the count.';

-- ============================================================
-- 4. Block person — complement of mute pulse
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_blocks (
    blocker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    blocked_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
    PRIMARY KEY (blocker_id, blocked_user_id),
    CHECK (blocker_id <> blocked_user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker
  ON public.user_blocks (blocker_id);

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_blocks_select_own" ON public.user_blocks;
CREATE POLICY "user_blocks_select_own"
  ON public.user_blocks FOR SELECT
  USING (auth.uid() = blocker_id);

DROP POLICY IF EXISTS "user_blocks_insert_own" ON public.user_blocks;
CREATE POLICY "user_blocks_insert_own"
  ON public.user_blocks FOR INSERT
  WITH CHECK (auth.uid() = blocker_id AND blocker_id <> blocked_user_id);

DROP POLICY IF EXISTS "user_blocks_delete_own" ON public.user_blocks;
CREATE POLICY "user_blocks_delete_own"
  ON public.user_blocks FOR DELETE
  USING (auth.uid() = blocker_id);

GRANT SELECT, INSERT, DELETE ON public.user_blocks TO authenticated;

COMMENT ON TABLE public.user_blocks IS
  'Blocked people leave the viewer''s Tonight. Signed-in writes only.';

-- ============================================================
-- 5. Crew tonight — 2–4 followed people on a My-night pin
-- ============================================================
CREATE TABLE IF NOT EXISTS public.crew_tonight (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
    member_user_ids UUID[] NOT NULL,
    night_date DATE NOT NULL DEFAULT ((NOW() AT TIME ZONE 'America/Los_Angeles')::date),
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
    UNIQUE (owner_id, venue_id, night_date),
    CHECK (cardinality(member_user_ids) BETWEEN 2 AND 4)
);

CREATE INDEX IF NOT EXISTS idx_crew_tonight_owner
  ON public.crew_tonight (owner_id, night_date);

ALTER TABLE public.crew_tonight ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crew_tonight_select_own" ON public.crew_tonight;
CREATE POLICY "crew_tonight_select_own"
  ON public.crew_tonight FOR SELECT
  USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "crew_tonight_insert_own" ON public.crew_tonight;
CREATE POLICY "crew_tonight_insert_own"
  ON public.crew_tonight FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "crew_tonight_update_own" ON public.crew_tonight;
CREATE POLICY "crew_tonight_update_own"
  ON public.crew_tonight FOR UPDATE
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "crew_tonight_delete_own" ON public.crew_tonight;
CREATE POLICY "crew_tonight_delete_own"
  ON public.crew_tonight FOR DELETE
  USING (auth.uid() = owner_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crew_tonight TO authenticated;

COMMENT ON TABLE public.crew_tonight IS
  'Signed-in pick of 2–4 followed people onto a My-night pinned venue. No SMS vendor.';

-- ============================================================
-- 6. Door pin — verified owner pins one tonight pulse
-- ============================================================
CREATE TABLE IF NOT EXISTS public.venue_door_pins (
    venue_id UUID PRIMARY KEY REFERENCES public.venues(id) ON DELETE CASCADE,
    pulse_id UUID NOT NULL REFERENCES public.pulses(id) ON DELETE CASCADE,
    pinned_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    pinned_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE INDEX IF NOT EXISTS idx_venue_door_pins_pulse
  ON public.venue_door_pins (pulse_id);

ALTER TABLE public.venue_door_pins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "venue_door_pins_select" ON public.venue_door_pins;
CREATE POLICY "venue_door_pins_select"
  ON public.venue_door_pins FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "venue_door_pins_write_verified" ON public.venue_door_pins;
CREATE POLICY "venue_door_pins_write_verified"
  ON public.venue_door_pins FOR INSERT
  WITH CHECK (
    auth.uid() = pinned_by
    AND EXISTS (
      SELECT 1 FROM public.venue_claims c
      WHERE c.venue_id = venue_door_pins.venue_id
        AND c.user_id = auth.uid()
        AND c.status = 'verified'
    )
  );

DROP POLICY IF EXISTS "venue_door_pins_update_verified" ON public.venue_door_pins;
CREATE POLICY "venue_door_pins_update_verified"
  ON public.venue_door_pins FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.venue_claims c
      WHERE c.venue_id = venue_door_pins.venue_id
        AND c.user_id = auth.uid()
        AND c.status = 'verified'
    )
  )
  WITH CHECK (
    auth.uid() = pinned_by
    AND EXISTS (
      SELECT 1 FROM public.venue_claims c
      WHERE c.venue_id = venue_door_pins.venue_id
        AND c.user_id = auth.uid()
        AND c.status = 'verified'
    )
  );

DROP POLICY IF EXISTS "venue_door_pins_delete_verified" ON public.venue_door_pins;
CREATE POLICY "venue_door_pins_delete_verified"
  ON public.venue_door_pins FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.venue_claims c
      WHERE c.venue_id = venue_door_pins.venue_id
        AND c.user_id = auth.uid()
        AND c.status = 'verified'
    )
  );

GRANT SELECT ON public.venue_door_pins TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.venue_door_pins TO authenticated;

COMMENT ON TABLE public.venue_door_pins IS
  'Verified owner pins one from-the-door pulse to the top of tonight. Pending claims cannot.';
