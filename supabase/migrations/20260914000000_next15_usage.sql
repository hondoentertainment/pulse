-- Next-15 usage roadmap (additive only).
-- Reuses follows, presence, notifications, pulse_reports, pulses.
-- No new vendors. Apply on xeldqwhztcnnvazmshzh via SQL editor.

-- Door chips on a pulse: optional one-taps only (line / cover / energy).
ALTER TABLE public.pulses
  ADD COLUMN IF NOT EXISTS door_chips TEXT[] NOT NULL DEFAULT '{}';

-- My night: pin 2–3 followed rooms. Soft flag on existing follows.
ALTER TABLE public.follows
  ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_follows_pinned
  ON public.follows (follower_id, pinned_at)
  WHERE deleted_at IS NULL AND pinned_at IS NOT NULL;

-- Guest-safe here-now count (90-minute window). Names stay off this RPC.
CREATE OR REPLACE FUNCTION public.venue_here_now_count(p_venue_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer
  FROM public.presence
  WHERE venue_id = p_venue_id
    AND left_at IS NULL
    AND visibility <> 'off'
    AND checked_in_at > (NOW() - INTERVAL '90 minutes');
$$;

REVOKE ALL ON FUNCTION public.venue_here_now_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.venue_here_now_count(uuid) TO anon, authenticated;

-- Names only for people the viewer already follows.
CREATE OR REPLACE FUNCTION public.venue_here_now_friends(p_venue_id uuid)
RETURNS TABLE (user_id uuid, username text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, pr.username
  FROM public.presence p
  JOIN public.follows f
    ON f.follower_id = auth.uid()
   AND f.target_kind = 'user'
   AND f.target_user_id = p.user_id
   AND f.deleted_at IS NULL
  LEFT JOIN public.profiles pr ON pr.id = p.user_id
  WHERE p.venue_id = p_venue_id
    AND p.left_at IS NULL
    AND p.visibility <> 'off'
    AND p.checked_in_at > (NOW() - INTERVAL '90 minutes')
    AND auth.uid() IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.venue_here_now_friends(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.venue_here_now_friends(uuid) TO authenticated;

COMMENT ON FUNCTION public.venue_here_now_count(uuid) IS
  'Count of 90-min presence rows at a venue. Guests may read the count only.';
COMMENT ON FUNCTION public.venue_here_now_friends(uuid) IS
  'Presence display names only when the viewer follows that person.';
COMMENT ON COLUMN public.pulses.door_chips IS
  'Optional compose one-taps: line, cover, energy. Never invented values.';
COMMENT ON COLUMN public.follows.pinned_at IS
  'My night pin. Cap 3 live pins per follower in the client.';
