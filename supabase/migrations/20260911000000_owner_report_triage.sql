-- Verified claimants and venue_staff can read/dismiss reports on their venue.
-- Needed so owner inbox "Dismiss report" can persist without the service role.
-- Apply on xeldqwhztcnnvazmshzh via SQL editor if migration history versions differ.
-- Verify: policies pulse_reports_owner_select / pulse_reports_owner_update exist.

DROP POLICY IF EXISTS "pulse_reports_owner_select" ON public.pulse_reports;
CREATE POLICY "pulse_reports_owner_select"
    ON public.pulse_reports FOR SELECT
    USING (
      EXISTS (
        SELECT 1
        FROM public.pulses p
        WHERE p.id = pulse_id
          AND (
            EXISTS (
              SELECT 1 FROM public.venue_claims c
              WHERE c.venue_id = p.venue_id
                AND c.user_id = auth.uid()
                AND c.status = 'verified'
            )
            OR EXISTS (
              SELECT 1 FROM public.venue_staff s
              WHERE s.venue_id = p.venue_id
                AND s.user_id = auth.uid()
            )
          )
      )
    );

DROP POLICY IF EXISTS "pulse_reports_owner_update" ON public.pulse_reports;
CREATE POLICY "pulse_reports_owner_update"
    ON public.pulse_reports FOR UPDATE
    USING (
      EXISTS (
        SELECT 1
        FROM public.pulses p
        WHERE p.id = pulse_id
          AND (
            EXISTS (
              SELECT 1 FROM public.venue_claims c
              WHERE c.venue_id = p.venue_id
                AND c.user_id = auth.uid()
                AND c.status = 'verified'
            )
            OR EXISTS (
              SELECT 1 FROM public.venue_staff s
              WHERE s.venue_id = p.venue_id
                AND s.user_id = auth.uid()
            )
          )
      )
    )
    WITH CHECK (true);

GRANT SELECT, UPDATE ON public.pulse_reports TO authenticated;
