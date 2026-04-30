-- Migration: native push token registry
-- Stores per-device push tokens for Pulse's iOS (APNs) and Android (FCM) apps.
-- A user may have multiple active devices; a single token is unique per user.

CREATE TABLE IF NOT EXISTS push_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
    device_id TEXT,
    app_version TEXT,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, token)
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_platform ON push_tokens(platform);
CREATE INDEX IF NOT EXISTS idx_push_tokens_last_seen_at ON push_tokens(last_seen_at DESC);

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

-- Owner-only read/write
CREATE POLICY "Users can view their own push tokens."
    ON push_tokens FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own push tokens."
    ON push_tokens FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own push tokens."
    ON push_tokens FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own push tokens."
    ON push_tokens FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- Keep updated_at fresh on upsert/update
CREATE OR REPLACE FUNCTION touch_push_token_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER push_tokens_touch_updated_at
    BEFORE UPDATE ON push_tokens
    FOR EACH ROW
    EXECUTE FUNCTION touch_push_token_updated_at();
