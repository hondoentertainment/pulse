-- Verify domain-match claim helpers on xeldqwhztcnnvazmshzh
SELECT
  (
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'venues' AND column_name = 'owner_email_domain'
    )
  ) AS venues_owner_email_domain,
  (
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'venue_claims' AND column_name = 'work_email'
    )
  ) AS venue_claims_work_email,
  to_regprocedure('public.normalize_owner_domain(text)') IS NOT NULL AS normalize_owner_domain,
  to_regprocedure('public.try_verify_venue_claim_by_email_domain(uuid)') IS NOT NULL AS try_verify_rpc;

SELECT public.normalize_owner_domain('https://www.neumos.com/events') AS website_host;
SELECT public.normalize_owner_domain('gm@neumos.com') AS email_domain;
