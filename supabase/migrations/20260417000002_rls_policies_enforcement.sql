-- Migration: Row-Level Security policies for full enforcement
--
-- This migration encodes the following rules:
--
--   1. Writes (INSERT/UPDATE/DELETE) require an authenticated session.
--      Anonymous JWTs get SELECT-only access where a table is public.
--   2. Users can only UPDATE/DELETE their own rows. `user_id = auth.uid()`
--      (or the table's owner column) is enforced in USING + WITH CHECK.
--   3. Venues and pulses are publicly readable (browse-without-signup).
--   4. Profiles are publicly readable but only the owner can insert/update.
--   5. Admin bypass: any caller with `app_metadata.role = 'admin'` in their
--      JWT (see `public.is_admin()`) can read/write every row.
--
-- The migration is idempotent: every policy is dropped-then-created.
-- Run this after 20260417000001_core_tables_and_soft_delete.sql.

-- ============================================================
-- Helper: drop_policy_if_exists
-- ============================================================
-- Postgres supports DROP POLICY IF EXISTS natively in 15+. Use it directly.

-- ============================================================
-- profiles
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_public"      ON profiles;
DROP POLICY IF EXISTS "profiles_insert_self"        ON profiles;
DROP POLICY IF EXISTS "profiles_update_self"        ON profiles;
DROP POLICY IF EXISTS "profiles_admin_all"          ON profiles;
-- Supersede legacy (from 20260322) policies that overlap
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile."       ON profiles;
DROP POLICY IF EXISTS "Users can update own profile."             ON profiles;

CREATE POLICY "profiles_select_public"
    ON profiles FOR SELECT
    USING (deleted_at IS NULL OR is_admin());

CREATE POLICY "profiles_insert_self"
    ON profiles FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_self"
    ON profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id OR is_admin())
    WITH CHECK (auth.uid() = id OR is_admin());

CREATE POLICY "profiles_admin_all"
    ON profiles FOR ALL
    TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

-- ============================================================
-- venues  (public read, admin-only writes, owner claim TBD)
-- ============================================================
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "venues_select_public"  ON venues;
DROP POLICY IF EXISTS "venues_admin_insert"   ON venues;
DROP POLICY IF EXISTS "venues_admin_update"   ON venues;
DROP POLICY IF EXISTS "venues_admin_delete"   ON venues;
-- Supersede broad-open policies from earlier migrations
DROP POLICY IF EXISTS "Venues are viewable by everyone."                 ON venues;
DROP POLICY IF EXISTS "Authenticated users can update venues."           ON venues;
DROP POLICY IF EXISTS "Authenticated users can insert venues."           ON venues;

CREATE POLICY "venues_select_public"
    ON venues FOR SELECT
    USING (deleted_at IS NULL OR is_admin());

-- Only admins can mutate venues directly. Venue-owner flow will add a
-- claimed_by_user_id column + dedicated policy in a later migration.
CREATE POLICY "venues_admin_insert"
    ON venues FOR INSERT
    TO authenticated
    WITH CHECK (is_admin());

CREATE POLICY "venues_admin_update"
    ON venues FOR UPDATE
    TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

CREATE POLICY "venues_admin_delete"
    ON venues FOR DELETE
    TO authenticated
    USING (is_admin());

-- ============================================================
-- pulses
-- ============================================================
ALTER TABLE pulses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pulses_select_public"    ON pulses;
DROP POLICY IF EXISTS "pulses_insert_self"      ON pulses;
DROP POLICY IF EXISTS "pulses_update_self"      ON pulses;
DROP POLICY IF EXISTS "pulses_delete_self"      ON pulses;
DROP POLICY IF EXISTS "pulses_admin_all"        ON pulses;
DROP POLICY IF EXISTS "Pulses are viewable by everyone."     ON pulses;
DROP POLICY IF EXISTS "Users can insert their own pulses."   ON pulses;
DROP POLICY IF EXISTS "Users can update their own pulses."   ON pulses;

CREATE POLICY "pulses_select_public"
    ON pulses FOR SELECT
    USING (deleted_at IS NULL OR is_admin());

CREATE POLICY "pulses_insert_self"
    ON pulses FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "pulses_update_self"
    ON pulses FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id OR is_admin())
    WITH CHECK (auth.uid() = user_id OR is_admin());

