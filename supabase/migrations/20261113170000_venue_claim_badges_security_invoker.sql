-- Security Advisor ERROR 0010 (security_definer_view) on public.venue_claim_badges.
--
-- The view was created without security_invoker, so it ran as its owner
-- (postgres, BYPASSRLS) and ignored RLS. Guests and signed-in users read
-- it for claimed venue ids (listVerifiedClaimVenueIds / overlayClaimVerified).
-- No edge function or RPC reads it.
--
-- venue_claims SELECT is own-row or is_admin() only. On hosted Pulse,
-- anon and authenticated also have table-level privileges on venue_claims,
-- so a policy that exposed every verified claim row would reveal evidence,
-- user ids, notes, and work emails. This migration does not add that policy
-- and does not ALTER ROLE anon, authenticated, service_role, or authenticator.
--
-- venues.claim_verified is the public flag kept in sync by
-- sync_venue_claim_verified(). venues_select_public already lets anon and
-- authenticated read non-deleted venues. The invoker view projects only
-- that flag as venue_id. Pending claims stay hidden. Soft-deleted venues
-- stay hidden by venues RLS (the definer view could still return their ids).
-- DISTINCT keeps the view non-auto-updatable.
--
-- Apply on xeldqwhztcnnvazmshzh only after this file is merged.
-- Verify with supabase/verify/venue_claim_badges_security_invoker.sql.

CREATE OR REPLACE VIEW public.venue_claim_badges
WITH (security_invoker = true) AS
SELECT DISTINCT id AS venue_id
FROM public.venues
WHERE claim_verified IS TRUE;

ALTER VIEW public.venue_claim_badges SET (security_invoker = true);

COMMENT ON VIEW public.venue_claim_badges IS
    'Public claimed-venue ids from venues.claim_verified. security_invoker so venues RLS applies. Does not read venue_claims.';

-- Floor for the view. Table-level SELECT on venues already exists for
-- anon and authenticated; these column grants do not open other columns
-- and do not touch venue_claims.
GRANT SELECT (id, claim_verified) ON TABLE public.venues TO anon, authenticated;

GRANT SELECT ON TABLE public.venue_claim_badges TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
