-- Verify Web Push lives on existing push_tokens (no web_push_subscriptions)
SELECT
  to_regclass('public.push_tokens') IS NOT NULL AS push_tokens_exists,
  to_regclass('public.web_push_subscriptions') IS NULL AS no_second_push_table,
  (
    SELECT relrowsecurity
    FROM pg_class
    WHERE oid = 'public.push_tokens'::regclass
  ) AS push_tokens_rls;

SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'push_tokens'
ORDER BY ordinal_position;

SELECT pg_get_constraintdef(oid) AS platform_check
FROM pg_constraint
WHERE conrelid = 'public.push_tokens'::regclass
  AND contype = 'c'
  AND pg_get_constraintdef(oid) ILIKE '%platform%';

SELECT policyname, cmd
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'push_tokens'
ORDER BY policyname;
