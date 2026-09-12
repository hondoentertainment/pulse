-- Verify venue_follows on xeldqwhztcnnvazmshzh
SELECT
  to_regclass('public.venue_follows') IS NOT NULL AS venue_follows_exists,
  (
    SELECT relrowsecurity
    FROM pg_class
    WHERE oid = 'public.venue_follows'::regclass
  ) AS venue_follows_rls;

SELECT policyname, cmd
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'venue_follows'
ORDER BY policyname;
