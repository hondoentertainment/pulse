-- Verify venue-surge prefs + owner replies. Do not drop signal_* tables.
SELECT
  to_regclass('public.venue_surge_notices') IS NOT NULL AS surge_notices,
  to_regclass('public.venue_owner_replies') IS NOT NULL AS owner_replies,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'follows' AND column_name = 'surge_muted'
  ) AS follows_surge_muted,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'push_tokens' AND column_name = 'quiet_hours_start'
  ) AS quiet_hours_start,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'push_tokens' AND column_name = 'quiet_hours_end'
  ) AS quiet_hours_end;
