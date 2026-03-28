-- ============================================================
-- Migration: RLS Policies for Additional Tables
-- Created: 2026-03-28
-- ============================================================
-- Conventions used throughout:
--   "admin"        — profiles where role = 'admin'  (add a `role` column if
--                    not already present — see note at bottom of file)
--   "venue_owner"  — any row in venue_owners for the given venue
-- ============================================================

-- ----------------------------------------------------------------
-- Helper: is the current user an admin?
-- Defined as an IMMUTABLE security-definer function so RLS policies
-- can call it without an extra round-trip to profiles.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
          AND role = 'admin'
    );
$$;

-- ----------------------------------------------------------------
-- Helper: does the current user own/manage the given venue?
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_venue_owner(p_venue_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM venue_owners
        WHERE user_id  = auth.uid()
          AND venue_id = p_venue_id
          AND verified = true
    );
$$;

-- NOTE: The initial schema's profiles table does not include a `role`
-- column.  Add it here so the helper above works correctly.
ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user'
        CHECK (role IN ('user', 'admin', 'moderator'));

-- ================================================================
-- CREWS
-- ================================================================
ALTER TABLE crews ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can see all crews (social discovery).
CREATE POLICY "crews_select_authenticated"
    ON crews FOR SELECT
    TO authenticated
    USING (true);

-- Only the creator can insert a crew (creator_id must match caller).
CREATE POLICY "crews_insert_own"
    ON crews FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = creator_id);

-- Creator can update their own crew; admins can update any.
CREATE POLICY "crews_update_own_or_admin"
    ON crews FOR UPDATE
    TO authenticated
    USING (auth.uid() = creator_id OR is_admin())
    WITH CHECK (auth.uid() = creator_id OR is_admin());

-- Only the creator or an admin can delete a crew.
CREATE POLICY "crews_delete_own_or_admin"
    ON crews FOR DELETE
    TO authenticated
    USING (auth.uid() = creator_id OR is_admin());

-- ================================================================
-- STORIES
-- ================================================================
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read non-expired stories.
CREATE POLICY "stories_select_authenticated"
    ON stories FOR SELECT
    TO authenticated
    USING (expires_at > NOW());

-- Users can only post their own stories.
CREATE POLICY "stories_insert_own"
    ON stories FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own stories; venue owners can update stories
-- for their venue (e.g. to pin/feature); admins can update any.
CREATE POLICY "stories_update_own_or_venue_owner_or_admin"
    ON stories FOR UPDATE
    TO authenticated
    USING (
        auth.uid() = user_id
        OR is_venue_owner(venue_id)
        OR is_admin()
    )
    WITH CHECK (
        auth.uid() = user_id
        OR is_venue_owner(venue_id)
        OR is_admin()
    );

-- Users can delete their own stories; venue owners can remove stories
-- from their venue; admins can remove any.
CREATE POLICY "stories_delete_own_or_venue_owner_or_admin"
    ON stories FOR DELETE
    TO authenticated
    USING (
        auth.uid() = user_id
        OR is_venue_owner(venue_id)
        OR is_admin()
    );

-- ================================================================
-- REACTIONS
-- ================================================================
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read reactions.
CREATE POLICY "reactions_select_authenticated"
    ON reactions FOR SELECT
    TO authenticated
    USING (true);

-- Users can only insert reactions attributed to themselves.
CREATE POLICY "reactions_insert_own"
    ON reactions FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Users can remove their own reactions; admins can remove any.
CREATE POLICY "reactions_delete_own_or_admin"
    ON reactions FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id OR is_admin());

-- ================================================================
-- EVENTS
-- ================================================================
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read events.
CREATE POLICY "events_select_authenticated"
    ON events FOR SELECT
    TO authenticated
    USING (true);

-- Venue owners (verified) or admins can create events for their venue.
CREATE POLICY "events_insert_venue_owner_or_admin"
    ON events FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = created_by
        AND (is_venue_owner(venue_id) OR is_admin())
    );

