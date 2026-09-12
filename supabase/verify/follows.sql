-- Verify prod follows is reused for venue Follow (no venue_follows table)
SELECT
  to_regclass('public.follows') IS NOT NULL AS follows_exists,
  to_regclass('public.venue_follows') IS NULL AS no_second_follow_table,
  (
    SELECT relrowsecurity
    FROM pg_class
    WHERE oid = 'public.follows'::regclass
  ) AS follows_rls;

SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'follows'
ORDER BY ordinal_position;

SELECT policyname, cmd
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'follows'
ORDER BY policyname;
