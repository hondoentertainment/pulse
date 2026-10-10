-- Verify heading, launch-quiet mute, and pulse hide columns.
SELECT
  to_regclass('public.venue_headings') IS NOT NULL AS venue_headings,
  to_regclass('public.launch_quiet_notices') IS NOT NULL AS launch_quiet_notices,
  to_regclass('public.launch_quiet_mutes') IS NOT NULL AS launch_quiet_mutes,
  (
    SELECT relrowsecurity FROM pg_class WHERE oid = 'public.venue_headings'::regclass
  ) AS headings_rls,
  (
    SELECT count(*) FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pulses'
      AND column_name IN ('hidden_at', 'hidden_note', 'hidden_by')
  ) AS pulse_hide_columns;
