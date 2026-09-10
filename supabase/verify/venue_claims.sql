-- Verify venue_claims + pulse_reports queue columns on
-- production project xeldqwhztcnnvazmshzh (or local after db reset).
--
-- Expect: table exists, RLS on, status check present.

SELECT
  to_regclass('public.venue_claims') IS NOT NULL AS venue_claims_exists,
  (
    SELECT relrowsecurity
    FROM pg_class
    WHERE oid = 'public.venue_claims'::regclass
  ) AS venue_claims_rls;

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'venue_claims'
ORDER BY ordinal_position;

SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'pulse_reports'
  AND column_name IN ('status', 'reviewed_at')
ORDER BY column_name;
