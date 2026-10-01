-- WC-10: crew members can read the crew they belong to.
-- Guests stay blocked (no anon policy). Owners keep crew_tonight_select_own.
-- Does not drop signal_* tables.
-- Apply on xeldqwhztcnnvazmshzh. Verify with supabase/verify/crew_tonight_member_read.sql.

DROP POLICY IF EXISTS "crew_tonight_select_member" ON public.crew_tonight;
CREATE POLICY "crew_tonight_select_member"
  ON public.crew_tonight FOR SELECT
  TO authenticated
  USING (auth.uid() = ANY (member_user_ids));

COMMENT ON POLICY "crew_tonight_select_member" ON public.crew_tonight IS
  'Members see their own crew tonight row. Other crews and guests do not.';