-- Venue owners or admins can update events.
CREATE POLICY "events_update_venue_owner_or_admin"
    ON events FOR UPDATE
    TO authenticated
    USING (is_venue_owner(venue_id) OR is_admin())
    WITH CHECK (is_venue_owner(venue_id) OR is_admin());

-- Venue owners or admins can delete events.
CREATE POLICY "events_delete_venue_owner_or_admin"
    ON events FOR DELETE
    TO authenticated
    USING (is_venue_owner(venue_id) OR is_admin());

-- ================================================================
-- VENUE_OWNERS
-- ================================================================
ALTER TABLE venue_owners ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can see the ownership list (needed to
-- know who manages a venue, e.g. to contact them).
CREATE POLICY "venue_owners_select_authenticated"
    ON venue_owners FOR SELECT
    TO authenticated
    USING (true);

-- Only admins can grant ownership (prevents self-grant abuse).
CREATE POLICY "venue_owners_insert_admin"
    ON venue_owners FOR INSERT
    TO authenticated
    WITH CHECK (is_admin());

-- Admins can verify/update roles; the owner themselves can also
-- update non-role fields (e.g. contact info if added later).
CREATE POLICY "venue_owners_update_own_or_admin"
    ON venue_owners FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id OR is_admin())
    WITH CHECK (auth.uid() = user_id OR is_admin());

-- Only admins can revoke ownership.
CREATE POLICY "venue_owners_delete_admin"
    ON venue_owners FOR DELETE
    TO authenticated
    USING (is_admin());

-- ================================================================
-- CONTENT_REPORTS
-- ================================================================
ALTER TABLE content_reports ENABLE ROW LEVEL SECURITY;

-- Reporters can see their own reports; admins/moderators see all.
CREATE POLICY "content_reports_select"
    ON content_reports FOR SELECT
    TO authenticated
    USING (
        auth.uid() = reporter_id
        OR is_admin()
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'moderator'
        )
    );

-- Any authenticated user can file a report attributed to themselves.
CREATE POLICY "content_reports_insert_own"
    ON content_reports FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = reporter_id);

-- Only admins and moderators can update reports (triage / action).
CREATE POLICY "content_reports_update_admin_or_moderator"
    ON content_reports FOR UPDATE
    TO authenticated
    USING (
        is_admin()
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'moderator'
        )
    )
    WITH CHECK (
        is_admin()
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'moderator'
        )
    );

-- Only admins can hard-delete reports (audit trail matters).
CREATE POLICY "content_reports_delete_admin"
    ON content_reports FOR DELETE
    TO authenticated
    USING (is_admin());

-- ================================================================
-- FOLLOWS
-- ================================================================
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can see follow relationships (social graph).
CREATE POLICY "follows_select_authenticated"
    ON follows FOR SELECT
    TO authenticated
    USING (true);

-- Users can only create follows on behalf of themselves.
CREATE POLICY "follows_insert_own"
    ON follows FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = follower_id);

-- Users can only unfollow themselves; admins can remove any.
CREATE POLICY "follows_delete_own_or_admin"
    ON follows FOR DELETE
    TO authenticated
    USING (auth.uid() = follower_id OR is_admin());

-- ================================================================
-- CHECK_INS
-- ================================================================
ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;

-- Users can see their own check-ins; venue owners see check-ins
-- at their venue; admins see everything.
CREATE POLICY "check_ins_select"
    ON check_ins FOR SELECT
    TO authenticated
    USING (
        auth.uid() = user_id
        OR is_venue_owner(venue_id)
        OR is_admin()
    );

-- Users can only insert their own check-ins.
CREATE POLICY "check_ins_insert_own"
    ON check_ins FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Check-ins are immutable by users; venue owners can mark them
-- verified; admins can update anything.
CREATE POLICY "check_ins_update_venue_owner_or_admin"
    ON check_ins FOR UPDATE
    TO authenticated
    USING (is_venue_owner(venue_id) OR is_admin())
    WITH CHECK (is_venue_owner(venue_id) OR is_admin());

-- Users can delete their own check-ins (right to be forgotten);
-- admins can delete any.
CREATE POLICY "check_ins_delete_own_or_admin"
    ON check_ins FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id OR is_admin());
