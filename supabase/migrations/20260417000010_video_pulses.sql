-- Migration: Video pulses (geo-anchored short videos)
-- Adds video metadata columns to `pulses`, creates `pulse-videos` storage bucket,
-- and adds the `video_reports` moderation table.
--
-- Safe to run against existing environments: every addition is `IF NOT EXISTS`
-- or defensively guarded so the migration is backwards compatible.

-- ============================================================
-- 1. Extend `pulses` with optional video metadata
-- ============================================================
-- `pulses.video_url` already exists (or was added by the initial schema); if
-- not, this migration creates it. All new columns are nullable so existing
-- rows remain valid.
ALTER TABLE pulses ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE pulses ADD COLUMN IF NOT EXISTS video_duration_ms INTEGER;
ALTER TABLE pulses ADD COLUMN IF NOT EXISTS video_width INTEGER;
ALTER TABLE pulses ADD COLUMN IF NOT EXISTS video_height INTEGER;
ALTER TABLE pulses ADD COLUMN IF NOT EXISTS video_thumbnail_url TEXT;
ALTER TABLE pulses ADD COLUMN IF NOT EXISTS video_mime_type TEXT;
ALTER TABLE pulses ADD COLUMN IF NOT EXISTS video_bytes BIGINT;

-- Defensive CHECK constraints — permissive so they don't block valid data.
ALTER TABLE pulses
    DROP CONSTRAINT IF EXISTS pulses_video_duration_positive;
ALTER TABLE pulses
    ADD CONSTRAINT pulses_video_duration_positive
    CHECK (video_duration_ms IS NULL OR video_duration_ms > 0);

ALTER TABLE pulses
    DROP CONSTRAINT IF EXISTS pulses_video_bytes_positive;
ALTER TABLE pulses
    ADD CONSTRAINT pulses_video_bytes_positive
    CHECK (video_bytes IS NULL OR (video_bytes > 0 AND video_bytes <= 52428800)); -- 50 MB

ALTER TABLE pulses
    DROP CONSTRAINT IF EXISTS pulses_video_mime_allowed;
ALTER TABLE pulses
    ADD CONSTRAINT pulses_video_mime_allowed
    CHECK (video_mime_type IS NULL OR video_mime_type IN ('video/mp4', 'video/webm', 'video/quicktime'));

-- ============================================================
-- 2. Partial index supporting the video-feed query path
-- ============================================================
-- Only index rows that the video feed will actually read (video present,
-- not deleted, not expired). The partial clause keeps the index small and hot.
CREATE INDEX IF NOT EXISTS idx_pulses_video_feed
    ON pulses (created_at DESC)
    WHERE video_url IS NOT NULL
      AND deleted_at IS NULL
      AND expires_at > now();

-- Secondary index for per-venue video listings (venue profile → videos).
CREATE INDEX IF NOT EXISTS idx_pulses_video_by_venue
    ON pulses (venue_id, created_at DESC)
    WHERE video_url IS NOT NULL
      AND deleted_at IS NULL;

-- ============================================================
-- 3. Storage bucket: pulse-videos
-- ============================================================
-- Public read (the feed is public), authenticated write via RLS, 50 MB cap.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'pulse-videos',
    'pulse-videos',
    true,
    52428800, -- 50 MB
    ARRAY['video/mp4', 'video/webm', 'video/quicktime']
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage RLS policies — drop first so re-running is idempotent.
DROP POLICY IF EXISTS "pulse_videos_public_read" ON storage.objects;
CREATE POLICY "pulse_videos_public_read"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'pulse-videos');

DROP POLICY IF EXISTS "pulse_videos_owner_insert" ON storage.objects;
CREATE POLICY "pulse_videos_owner_insert"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'pulse-videos'
        AND auth.uid() IS NOT NULL
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

DROP POLICY IF EXISTS "pulse_videos_owner_update" ON storage.objects;
CREATE POLICY "pulse_videos_owner_update"
    ON storage.objects FOR UPDATE
    USING (
        bucket_id = 'pulse-videos'
        AND auth.uid() IS NOT NULL
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

DROP POLICY IF EXISTS "pulse_videos_owner_delete" ON storage.objects;
CREATE POLICY "pulse_videos_owner_delete"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'pulse-videos'
        AND auth.uid() IS NOT NULL
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- ============================================================
-- 4. Pulses-table RLS — scope video-metadata writes to owner
-- ============================================================
-- The existing pulses RLS already restricts write to the row owner; we add a
-- video-specific WITH CHECK that refuses video metadata on rows the caller
-- doesn't own. (Defense in depth.)
DROP POLICY IF EXISTS "pulses_video_owner_write" ON pulses;
CREATE POLICY "pulses_video_owner_write"
    ON pulses FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 5. video_reports — moderation queue rows
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'video_report_reason') THEN
        CREATE TYPE video_report_reason AS ENUM (
            'copyrighted_audio',
            'nsfw',
            'minor_in_frame',
            'harassment',
            'spam',
            'misinformation',
            'other'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'video_report_action') THEN
        CREATE TYPE video_report_action AS ENUM (
            'none',
            'warning',
            'content_removed',
            'user_suspended'
        );
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS video_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pulse_id UUID NOT NULL REFERENCES pulses(id) ON DELETE CASCADE,
    reporter_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    reason video_report_reason NOT NULL,
    note TEXT,
    resolved_at TIMESTAMPTZ,
    action_taken video_report_action,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_video_reports_pulse_id ON video_reports(pulse_id);
CREATE INDEX IF NOT EXISTS idx_video_reports_reporter ON video_reports(reporter_user_id);
CREATE INDEX IF NOT EXISTS idx_video_reports_unresolved
    ON video_reports(created_at DESC)
    WHERE resolved_at IS NULL;

ALTER TABLE video_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "video_reports_reporter_read" ON video_reports;
CREATE POLICY "video_reports_reporter_read"
    ON video_reports FOR SELECT
    USING (reporter_user_id = auth.uid());

DROP POLICY IF EXISTS "video_reports_reporter_insert" ON video_reports;
CREATE POLICY "video_reports_reporter_insert"
    ON video_reports FOR INSERT
    WITH CHECK (reporter_user_id = auth.uid());

-- Admin-role read/update policies are applied out-of-band once the admin role
-- is provisioned. Placeholder policy naming mirrors the other moderation
-- tables so the admin SQL can grant-by-role later.
