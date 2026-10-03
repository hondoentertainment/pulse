-- Verify live-pulse in-app fan-out reuses notifications (no new type table)
SELECT
  to_regclass('public.notifications') IS NOT NULL AS notifications_exists,
  EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'notification_type'
      AND e.enumlabel = 'friend_pulse'
  ) AS friend_pulse_exists,
  (
    SELECT relrowsecurity
    FROM pg_class
    WHERE oid = 'public.notifications'::regclass
  ) AS notifications_rls;

SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'notifications'
ORDER BY ordinal_position;

SELECT policyname, cmd
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'notifications'
ORDER BY policyname;
