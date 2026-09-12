-- Verify web_push_subscriptions on xeldqwhztcnnvazmshzh
SELECT
  to_regclass('public.web_push_subscriptions') IS NOT NULL AS web_push_subscriptions_exists,
  (
    SELECT relrowsecurity
    FROM pg_class
    WHERE oid = 'public.web_push_subscriptions'::regclass
  ) AS web_push_subscriptions_rls;

SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'web_push_subscriptions'
ORDER BY ordinal_position;

SELECT policyname, cmd
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'web_push_subscriptions'
ORDER BY policyname;
