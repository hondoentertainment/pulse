-- Public claim badge for map/Tonight chips.
-- Pending claims must NOT set this flag or unlock /venue/:id/inbox.
--
-- Apply on production project xeldqwhztcnnvazmshzh via SQL editor
-- (migration history versions there do not match repo filenames).
-- Verify with: supabase/verify/venue_claims.sql

ALTER TABLE public.venues
    ADD COLUMN IF NOT EXISTS claim_verified BOOLEAN NOT NULL DEFAULT false;

UPDATE public.venues v
SET claim_verified = EXISTS (
    SELECT 1
    FROM public.venue_claims c
    WHERE c.venue_id = v.id
      AND c.status = 'verified'
);

CREATE OR REPLACE FUNCTION public.sync_venue_claim_verified()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    target_id uuid;
BEGIN
    target_id := COALESCE(NEW.venue_id, OLD.venue_id);
    IF target_id IS NULL THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    UPDATE public.venues
    SET claim_verified = EXISTS (
        SELECT 1
        FROM public.venue_claims
        WHERE venue_id = target_id
          AND status = 'verified'
    )
    WHERE id = target_id;

    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS venue_claims_sync_verified ON public.venue_claims;
CREATE TRIGGER venue_claims_sync_verified
    AFTER INSERT OR UPDATE OR DELETE ON public.venue_claims
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_venue_claim_verified();

-- Guests can see which venues are claimed without reading evidence or user ids.
CREATE OR REPLACE VIEW public.venue_claim_badges AS
SELECT DISTINCT venue_id
FROM public.venue_claims
WHERE status = 'verified';

GRANT SELECT ON public.venue_claim_badges TO anon, authenticated;
