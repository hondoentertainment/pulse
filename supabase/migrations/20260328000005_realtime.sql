-- ============================================================
-- Migration: Enable Supabase Realtime
-- Created: 2026-03-28
-- ============================================================
-- Adds key tables to the supabase_realtime publication so that
-- connected clients receive live change events.
-- ============================================================

-- These statements are idempotent in Postgres 15+ via IF NOT EXISTS.
-- On older Supabase instances the publication already exists; we just
-- ADD TABLE.  Wrap in DO blocks to suppress errors if already added.

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE pulses;
EXCEPTION WHEN duplicate_object THEN
    NULL;  -- already a member; ignore
END;
$$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
EXCEPTION WHEN duplicate_object THEN
    NULL;
END;
$$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE stories;
EXCEPTION WHEN duplicate_object THEN
    NULL;
END;
$$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE check_ins;
EXCEPTION WHEN duplicate_object THEN
    NULL;
END;
$$;

-- Also subscribe crews so that group members get live status updates.
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE crews;
EXCEPTION WHEN duplicate_object THEN
    NULL;
END;
$$;