-- Hard deletes allowed for admin only; users should soft-delete via UPDATE.
CREATE POLICY "pulses_delete_self"
    ON pulses FOR DELETE
    TO authenticated
    USING (is_admin());

-- ============================================================
-- reactions
-- ============================================================
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reactions_select_public" ON reactions;
DROP POLICY IF EXISTS "reactions_insert_self"   ON reactions;
DROP POLICY IF EXISTS "reactions_update_self"   ON reactions;
DROP POLICY IF EXISTS "reactions_delete_self"   ON reactions;

CREATE POLICY "reactions_select_public"
    ON reactions FOR SELECT
    USING (deleted_at IS NULL OR is_admin());

CREATE POLICY "reactions_insert_self"
    ON reactions FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "reactions_update_self"
    ON reactions FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id OR is_admin())
    WITH CHECK (auth.uid() = user_id OR is_admin());

CREATE POLICY "reactions_delete_self"
    ON reactions FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id OR is_admin());

-- ============================================================
-- check_ins
-- ============================================================
ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "check_ins_select_public" ON check_ins;
DROP POLICY IF EXISTS "check_ins_insert_self"   ON check_ins;
DROP POLICY IF EXISTS "check_ins_update_self"   ON check_ins;
DROP POLICY IF EXISTS "check_ins_delete_self"   ON check_ins;

-- Check-ins drive venue scores so we read them widely. Scope to alive rows.
CREATE POLICY "check_ins_select_public"
    ON check_ins FOR SELECT
    USING (deleted_at IS NULL OR is_admin());

CREATE POLICY "check_ins_insert_self"
    ON check_ins FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "check_ins_update_self"
    ON check_ins FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id OR is_admin())
    WITH CHECK (auth.uid() = user_id OR is_admin());

CREATE POLICY "check_ins_delete_self"
    ON check_ins FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id OR is_admin());

-- ============================================================
-- follows
-- ============================================================
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "follows_select_public"   ON follows;
DROP POLICY IF EXISTS "follows_insert_self"     ON follows;
DROP POLICY IF EXISTS "follows_update_self"     ON follows;
DROP POLICY IF EXISTS "follows_delete_self"     ON follows;

-- Follow relationships are public so we can build "followers" counts.
-- (Flip to owner-only later if we need private-friend lists.)
CREATE POLICY "follows_select_public"
    ON follows FOR SELECT
    USING (deleted_at IS NULL OR is_admin());

CREATE POLICY "follows_insert_self"
    ON follows FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "follows_update_self"
    ON follows FOR UPDATE
    TO authenticated
    USING (auth.uid() = follower_id OR is_admin())
    WITH CHECK (auth.uid() = follower_id OR is_admin());

CREATE POLICY "follows_delete_self"
    ON follows FOR DELETE
    TO authenticated
    USING (auth.uid() = follower_id OR is_admin());

-- ============================================================
-- notifications  (owner-only, no public read)
-- ============================================================
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select_self" ON notifications;
DROP POLICY IF EXISTS "notifications_update_self" ON notifications;
DROP POLICY IF EXISTS "notifications_delete_self" ON notifications;
DROP POLICY IF EXISTS "notifications_admin_all"   ON notifications;
-- Supersede previous policies
DROP POLICY IF EXISTS "Users can view their own notifications."   ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications." ON notifications;

CREATE POLICY "notifications_select_self"
    ON notifications FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id OR is_admin());

CREATE POLICY "notifications_update_self"
    ON notifications FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id OR is_admin())
    WITH CHECK (auth.uid() = user_id OR is_admin());

CREATE POLICY "notifications_delete_self"
    ON notifications FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id OR is_admin());

-- Notifications are system-generated; inserts happen via a SECURITY DEFINER
-- function or service_role key. No user-facing INSERT policy.

-- ============================================================
-- Explicit privilege revoke for the anon role on writes
-- ============================================================
-- RLS already blocks anon writes, but revoking default GRANTs is defence-in-depth.
DO $$
BEGIN
    REVOKE INSERT, UPDATE, DELETE ON TABLE
        profiles, venues, pulses, reactions, check_ins, follows, notifications
        FROM anon;
EXCEPTION WHEN undefined_table THEN
    -- Some tables may not exist on a fresh slate; ignore.
    NULL;
END
$$;
