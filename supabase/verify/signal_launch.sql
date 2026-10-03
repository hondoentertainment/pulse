-- Run in the production Supabase SQL editor after applying:
--   20260816000000_signal_core.sql
--   20260816000001_signal_pilot_signups.sql
--   20260816000002_signal_push_subscriptions.sql
--   20260825000000_venue_signal_seattle_launch.sql
--
-- Expect four Signal tables. Venue launch tables are optional for Signal-only prod.

SELECT
  to_regclass('public.signal_entries') AS signal_entries,
  to_regclass('public.signal_profiles') AS signal_profiles,
  to_regclass('public.signal_pilot_signups') AS signal_pilot_signups,
  to_regclass('public.signal_push_subscriptions') AS signal_push_subscriptions;

SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.signal_entries'::regclass
  AND contype = 'u';

-- Unique (user_id, day_key, check_in_window) must exist.

SELECT
  COUNT(*) FILTER (WHERE tablename = 'signal_entries' AND policyname ILIKE '%delete%') AS entry_delete_policies,
  COUNT(*) FILTER (WHERE tablename = 'signal_profiles' AND policyname ILIKE '%delete%') AS profile_delete_policies
FROM pg_policies
WHERE schemaname = 'public';
